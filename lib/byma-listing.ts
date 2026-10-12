// Listado oficial "CEDEARs Negociables en BYMA" (ADR-0024). Lógica pura: la
// descarga y la extracción del PDF viven en lib/market-refresh.ts.

export type PdfTextItem = { page: number; x: number; y: number; str: string };

export type ListingRow = {
  ticker: string;
  name: string;
  market: string;
  ratioCedear: number;
  ratioUnderlying: number;
};

export type ParsedListing = {
  version: Date | null;
  rows: ListingRow[];
  // Líneas con datos que no se pudieron interpretar (para el diagnóstico).
  skipped: string[];
};

// El nombre y el código de una misma fila llegan con ±1 punto de diferencia.
const ROW_TOLERANCE = 3;
// Margen a la izquierda del encabezado: los valores de cada columna quedan
// centrados bajo un título más ancho que ellos.
const COLUMN_MARGIN = 6;
const TICKER_RE = /^[A-Z0-9][A-Z0-9.]{0,7}$/;
const RATIO_RE = /^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/;

export const MIN_LISTING_ROWS = 300;

// El link al PDF vigente. El archivo lleva la fecha en el nombre y cambia con
// cada versión; si la página enlaza más de uno, gana el de fecha más nueva.
export function findListingPdfUrl(html: string): string | null {
  const urls = [...html.matchAll(/https?:\/\/[^"'\s<>]+?BYMA-CEDEARs\.pdf/gi)].map((m) => m[0]);
  if (urls.length === 0) return null;
  const dated = (u: string) => u.match(/(\d{4}-\d{2}-\d{2})-BYMA-CEDEARs\.pdf$/i)?.[1] ?? "";
  return [...new Set(urls)].sort((a, b) => dated(b).localeCompare(dated(a)))[0];
}

// "20:1" → { 20, 1 }; también "1:3" (un CEDEAR por cada 3 acciones).
export function parseRatio(text: string): { ratioCedear: number; ratioUnderlying: number } | null {
  const m = text.trim().match(RATIO_RE);
  if (!m) return null;
  const ratioCedear = Number(m[1].replace(",", "."));
  const ratioUnderlying = Number(m[2].replace(",", "."));
  if (!(ratioCedear > 0) || !(ratioUnderlying > 0)) return null;
  return { ratioCedear, ratioUnderlying };
}

// CEDEARs por acción del subyacente: el valor de Asset.cedearRatio.
export function ratioValue(row: Pick<ListingRow, "ratioCedear" | "ratioUnderlying">): number {
  return row.ratioCedear / row.ratioUnderlying;
}

// "Actualizado 16/09/2026" → 2026-09-16 (UTC medianoche, como @db.Date).
export function parseVersionDate(text: string): Date | null {
  const m = text.match(/Actualizado\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

type Columns = { ticker: number; market: number; ratio: number };

// Las columnas se ubican por los encabezados de cada página ("Código",
// "Mercado donde", "Ratio"): no dependen de un ancho fijo.
function columnsOf(items: PdfTextItem[]): Columns | null {
  const head = (re: RegExp) => items.find((it) => re.test(it.str.trim()))?.x;
  const ticker = head(/^Código$/i);
  const market = head(/^Mercado donde$/i);
  const ratio = head(/^Ratio\b/i);
  if (ticker === undefined || market === undefined || ratio === undefined) return null;
  if (!(ticker < market && market < ratio)) return null;
  return { ticker: ticker - COLUMN_MARGIN, market: market - COLUMN_MARGIN, ratio: ratio - COLUMN_MARGIN };
}

function groupLines(items: PdfTextItem[]): PdfTextItem[][] {
  const sorted = items.filter((it) => it.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfTextItem[][] = [];
  for (const it of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - it.y) <= ROW_TOLERANCE) line.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

// Encabezados (repetidos en cada página, a veces varias veces superpuestos) y pie.
const isHeaderOrFooter = (text: string) =>
  /^(BYMA|Cotiza|\s)+$/i.test(text) ||
  /CEDEARs Negociables|Nombre de la Compañ|^Código|Mercado donde|Ratio \(\*\)|Relación CEDEAR|Página \d|Actualizado|Bolsas y Mercados|Mercado registrado/i.test(
    text
  );

// Distancia máxima entre un fragmento (nombre o mercado partido en varias
// líneas) y la fila a la que pertenece. Las filas están a ~13 puntos entre sí.
const MAX_ATTACH = 12;

type Anchor = { y: number; ticker: string; ratioText: string; name: PdfTextItem[]; market: PdfTextItem[] };

const joinCell = (cell: PdfTextItem[]) =>
  [...cell]
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((it) => it.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

// Las filas se arman en dos pasadas. Primero las "anclas": las líneas con código
// y ratio. Después, cada fragmento suelto de las columnas de nombre o mercado se
// pega al ancla más cercana: los nombres largos ("Companhia de Saneamento…") y
// los mercados de dos palabras ("LONDON STOCK / EXCHANGE") ocupan dos líneas,
// arriba y abajo de la línea con el código.
export function parseListingItems(items: PdfTextItem[]): ParsedListing {
  const version = parseVersionDate(items.map((it) => it.str).join(" "));
  const rows = new Map<string, ListingRow>();
  const skipped: string[] = [];

  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const pageItems = items.filter((it) => it.page === page);
    const cols = columnsOf(pageItems);
    if (!cols) {
      skipped.push(`página ${page}: sin encabezados`);
      continue;
    }
    const inName = (it: PdfTextItem) => it.x < cols.ticker;
    const inTicker = (it: PdfTextItem) => it.x >= cols.ticker && it.x < cols.market;
    const inMarket = (it: PdfTextItem) => it.x >= cols.market && it.x < cols.ratio;
    const inRatio = (it: PdfTextItem) => it.x >= cols.ratio;

    const anchors: Anchor[] = [];
    const fragments: PdfTextItem[] = [];
    for (const line of groupLines(pageItems)) {
      if (isHeaderOrFooter(joinCell(line))) continue;
      const ticker = joinCell(line.filter(inTicker));
      const ratioText = joinCell(line.filter(inRatio));
      if (ticker && ratioText) {
        anchors.push({
          y: line[0].y,
          ticker,
          ratioText,
          name: line.filter(inName),
          market: line.filter(inMarket),
        });
      } else {
        fragments.push(...line);
      }
    }

    for (const frag of fragments) {
      let best: Anchor | null = null;
      for (const a of anchors) {
        const d = Math.abs(a.y - frag.y);
        if (d <= MAX_ATTACH && (!best || d < Math.abs(best.y - frag.y))) best = a;
      }
      if (!best) skipped.push(frag.str.trim());
      else if (inName(frag)) best.name.push(frag);
      else if (inMarket(frag)) best.market.push(frag);
      else skipped.push(frag.str.trim());
    }

    for (const a of anchors) {
      const name = joinCell(a.name);
      const market = joinCell(a.market);
      const ratio = parseRatio(a.ratioText);
      if (!ratio || !TICKER_RE.test(a.ticker) || !name || !market) {
        skipped.push([name, a.ticker, market, a.ratioText].filter(Boolean).join(" | "));
        continue;
      }
      // Un mismo código no se repite en el listado; si pasara, queda el primero.
      if (!rows.has(a.ticker)) rows.set(a.ticker, { ticker: a.ticker, name, market, ...ratio });
    }
  }

  return { version, rows: [...rows.values()], skipped };
}

export type ListingValidation = { ok: true } | { ok: false; error: string };

// Un listado que no pasa esto no reemplaza al guardado: es preferible un ratio
// de la versión anterior a un listado a medias.
export function validateListing(listing: ParsedListing, minRows = MIN_LISTING_ROWS): ListingValidation {
  if (!listing.version) return { ok: false, error: "El PDF no trae la fecha de actualización." };
  if (listing.rows.length < minRows) {
    return {
      ok: false,
      error: `Se interpretaron ${listing.rows.length} CEDEARs (se esperaban al menos ${minRows}): el formato del PDF pudo haber cambiado.`,
    };
  }
  return { ok: true };
}
