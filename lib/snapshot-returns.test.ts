import { describe, expect, it } from "vitest";
import { cagrPct, maxDrawdownPct, pctChange, performanceSeries } from "./snapshot-returns";

describe("pctChange", () => {
  it("calcula la variación respecto de la base", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(90, 100)).toBeCloseTo(-10);
  });

  it("devuelve null con base 0, negativa o no finita (no Infinity)", () => {
    expect(pctChange(326251, 0)).toBeNull();
    expect(pctChange(100, -5)).toBeNull();
    expect(pctChange(100, Number.NaN)).toBeNull();
    expect(pctChange(Number.NaN, 100)).toBeNull();
  });
});

describe("cagrPct", () => {
  it("compone la tasa anual", () => {
    expect(cagrPct(100, 121, 2)).toBeCloseTo(10);
    expect(cagrPct(100, 81, 2)).toBeCloseTo(-10);
  });

  it("devuelve null sin base positiva o sin período", () => {
    expect(cagrPct(0, 2814068, 2.75)).toBeNull();
    expect(cagrPct(100, 120, 0)).toBeNull();
    expect(cagrPct(100, 120, -1)).toBeNull();
  });

  it("acepta un valor final 0 (pérdida total)", () => {
    expect(cagrPct(100, 0, 1)).toBeCloseTo(-100);
  });
});

describe("maxDrawdownPct", () => {
  it("mide la mayor caída desde un pico", () => {
    expect(maxDrawdownPct([100, 120, 90, 130, 117])).toBeCloseTo(25);
  });

  it("no divide por un pico 0", () => {
    expect(maxDrawdownPct([0, 0, 100, 80])).toBeCloseTo(20);
    expect(maxDrawdownPct([])).toBe(0);
  });
});

describe("performanceSeries", () => {
  const s = (totalValueArs: number) => ({ totalValueArs });

  it("arranca en el primer snapshot con valor positivo", () => {
    expect(performanceSeries([s(0), s(326251), s(0), s(1674246)])).toEqual([
      s(326251),
      s(0),
      s(1674246),
    ]);
  });

  it("devuelve la serie entera si arranca con valor y vacío si nunca lo tiene", () => {
    expect(performanceSeries([s(10), s(20)])).toEqual([s(10), s(20)]);
    expect(performanceSeries([s(0), s(0)])).toEqual([]);
    expect(performanceSeries([])).toEqual([]);
  });
});
