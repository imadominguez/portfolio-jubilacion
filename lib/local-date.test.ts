import { describe, expect, it } from "vitest";
import { ageLabel, daysSince, localDateParts } from "./local-date";

describe("daysSince", () => {
  it("cuenta días entre una fecha @db.Date y el día local", () => {
    expect(daysSince(new Date("2026-10-09T00:00:00Z"), { year: 2026, month: 10, day: 11 })).toBe(2);
    expect(daysSince(new Date("2026-10-11T00:00:00Z"), { year: 2026, month: 10, day: 11 })).toBe(0);
  });

  it("usa el día de Argentina aunque en UTC ya sea el siguiente", () => {
    // 23:30 del 11/10 en Argentina = 02:30 UTC del 12/10.
    const today = localDateParts(new Date("2026-10-12T02:30:00Z"));
    expect(today).toEqual({ year: 2026, month: 10, day: 11 });
    expect(daysSince(new Date("2026-10-11T00:00:00Z"), today)).toBe(0);
  });
});

describe("ageLabel", () => {
  it("nombra la antigüedad en palabras", () => {
    expect(ageLabel(0)).toBe("hoy");
    expect(ageLabel(1)).toBe("ayer");
    expect(ageLabel(12)).toBe("hace 12 días");
  });
});
