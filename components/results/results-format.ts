import type { Money } from "@/lib/ticker-results";
import { formatARS, formatARSCompact, formatPct, formatUSD, formatUSDCompact } from "@/lib/format";

export type Currency = "ARS" | "USD";

export const pick = (m: Money | { ars: number | null; usd: number | null }, c: Currency): number | null =>
  c === "ARS" ? m.ars : m.usd;

export function fmtMoney(v: number | null, c: Currency): string {
  if (v === null) return "—";
  return c === "ARS" ? formatARS(v) : formatUSD(v);
}

export function fmtCompact(v: number, c: Currency): string {
  return c === "ARS" ? formatARSCompact(v) : formatUSDCompact(v);
}

export function fmtSignedPct(v: number | null): string {
  return v === null ? "—" : formatPct(v * 100, { signed: true });
}

export function toneClass(v: number | null): string {
  if (v === null || Math.abs(v) < 0.005) return "text-foreground";
  return v > 0 ? "text-success" : "text-destructive";
}

export function fmtQty(v: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(v);
}
