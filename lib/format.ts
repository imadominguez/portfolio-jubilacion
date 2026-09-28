// Formatters centralizados. Las instancias de Intl se crean una sola vez.
// Regla del proyecto: locale "es-AR" para números/fechas, "en-US" para USD.

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ARS_COMPACT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const DATE_LONG = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const DATE_MEDIUM = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_SHORT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

// Fechas de columnas @db.Date: Prisma las materializa como UTC midnight.
// Sin timeZone explícito, en UTC-3 se mostraría el día anterior.
const DATE_UTC = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatARS(value: number): string {
  return ARS.format(value);
}

export function formatUSD(value: number): string {
  return USD.format(value);
}

export function formatARSCompact(value: number): string {
  return ARS_COMPACT.format(value);
}

export function formatUSDCompact(value: number): string {
  return USD_COMPACT.format(value);
}

// Monto con decimales y locale según la moneda (USD → en-US, resto → es-AR).
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateLong(value: Date | string): string {
  return DATE_LONG.format(new Date(value));
}

export function formatDateMedium(value: Date | string): string {
  return DATE_MEDIUM.format(new Date(value));
}

export function formatDateShort(value: Date | string): string {
  return DATE_SHORT.format(new Date(value));
}

// Acepta Date (UTC midnight) o "YYYY-MM-DD" puro y lo muestra en UTC.
export function formatDateUTC(value: Date | string): string {
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`)
      : new Date(value);
  return DATE_UTC.format(date);
}

export function formatDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value));
}
