import { describe, expect, it } from "vitest";
import { formatCurrency, formatDateMedium, formatDateShort, formatDateUTC, formatPct, formatUSD, formatUSDCompact } from "./format";

// Las columnas @db.Date llegan como medianoche UTC. En hora de Argentina
// (UTC−3) eso es todavía el día anterior: los formatos tienen que mostrar UTC.
const snapshotDate = new Date("2026-10-09T00:00:00.000Z");

describe("montos en dólares", () => {
  it("llevan US$ para no confundirse con pesos", () => {
    expect(formatUSD(1764)).toBe("US$ 1,764");
    expect(formatUSD(-20)).toBe("-US$ 20");
    expect(formatUSDCompact(582300)).toBe("US$ 582.3K");
    expect(formatCurrency(55.17, "USD")).toBe("US$ 55.17");
  });
});

describe("formatPct", () => {
  it("usa coma decimal y signo opcional", () => {
    expect(formatPct(37.2277, { signed: true })).toBe("+37,23 %");
    expect(formatPct(-0.5, { signed: true })).toBe("-0,50 %");
    expect(formatPct(57.76, { decimals: 1 })).toBe("57,8 %");
  });
});

describe("formatos de fecha de columnas @db.Date", () => {
  it("formatDateMedium no corre el día", () => {
    expect(formatDateMedium(snapshotDate)).toMatch(/^09 .*oct.* 2026$/);
  });

  it("formatDateShort no corre el día", () => {
    expect(formatDateShort(new Date("2024-12-31T00:00:00.000Z"))).toMatch(/^31 .*dic.* 24$/);
  });

  it("formatDateUTC acepta Date y YYYY-MM-DD", () => {
    expect(formatDateUTC(snapshotDate)).toBe(formatDateUTC("2026-10-09"));
  });
});
