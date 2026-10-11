import { describe, expect, it } from "vitest";
import { formatDateMedium, formatDateShort, formatDateUTC } from "./format";

// Las columnas @db.Date llegan como medianoche UTC. En hora de Argentina
// (UTC−3) eso es todavía el día anterior: los formatos tienen que mostrar UTC.
const snapshotDate = new Date("2026-10-09T00:00:00.000Z");

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
