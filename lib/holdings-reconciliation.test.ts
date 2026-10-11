import { describe, expect, it } from "vitest";
import { reconcileHoldings } from "./holdings-reconciliation";
import type { RatioChange } from "./ratio-changes";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const spy: RatioChange = { ticker: "SPY", effectiveDate: d("2026-06-01"), oldRatio: 20, newRatio: 60 };
const spyBuys = [
  { ticker: "SPY", type: "BUY" as const, date: d("2024-09-23"), quantity: 5 },
  { ticker: "SPY", type: "BUY" as const, date: d("2025-10-06"), quantity: 2 },
];
const base = { tickers: new Set(["SPY", "NVDA"]), changes: [] as RatioChange[], asOf: d("2026-10-09") };

describe("reconcileHoldings", () => {
  it("detecta un split sin registrar como múltiplo exacto", () => {
    const res = reconcileHoldings({ ...base, holdings: [{ ticker: "SPY", quantity: 21 }], trades: spyBuys });
    expect(res).toEqual([{ ticker: "SPY", holding: 21, ledger: 7, likelySplitFactor: 3 }]);
  });

  it("no avisa si el split ya está registrado", () => {
    const res = reconcileHoldings({ ...base, changes: [spy], holdings: [{ ticker: "SPY", quantity: 21 }], trades: spyBuys });
    expect(res).toEqual([]);
  });

  it("compara un snapshot anterior al split en CEDEARs de su fecha", () => {
    const res = reconcileHoldings({
      ...base,
      changes: [spy],
      asOf: d("2025-12-31"),
      holdings: [{ ticker: "SPY", quantity: 7 }],
      trades: spyBuys,
    });
    expect(res).toEqual([]);
  });

  it("ignora operaciones posteriores a la fecha y tickers fuera de la lista", () => {
    const res = reconcileHoldings({
      ...base,
      asOf: d("2025-01-01"),
      holdings: [{ ticker: "SPY", quantity: 5 }, { ticker: "AL30", quantity: 100 }],
      trades: spyBuys,
    });
    expect(res).toEqual([]);
  });

  it("una diferencia que no es múltiplo exacto no se marca como split", () => {
    const res = reconcileHoldings({
      ...base,
      holdings: [{ ticker: "NVDA", quantity: 15 }],
      trades: [{ ticker: "NVDA", type: "BUY", date: d("2024-10-01"), quantity: 11 }],
    });
    expect(res).toEqual([{ ticker: "NVDA", holding: 15, ledger: 11, likelySplitFactor: null }]);
  });

  it("avisa de un CEDEAR del libro que no está en la tenencia, con ventas en negativo", () => {
    const res = reconcileHoldings({
      ...base,
      holdings: [],
      trades: [
        { ticker: "NVDA", type: "BUY", date: d("2024-10-01"), quantity: 11 },
        { ticker: "NVDA", type: "SELL", date: d("2025-01-01"), quantity: -5 },
      ],
    });
    expect(res).toEqual([{ ticker: "NVDA", holding: 0, ledger: 6, likelySplitFactor: null }]);
  });
});
