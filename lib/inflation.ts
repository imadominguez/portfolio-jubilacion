// Cálculos de inflación y rendimiento real (puros, sin Prisma).

export type RatePoint = { date: Date; ratePct: number };
export type IndexPoint = { date: Date; value: number };

// Convierte una serie de tasas mensuales (%) en un índice acumulado base `base`.
// Ej: +10% y +10% → 100 → 110 → 121.
export function buildCumulativeIndex(rows: RatePoint[], base = 100): IndexPoint[] {
  const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  let level = base;
  return sorted.map((r) => {
    level = level * (1 + r.ratePct / 100);
    return { date: r.date, value: level };
  });
}

// Lleva un porcentaje total de un período a tasa anual compuesta.
export function annualize(totalPct: number, years: number): number {
  if (years <= 0) return 0;
  return (Math.pow(1 + totalPct / 100, 1 / years) - 1) * 100;
}

// Rendimiento real: descuenta la inflación del rendimiento nominal.
export function realReturnPct(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

// Valor del índice en (o antes de) una fecha. Si la fecha es anterior al primer
// punto, devuelve el primero (base).
export function indexValueAt(points: IndexPoint[], date: Date): number | null {
  if (points.length === 0) return null;
  let best: IndexPoint | null = null;
  for (const p of points) {
    if (p.date.getTime() <= date.getTime()) {
      if (!best || p.date.getTime() > best.date.getTime()) best = p;
    }
  }
  return (best ?? points[0]).value;
}

// Variación % del índice entre dos fechas (para medir inflación del período).
export function indexChangePct(
  points: IndexPoint[],
  from: Date,
  to: Date
): number | null {
  const a = indexValueAt(points, from);
  const b = indexValueAt(points, to);
  if (a === null || b === null || a <= 0) return null;
  return (b / a - 1) * 100;
}
