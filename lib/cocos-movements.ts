// Parser puro del CSV de movimientos de Cocos Capital.
//
// No usa Prisma ni APIs del servidor: puede ejecutarse tanto en el cliente
// (para la previsualización) como en la Server Action de importación.
//
// Responsabilidad: transformar cada fila del CSV en un ParsedMovement
// categorizado y normalizado. No decide qué persiste ni deduplica; eso es
// responsabilidad de la Server Action.

export type MovementCategory =
  | "TRADE_BUY"
  | "TRADE_SELL"
  | "FCI_SUBSCRIPTION"
  | "FCI_REDEMPTION"
  | "PAYMENT"
  | "RECEIPT"
  | "DIVIDEND"
  | "DIVIDEND_IN_KIND"
  | "CONVERSION"
  | "OTHER";

export type MovementCurrency = "ARS" | "USD";

export type ParsedMovement = {
  nroTicket: string;
  nroComprobante: string | null;
  date: string; // YYYY-MM-DD
  settlementDate: string | null; // YYYY-MM-DD
  rawType: string;
  category: MovementCategory;
  instrument: string | null;
  ticker: string | null;
  currency: MovementCurrency;
  market: string | null;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  commission: number | null;
  ddmm: number | null;
  iva: number | null;
  other: number | null;
  total: number;
};

export type ParseMovementsResult =
  | {
      success: true;
      movements: ParsedMovement[];
      counts: Record<MovementCategory, number>;
      warnings: string[];
    }
  | { success: false; error: string };

// Sólo estas categorías generan una Transaction (con ticker válido).
export const TRADE_CATEGORIES: ReadonlySet<MovementCategory> = new Set([
  "TRADE_BUY",
  "TRADE_SELL",
]);

export function isTradeCategory(category: MovementCategory): boolean {
  return TRADE_CATEGORIES.has(category);
}

export const ALL_CATEGORIES: readonly MovementCategory[] = [
  "TRADE_BUY",
  "TRADE_SELL",
  "FCI_SUBSCRIPTION",
  "FCI_REDEMPTION",
  "PAYMENT",
  "RECEIPT",
  "DIVIDEND",
  "DIVIDEND_IN_KIND",
  "CONVERSION",
  "OTHER",
];

export const CATEGORY_LABELS: Record<MovementCategory, string> = {
  TRADE_BUY: "Compras",
  TRADE_SELL: "Ventas",
  FCI_SUBSCRIPTION: "Suscripciones FCI",
  FCI_REDEMPTION: "Rescates FCI",
  PAYMENT: "Pagos",
  RECEIPT: "Cobros",
  DIVIDEND: "Dividendos",
  DIVIDEND_IN_KIND: "Dividendos en especie",
  CONVERSION: "Conversiones",
  OTHER: "Otros",
};

// Mapa explícito tipoOperacion -> categoría. Reemplaza las heurísticas de
// substring previas, que descartaban operaciones válidas (ej: "Registracion").
const CATEGORY_BY_TYPE: Record<string, MovementCategory> = {
  compra: "TRADE_BUY",
  venta: "TRADE_SELL",
  "compra dolar mep": "TRADE_BUY",
  "venta dolar mep": "TRADE_SELL",
  "compra registracion ars": "TRADE_BUY",
  "venta registracion usd": "TRADE_SELL",
  "liquidacion suscripcion fci": "FCI_SUBSCRIPTION",
  "liquidacion rescate fci": "FCI_REDEMPTION",
  "orden de pago": "PAYMENT",
  "orden de pago usd": "PAYMENT",
  "recibo de cobro": "RECEIPT",
  dividendos: "DIVIDEND",
  "dividendos en especie": "DIVIDEND_IN_KIND",
  "nota de credito conversion": "CONVERSION",
};

export function classifyTipoOperacion(rawType: string): MovementCategory | null {
  const key = rawType.trim().toLowerCase();
  return CATEGORY_BY_TYPE[key] ?? null;
}

