export function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function signColor(v: number | null): string {
  if (v === null) return "text-foreground";
  return v >= 0 ? "text-success" : "text-destructive";
}
