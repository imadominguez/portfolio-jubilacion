// Rendimientos entre snapshots (puros, sin Prisma).
//
// Un snapshot puede valer 0 (p. ej. el primer export de una cuenta recién
// abierta) y es inmutable: no se corrige el dato, se evita usarlo como base de
// un porcentaje. Sin base positiva el rendimiento es indefinido (null), no 0 ni
// Infinity.

// Variación porcentual de `current` respecto de `base`.
export function pctChange(current: number, base: number): number | null {
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(current)) return null;
  return ((current - base) / base) * 100;
}

// Tasa anual compuesta entre dos valores separados por `years` años.
export function cagrPct(first: number, last: number, years: number): number | null {
  if (!(years > 0) || !(first > 0) || !(last >= 0)) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

// Mayor caída porcentual desde un pico previo.
export function maxDrawdownPct(values: number[]): number {
  let maxDrawdown = 0;
  let peak = values[0] ?? 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  return maxDrawdown * 100;
}

// Serie para métricas de rendimiento: arranca en el primer snapshot con valor
// positivo, que es cuando la inversión tiene una base contra la cual medir.
// Espera los snapshots ordenados por fecha ascendente.
export function performanceSeries<T extends { totalValueArs: number }>(snapshots: T[]): T[] {
  const start = snapshots.findIndex((s) => s.totalValueArs > 0);
  return start === -1 ? [] : snapshots.slice(start);
}