// "08-04-2025" -> "2025-04-08"; null si no es válida.
export function parseDateDDMMYYYY(raw: string): string | null {
  const parts = raw.trim().split("-");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!/^\d{1,2}$/.test(dd) || !/^\d{1,2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return null;
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Números en formato argentino (punto = miles, coma = decimal).
// Vacío o inválido -> null (no 0, para no falsear datos ausentes).
export function parseArNumber(raw: string | undefined | null): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function extractTicker(instrumento: string): string | null {
  const match = instrumento.match(/\(([A-Z0-9]+)\)/);
  return match ? match[1] : null;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function cleanCell(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map(cleanCell);
}

export function parseMovementCsv(csvText: string): ParseMovementsResult {
  try {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { success: false, error: "El archivo está vacío o no tiene filas de datos." };
    }

    const headerLine = lines[0].replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(headerLine);
    const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

    const idx = {
      nroTicket: headers.indexOf("nroticket"),
      nroComprobante: headers.indexOf("nrocomprobante"),
      fechaEjecucion: headers.indexOf("fechaejecucion"),
      fechaLiquidacion: headers.indexOf("fechaliquidacion"),
      tipoOperacion: headers.indexOf("tipooperacion"),
      instrumento: headers.indexOf("instrumento"),
      moneda: headers.indexOf("moneda"),
      mercado: headers.indexOf("mercado"),
      cantidad: headers.indexOf("cantidad"),
      precio: headers.indexOf("precio"),
      montoBruto: headers.indexOf("montobruto"),
      comision: headers.indexOf("comision"),
      ddmm: headers.indexOf("ddmm"),
      iva: headers.indexOf("iva"),
      otros: headers.indexOf("otros"),
      total: headers.indexOf("total"),
    };

    if (idx.nroTicket === -1 || idx.tipoOperacion === -1 || idx.total === -1) {
      return {
        success: false,
        error: `Columnas no reconocidas. ¿Es un CSV de movimientos de Cocos Capital? Columnas encontradas: ${headers.join(", ")}`,
      };
    }

    const movements: ParsedMovement[] = [];
    const counts = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<
      MovementCategory,
      number
    >;
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i], delimiter);
      const get = (colIdx: number) => (colIdx !== -1 ? cols[colIdx] ?? "" : "");

      const nroTicket = cleanCell(get(idx.nroTicket));
      if (!nroTicket) {
        warnings.push(`Fila ${i + 1}: sin nroTicket, se omite.`);
        continue;
      }

      const rawType = cleanCell(get(idx.tipoOperacion));
      let category = classifyTipoOperacion(rawType);
      if (!category) {
        category = "OTHER";
        warnings.push(`Fila ${i + 1}: tipo de operación no reconocido "${rawType}" (categorizado como Otros).`);
      }

      const date = parseDateDDMMYYYY(get(idx.fechaEjecucion));
      if (!date) {
        warnings.push(`Fila ${i + 1} (${rawType}): fecha inválida "${get(idx.fechaEjecucion)}", se omite.`);
        continue;
      }

      const settlementDateRaw = get(idx.fechaLiquidacion);
      const settlementDate = settlementDateRaw ? parseDateDDMMYYYY(settlementDateRaw) : null;

      const instrument = cleanCell(get(idx.instrumento)) || null;
      const ticker = instrument ? extractTicker(instrument) : null;

      const currency: MovementCurrency =
        cleanCell(get(idx.moneda)).toUpperCase() === "USD" ? "USD" : "ARS";

      const grossAmount = parseArNumber(get(idx.montoBruto));
      const totalRaw = parseArNumber(get(idx.total));
      const total = totalRaw ?? grossAmount ?? 0;

      if (isTradeCategory(category) && !ticker) {
        warnings.push(
          `Fila ${i + 1} (${rawType}): sin ticker en "${instrument ?? ""}", no generará transacción.`
        );
      }

      movements.push({
        nroTicket,
        nroComprobante: cleanCell(get(idx.nroComprobante)) || null,
        date,
        settlementDate,
        rawType,
        category,
        instrument,
        ticker,
        currency,
        market: cleanCell(get(idx.mercado)) || null,
        quantity: parseArNumber(get(idx.cantidad)),
        price: parseArNumber(get(idx.precio)),
        grossAmount,
        commission: parseArNumber(get(idx.comision)),
        ddmm: parseArNumber(get(idx.ddmm)),
        iva: parseArNumber(get(idx.iva)),
        other: parseArNumber(get(idx.otros)),
        total,
      });

      counts[category]++;
    }

    return { success: true, movements, counts, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado al parsear el archivo.";
    return { success: false, error: message };
  }
}
