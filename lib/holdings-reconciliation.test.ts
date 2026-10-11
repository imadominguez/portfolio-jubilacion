import { describe, expect, it } from "vitest";
import { reconcileHoldings } from "./holdings-reconciliation";
import type { RatioChange } from "./ratio-changes";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const split: RatioChange = { ticker: "AAA", effectiveDate: d("2026-06-01"), oldRatio: 20, newRatio: 60 };
const aaaBuys = [
  { ticker: "AAA", type: "BUY" as const, date: d("2024-05-10"), quantity: 3 },
  { ticker: "AAA", type: "BUY" as const, date: d("2025-08-20"), quantity: 1 },
];
const base = { tickers: new Set(["AAA", "BBB"]), changes: [] as RatioChange[], asOf: d("2026-10-01") };

describe("reconcileHoldings", () => {
  it("detecta un split sin registrar como múltiplo exacto", () => {
    const res = reconcileHoldings({ ...base, holdings: [{ ticker: "AAA", quantity: 12 }], trades: aaaBuys });
    expect(res).toEqual([{ ticker: "AAA", holding: 12, ledger: 4, likelySplitFactor: 3 }]);
  });

  it("no avisa si el split ya está registrado", () => {
    const res = reconcileHoldings({ ...base, changes: [split], holdings: [{ ticker: "AAA", quantity: 12 }], trades: aaaBuys });
    expect(res).toEqual([]);
  });

  it("compara un snapshot anterior al split en CEDEARs de su fecha", () => {
    const res = reconcileHoldings({
      ...base,
      changes: [split],
      asOf: d("2025-12-31"),
      holdings: [{ ticker: "AAA", quantity: 4 }],
      trades: aaaBuys,
    });
    expect(res).toEqual([]);
  });

  it("ignora operaciones posteriores a la fecha y tickers fuera de la lista", () => {
    const res = reconcileHoldings({
      ...base,
      asOf: d("2025-01-01"),
      holdings: [{ ticker: "AAA", quantity: 3 }, { ticker: "BONO", quantity: 100 }],
      trades: aaaBuys,
    });
    expect(res).toEqual([]);
  });

  it("una diferencia que no es múltiplo exacto no se marca como split", () => {
    const res = reconcileHoldings({
      ...base,
      holdings: [{ ticker: "BBB", quantity: 7 }],
      trades: [{ ticker: "BBB", type: "BUY", date: d("2024-02-01"), quantity: 5 }],
    });
    expect(res).toEqual([{ ticker: "BBB", holding: 7, ledger: 5, likelySplitFactor: null }]);
  });

  it("avisa de un CEDEAR del libro que no está en la tenencia, con ventas en negativo", () => {
    const res = reconcileHoldings({
      ...base,
      holdings: [],
      trades: [
        { ticker: "BBB", type: "BUY", date: d("2024-02-01"), quantity: 5 },
        { ticker: "BBB", type: "SELL", date: d("2025-01-01"), quantity: -2 },
      ],
    });
    expect(res).toEqual([{ ticker: "BBB", holding: 0, ledger: 3, likelySplitFactor: null }]);
  });
});
