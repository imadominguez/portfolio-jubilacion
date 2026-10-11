import { formatPct } from "@/lib/format";

export function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return formatPct(v, { signed: true });
}

export function signColor(v: number | null): string {
  if (v === null) return "text-foreground";
  return v >= 0 ? "text-success" : "text-destructive";
}
