import { describe, expect, it } from "vitest";
import { planDca, type DcaInput, type DcaSignal } from "./dca-planner";

const base: Omit<DcaInput, "signals" | "monthlyAmountArs"> = {
  portfolioValueArs: 1_000_000,
  ccl: 1500,
  positions: [
    { ticker: "MELI", currentPct: 20, currentValue: 200_000, currentPrice: 25_000 },
    { ticker: "KO", currentPct: 10, currentValue: 100_000, currentPrice: 20_000 },
    { ticker: "BABA", currentPct: 10, currentValue: 100_000, currentPrice: 20_000 },
    { ticker: "AAPL", currentPct: 50, currentValue: 500_000, currentPrice: 0 },
    { ticker: "COCORMA", currentPct: 10, currentValue: 100_000, currentPrice: 10 },
  ],
  assets: [
    { ticker: "MELI", cedearRatio: 120, underlyingTicker: "MELI" },
    { ticker: "KO", cedearRatio: 5, underlyingTicker: "KO" },
    { ticker: "BABA", cedearRatio: 9, underlyingTicker: "BABA" },
    { ticker: "AAPL", cedearRatio: 20, underlyingTicker: "AAPL" },
    { ticker: "COCORMA", cedearRatio: null, underlyingTicker: null },
  ],
  marketPrices: { AAPL: 260 },
};
const s = (senal: DcaSignal["senal"], confianza: DcaSignal["confianza"]): DcaSignal => ({ senal, confianza });
const byTicker = (plan: ReturnType<typeof planDca>) => Object.fromEntries(plan.rows.map((r) => [r.ticker, r]));

describe("planDca", () => {
  it("reparte entre las compras ponderando por confianza y no le da nada a mantener ni venta", () => {
    const plan = planDca({
      ...base,
      monthlyAmountArs: 600_000,
      signals: { MELI: s("compra", "alta"), AAPL: s("compra", "baja"), KO: s("mantener", "alta"), BABA: s("venta", "alta") },
    });
    const r = byTicker(plan);
    expect(plan.mode).toBe("compra");
    expect(r.MELI.amountArs).toBe(450_000);
    expect(r.AAPL.amountArs).toBe(150_000);
    expect(r.KO.amountArs).toBe(0);
    expect(r.BABA.amountArs).toBe(0);
    expect(plan.unallocatedArs).toBe(0);
    expect(r.MELI.estimatedCedears).toBe(18);
    // Sin precio en el snapshot: subyacente / ratio × CCL = 260 / 20 × 1500.
    expect(r.AAPL.cedearPriceArs).toBeCloseTo(19_500);
  });

  it("no tiene tope: una sola compra se lleva todo el aporte", () => {
    const plan = planDca({ ...base, monthlyAmountArs: 600_000, signals: { KO: s("compra", "media") } });
    expect(byTicker(plan).KO.amountArs).toBe(600_000);
  });

  it("sin compras reparte en partes iguales entre las mantener", () => {
    const plan = planDca({ ...base, monthlyAmountArs: 300_000, signals: { MELI: s("mantener", "baja"), KO: s("mantener", "alta"), BABA: s("venta", "alta") } });
    const r = byTicker(plan);
    expect(plan.mode).toBe("mantener");
    expect([r.MELI.amountArs, r.KO.amountArs, r.BABA.amountArs]).toEqual([150_000, 150_000, 0]);
  });

  it("si todo es venta no asigna nada", () => {
    const plan = planDca({ ...base, monthlyAmountArs: 300_000, signals: { MELI: s("venta", "alta") } });
    expect(plan.mode).toBe("ninguna");
    expect(plan.totalAllocatedArs).toBe(0);
    expect(plan.unallocatedArs).toBe(300_000);
  });

  it("sin reporte reparte en partes iguales entre los CEDEARs, sin el FCI", () => {
    const plan = planDca({ ...base, monthlyAmountArs: 400_000, signals: null });
    expect(plan.mode).toBe("iguales");
    expect(plan.rows.map((r) => r.ticker).sort()).toEqual(["AAPL", "BABA", "KO", "MELI"]);
    expect(plan.rows.every((r) => r.amountArs === 100_000)).toBe(true);
  });
});
