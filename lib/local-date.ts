// Fecha local de Argentina. El servidor corre en UTC, y a la noche ya es el
// día (o el mes) siguiente: los cortes por día y por mes se toman en hora local.

export const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type LocalDate = { year: number; month: number; day: number };

// { year, month (1-12), day } de `now` en la zona horaria dada.
export function localDateParts(now: Date, timeZone = AR_TIME_ZONE): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// "AAAA-MM" del mes local.
export function monthKeyOf({ year, month }: LocalDate): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Mes anterior o siguiente de una clave "AAAA-MM".
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "AAAA-MM" → "octubre 2026".
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}
