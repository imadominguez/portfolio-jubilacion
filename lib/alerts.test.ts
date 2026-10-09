import { describe, expect, it } from "vitest";
import {
  buildAlertEmail,
  DEFAULT_THRESHOLDS,
  dropReasons,
  reminderMonth,
  reminderStatus,
  sessionChangePct,
  shouldNotifyDrop,
  shouldNotifyReminder,
  type DropAlert,
} from "./alerts";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
// 12:00 UTC = 9:00 en Argentina.
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("caídas", () => {
  it("mide la variación contra 5 ruedas antes", () => {
    const history = [100, 101, 102, 103, 104, 90].map((close, i) => ({ date: day(`2026-10-0${i + 1}`), close }));
    expect(sessionChangePct(history)).toBeCloseTo(-10);
    expect(sessionChangePct(history.slice(1))).toBeNull();
  });

  it("dispara por caída desde el máximo o en la semana", () => {
    expect(dropReasons({ fromHigh52wPct: -16, change5dPct: -2 }, DEFAULT_THRESHOLDS)).toEqual(["fromHigh"]);
    expect(dropReasons({ fromHigh52wPct: -10, change5dPct: -9 }, DEFAULT_THRESHOLDS)).toEqual(["weekly"]);
    expect(dropReasons({ fromHigh52wPct: -14.9, change5dPct: null }, DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it("no repite la misma caída salvo que se profundice 5 puntos o pasen 30 días", () => {
    const last = { value: -16, sentAt: at("2026-10-01") };
    expect(shouldNotifyDrop(-16, null, at("2026-10-02"))).toBe(true);
    expect(shouldNotifyDrop(-18, last, at("2026-10-03"))).toBe(false);
    expect(shouldNotifyDrop(-18, last, at("2026-10-20"))).toBe(false);
    expect(shouldNotifyDrop(-21, last, at("2026-10-03"))).toBe(true);
    expect(shouldNotifyDrop(-16, last, at("2026-10-31"))).toBe(true);
  });
});

describe("recordatorio mensual", () => {
  it("recuerda el mes anterior desde el día configurado, en hora de Argentina", () => {
    expect(reminderMonth(at("2026-11-04"), 5)).toBeNull();
    expect(reminderMonth(at("2026-11-05"), 5)).toBe("2026-10");
    expect(reminderMonth(at("2027-01-10"), 5)).toBe("2026-12");
    // 1/12 a las 01:00 UTC todavía es 30/11 en Argentina.
    expect(reminderMonth(new Date("2026-12-01T01:00:00Z"), 30)).toBe("2026-10");
  });

  it("detecta el snapshot y los movimientos que faltan", () => {
    expect(reminderStatus("2026-10", day("2026-10-02"), day("2026-10-29"))).toEqual({
      missingSnapshot: false,
      missingMovements: false,
    });
    expect(reminderStatus("2026-10", day("2026-09-30"), day("2026-10-10"))).toEqual({
      missingSnapshot: true,
      missingMovements: true,
    });
    expect(reminderStatus("2026-10", null, null)).toEqual({ missingSnapshot: true, missingMovements: true });
  });

  it("repite cada 3 días", () => {
    expect(shouldNotifyReminder(null, at("2026-11-05"))).toBe(true);
    expect(shouldNotifyReminder(at("2026-11-05"), at("2026-11-07"))).toBe(false);
    expect(shouldNotifyReminder(at("2026-11-05"), at("2026-11-08"))).toBe(true);
  });
});

describe("buildAlertEmail", () => {
  const drop: DropAlert = {
    ticker: "MELI",
    underlying: "MELI",
    companyName: "CEDEAR MERCADOLIBRE INC.",
    lastClose: 1800,
    lastDate: day("2026-10-08"),
    high52w: 2200,
    fromHigh52wPct: -18.18,
    change5dPct: -9.5,
    reasons: ["fromHigh", "weekly"],
    news: [{ title: "Mercado <Libre> cae", publisher: "Reuters", publishedAt: day("2026-10-07"), relatedTickers: ["MELI"] }],
  };

  it("avisa los presupuestos superados", () => {
    const mail = buildAlertEmail([], null, "https://app.test", [
      { monthKey: "2026-10", category: "supermercado", label: "Supermercado", spent: 120_000, budget: 100_000 },
    ])!;
    expect(mail.subject).toBe("Portfolio: superaste el presupuesto de Supermercado");
    expect(mail.text).toContain("Supermercado: $ 120.000 de $ 100.000 (120 %)");
  });

  it("no arma mail si no hay nada que avisar", () => {
    expect(buildAlertEmail([], null, "https://app.test")).toBeNull();
  });

  it("incluye las caídas con sus titulares escapados y el recordatorio", () => {
    const mail = buildAlertEmail(
      [drop],
      { monthKey: "2026-10", missingSnapshot: false, missingMovements: true },
      "https://app.test/"
    )!;
    expect(mail.subject).toBe("Portfolio: MELI cayó -18,2 % desde su máximo y falta cargar octubre 2026");
    expect(mail.text).toContain("-9,5 % en 5 ruedas");
    expect(mail.text).toContain("Importá los movimientos (Actividad) de octubre 2026.");
    expect(mail.text).not.toContain("reporte de tenencia");
    expect(mail.html).toContain("Mercado &lt;Libre&gt; cae");
    expect(mail.html).toContain("https://app.test/alertas");
  });
});
