import { describe, expect, it } from "vitest";
import { parseCocosNumber } from "./number-parsing";

describe("parseCocosNumber", () => {
  it("parsea formato es-AR con coma decimal y punto de miles", () => {
    expect(parseCocosNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(parseCocosNumber("$53.875,00")).toBeCloseTo(53875);
    expect(parseCocosNumber("4,2")).toBeCloseTo(4.2);
  });

  it("trata el punto de miles en enteros sin coma", () => {
    expect(parseCocosNumber("1.803.225")).toBe(1803225);
    expect(parseCocosNumber("53.875")).toBe(53875);
  });

  it("acepta punto decimal cuando no hay coma", () => {
    expect(parseCocosNumber("1234.56")).toBeCloseTo(1234.56);
    expect(parseCocosNumber("0.5")).toBeCloseTo(0.5);
  });

  it("maneja enteros, símbolos y vacíos", () => {
    expect(parseCocosNumber("11")).toBe(11);
    expect(parseCocosNumber("  $ 20.490 ")).toBe(20490);
    expect(parseCocosNumber("")).toBe(0);
    expect(parseCocosNumber("no-es-numero")).toBe(0);
  });
});
