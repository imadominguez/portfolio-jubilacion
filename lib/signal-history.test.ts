import { describe, expect, it } from "vitest";
import { buildSignalHistory } from "./signal-history";
import type { OpportunityReport } from "./opportunity-report";

const report = (acciones: Array<[string, "compra" | "mantener" | "venta", "alta" | "media" | "baja"]>): OpportunityReport =>
  ({
    version: 2,
    resumen: "",
    fecha_reporte: "",
    snapshot_fecha: "",
    posiciones_sin_datos: [],
    uso: { model: "", inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUsd: null },
    acciones: acciones.map(([ticker, senal, confianza]) => ({
      ticker,
      senal,
      confianza,
      precio: "",
      noticias: "",
      motivo: "",
      riesgos: "",
    })),
  }) as OpportunityReport;

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("buildSignalHistory", () => {
  const history = buildSignalHistory([
    { id: "oct", createdAt: at("2026-10-08"), report: report([["MELI", "compra", "alta"], ["KO", "mantener", "media"], ["BABA", "venta", "baja"]]) },
    { id: "sep", createdAt: at("2026-09-08"), report: report([["MELI", "mantener", "media"], ["KO", "mantener", "alta"], ["VALO", "venta", "baja"]]) },
  ]);

  it("ordena las columnas del reporte más viejo al más nuevo", () => {
    expect(history.reports.map((r) => r.id)).toEqual(["sep", "oct"]);
  });

  it("ordena por la señal del último reporte y deja al final lo que ya no aparece", () => {
    expect(history.rows.map((r) => r.ticker)).toEqual(["MELI", "KO", "BABA", "VALO"]);
    expect(history.rows.find((r) => r.ticker === "VALO")!.cells).toEqual([{ senal: "venta", confianza: "baja" }, null]);
  });

  it("marca los cambios de señal", () => {
    const changed = Object.fromEntries(history.rows.map((r) => [r.ticker, r.changed]));
    expect(changed).toEqual({ MELI: true, KO: false, BABA: false, VALO: false });
  });

  it("se queda con los últimos reportes", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      createdAt: at(`2026-0${i + 1}-01`),
      report: report([["KO", "mantener", "alta"]]),
    }));
    expect(buildSignalHistory(many, 6).reports.map((r) => r.id)).toEqual(["2", "3", "4", "5", "6", "7"]);
  });
});
