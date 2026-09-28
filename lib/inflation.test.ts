import { describe, expect, it } from "vitest";
import {
  annualize,
  buildCumulativeIndex,
  indexChangePct,
  indexValueAt,
  realReturnPct,
} from "./inflation";

describe("buildCumulativeIndex", () => {
  it("compone tasas mensuales sobre base 100", () => {
    const idx = buildCumulativeIndex([
      { date: new Date("2026-01-31"), ratePct: 10 },
      { date: new Date("2026-02-28"), ratePct: 10 },
    ]);
    expect(idx[0].value).toBeCloseTo(110);
    expect(idx[1].value).toBeCloseTo(121);
  });

  it("maneja deflación", () => {
    const idx = buildCumulativeIndex([{ date: new Date("2026-01-31"), ratePct: -5 }]);
    expect(idx[0].value).toBeCloseTo(95);
  });

  it("ordena por fecha y devuelve vacío sin datos", () => {
    expect(buildCumulativeIndex([])).toEqual([]);
    const idx = buildCumulativeIndex([
      { date: new Date("2026-02-28"), ratePct: 10 },
      { date: new Date("2026-01-31"), ratePct: 10 },
    ]);
    expect(idx[0].date.toISOString()).toContain("2026-01-31");
  });
});

describe("realReturnPct", () => {
  it("descuenta la inflación del nominal", () => {
    expect(realReturnPct(8, 5)).toBeCloseTo(2.857, 2);
  });

  it("sin inflación es igual al nominal", () => {
    expect(realReturnPct(12, 0)).toBeCloseTo(12);
  });

  it("nominal menor a inflación da real negativo", () => {
    expect(realReturnPct(3, 10)).toBeLessThan(0);
  });
});

describe("annualize", () => {
  it("anualiza un total de 2 años", () => {
    expect(annualize(21, 2)).toBeCloseTo(10, 2);
  });

  it("devuelve 0 si el período es 0", () => {
    expect(annualize(50, 0)).toBe(0);
  });
});

describe("indexValueAt / indexChangePct", () => {
  const points = [
    { date: new Date("2026-01-31"), value: 100 },
    { date: new Date("2026-02-28"), value: 110 },
    { date: new Date("2026-03-31"), value: 121 },
  ];

  it("toma el punto más cercano hacia atrás", () => {
    expect(indexValueAt(points, new Date("2026-03-15"))).toBe(110);
  });

  it("si la fecha es anterior al primer punto usa el primero", () => {
    expect(indexValueAt(points, new Date("2025-12-01"))).toBe(100);
  });

  it("calcula la variación entre dos fechas", () => {
    expect(
      indexChangePct(points, new Date("2026-01-31"), new Date("2026-03-31"))
    ).toBeCloseTo(21);
  });

  it("devuelve null sin datos", () => {
    expect(indexValueAt([], new Date())).toBeNull();
    expect(indexChangePct([], new Date(), new Date())).toBeNull();
  });
});
