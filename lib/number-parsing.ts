// Parseo de números en formato Cocos Capital / es-AR.
// Punto = separador de miles, coma = decimal. También acepta punto decimal
// cuando no hay coma (ej: "1234.56").
export function parseCocosNumber(raw: string): number {
  const cleaned = raw.trim().replace(/[$ ]/g, "");
  if (cleaned === "") return 0;

  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = cleaned.match(/\./g)?.length ?? 0;
    const looksDecimal = dots === 1 && !/\.\d{3}$/.test(cleaned);
    normalized = looksDecimal || dots === 0 ? cleaned : cleaned.replace(/\./g, "");
  }

  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
