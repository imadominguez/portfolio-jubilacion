// Resolución de un activo nuevo a partir del snapshot, el listado de BYMA y
// Yahoo (ADR-0025). Lógica pura: las consultas y la cola viven en
// lib/asset-requests-runner.ts.

export type InstrumentKind = "CEDEAR" | "FCI" | "OTHER";

// El nombre del CSV de Cocos dice qué es: "CEDEAR APPLE INC. (AAPL)",
// "FCI COCOS AHORRO CL.A U$S ESC. (COCOAUSD)", "BCO DE VALORES ACC ORD… (VALO)".
export function classifyInstrument(instrumentName: string | null): InstrumentKind {
  const name = (instrumentName ?? "").trim().toUpperCase();
  if (name.startsWith("CEDEAR")) return "CEDEAR";
  if (name.startsWith("FCI")) return "FCI";
  return "OTHER";
}

// "CEDEAR DE WAL-MART INC. (WMT)" → "WAL-MART INC.". Para buscar en Yahoo y
// comparar con el nombre del listado.
export function cleanInstrumentName(instrumentName: string | null): string {
  return (instrumentName ?? "")
    .replace(/^\s*(CEDEAR|FCI)\s+(DE\s+)?/i, "")
    .replace(/(\s*\([A-Z0-9.]+\))+\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_NOISE = new Set([
  "INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "PLC", "SA", "S", "A", "NV", "AG", "SE",
  "HOLDING", "HOLDINGS", "GROUP", "THE", "DE", "CL", "CLASS", "ADR", "SPONSORED", "TR", "TRUST", "ETF",
  // "BP PCL" en BYMA y "BP p.l.c." en Yahoo.
  "CAYMAN", "ISLANDS", "PCL", "P", "L", "C",
]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^A-Z0-9]+/)
      .filter((t) => t && !NAME_NOISE.has(t))
  );
}

// Parecido entre dos nombres de empresa (0 a 1): proporción de palabras
// significativas del más corto que aparecen en el otro.
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  // "ExxonMobil" y "Exxon Mobil": las mismas letras con o sin espacio.
  const ca = [...ta].join("");
  const cb = [...tb].join("");
  if (ca === cb || (Math.min(ca.length, cb.length) >= 6 && (ca.includes(cb) || cb.includes(ca)))) return 1;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let hits = 0;
  for (const t of small) if (big.has(t)) hits++;
  return hits / small.size;
}

export const NAME_MATCH_THRESHOLD = 0.6;

export type ListingEntry = { ticker: string; name: string; market: string; ratio: number };

// Si el código no figura en el listado (BYMA publica Nu Holdings como "UN" y
// Cocos lo opera como "NU"), se busca la fila por nombre. Solo cuenta si hay
// una única coincidencia clara.
export function findListingByName(name: string, listing: ListingEntry[]): ListingEntry | null {
  const scored = listing
    .map((l) => ({ l, score: nameSimilarity(name, l.name) }))
    .filter((x) => x.score >= NAME_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[1].score === scored[0].score) return null;
  return scored[0].l;
}

// Mercados del listado de BYMA que Yahoo cotiza en dólares de EE.UU.: la app
// asume precios en USD, así que solo estos se pueden dar de alta solos.
const US_MARKETS: Record<string, string[]> = {
  NASDAQ: ["NMS", "NGM", "NCM", "NAS"],
  "NASDAQ GS": ["NMS"],
  "NASDAQ GM": ["NGM", "NMS"],
  "NASDAQ CM": ["NCM", "NMS"],
  NYSE: ["NYQ", "NYS"],
  "NYSE ARCA": ["PCX", "NYQ"],
  "NYSE AMERICAN": ["ASE"],
  CBOE: ["BTS", "PCX"],
};

export function isUsMarket(market: string): boolean {
  return market.trim().toUpperCase() in US_MARKETS;
}

export type SymbolCandidate = { symbol: string; exchange: string; quoteType: string; name: string };

// Subyacente entre los resultados de Yahoo: una acción o ETF de la bolsa que
// dice el listado y con un nombre parecido. Se prefiere el mismo ticker y sus
// variantes de clase (BRKB → BRK-B).
export function pickUnderlying(
  candidates: SymbolCandidate[],
  { ticker, name, market }: { ticker: string; name: string; market: string }
): SymbolCandidate | null {
  const exchanges = US_MARKETS[market.trim().toUpperCase()];
  if (!exchanges) return null;
  const variants = new Set([ticker, ticker.replace(/([A-Z]+)([AB])$/, "$1-$2"), ticker.replace(/\./g, "-")]);
  const valid = candidates.filter(
    (c) => exchanges.includes(c.exchange) && (c.quoteType === "EQUITY" || c.quoteType === "ETF")
  );
  const sameTicker = valid.find((c) => variants.has(c.symbol));
  if (sameTicker && nameSimilarity(sameTicker.name, name) >= NAME_MATCH_THRESHOLD) return sameTicker;
  const byName = valid
    .map((c) => ({ c, score: nameSimilarity(c.name, name) }))
    .filter((x) => x.score >= NAME_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  return byName[0]?.c ?? null;
}

// Ratio implícito en el precio del snapshot: cuántos CEDEARs vale una acción.
// Un CEDEAR en pesos se lleva a dólares con el CCL del snapshot.
export function impliedRatio({
  underlyingUsd,
  cedearPrice,
  cedearCurrency,
  ccl,
}: {
  underlyingUsd: number;
  cedearPrice: number;
  cedearCurrency: "ARS" | "USD";
  ccl: number | null;
}): number | null {
  if (!(underlyingUsd > 0) || !(cedearPrice > 0)) return null;
  const cedearUsd = cedearCurrency === "USD" ? cedearPrice : ccl && ccl > 0 ? cedearPrice / ccl : null;
  return cedearUsd ? underlyingUsd / cedearUsd : null;
}

// El CCL implícito de cada CEDEAR difiere unos puntos del general: 10 % de
// margen alcanza para eso y descarta un ratio equivocado (los ratios vecinos
// difieren mucho más).
export const RATIO_TOLERANCE = 0.1;

export function ratioMatches(official: number, implied: number | null, tolerance = RATIO_TOLERANCE): boolean {
  return implied !== null && official > 0 && Math.abs(implied - official) / official <= tolerance;
}

// Sectores y países con los nombres que usa el catálogo (en castellano).
const SECTORS: Record<string, string> = {
  Technology: "Tecnología",
  "Consumer Cyclical": "Consumo Cíclico",
  "Consumer Defensive": "Consumo Básico",
  Healthcare: "Salud",
  Energy: "Energía",
  "Financial Services": "Financiero",
  "Real Estate": "Inmobiliario",
  "Communication Services": "Comunicaciones",
  Industrials: "Industrial",
  "Basic Materials": "Materiales",
  Utilities: "Servicios Públicos",
};

const COUNTRIES: Record<string, string> = {
  "United States": "Estados Unidos",
  Brazil: "Brasil",
  "United Kingdom": "Reino Unido",
  Netherlands: "Países Bajos",
  Canada: "Canadá",
  Japan: "Japón",
  Germany: "Alemania",
  France: "Francia",
  Switzerland: "Suiza",
  Ireland: "Irlanda",
  Mexico: "México",
  "South Korea": "Corea del Sur",
  Spain: "España",
  Italy: "Italia",
  Belgium: "Bélgica",
  Denmark: "Dinamarca",
  Sweden: "Suecia",
  Singapore: "Singapur",
};

export function translateSector(sector: string | null, quoteType: string | null): string | null {
  if (quoteType === "ETF") return "ETF / Índice";
  return sector ? (SECTORS[sector] ?? sector) : null;
}

export function translateCountry(country: string | null): string | null {
  return country ? (COUNTRIES[country] ?? country) : null;
}

export type Check = { id: string; ok: boolean; detail: string };

export type AssetProposal = {
  kind: InstrumentKind;
  name: string;
  // Lo que se cargaría en Asset (el admin lo puede corregir antes de aprobar).
  cedearRatio: number | null;
  underlyingTicker: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  // Fila del listado usada para el ratio (el código puede diferir del ticker).
  listingTicker: string | null;
  checks: Check[];
  // Pasó todos los controles: el PR 3 lo da de alta sin revisión.
  autoEligible: boolean;
};

export type ResolutionInput = {
  ticker: string;
  instrumentName: string | null;
  listing: ListingEntry | null;
  listingMatchedByName: boolean;
  underlying: SymbolCandidate | null;
  profile: { sector: string | null; industry: string | null; country: string | null; quoteType: string | null } | null;
  impliedRatio: number | null;
};

// Arma la propuesta y explica cada control en castellano, para que el admin
// vea por qué no se dio de alta sola.
export function buildProposal(input: ResolutionInput): AssetProposal {
  const kind = classifyInstrument(input.instrumentName);
  const name = cleanInstrumentName(input.instrumentName) || input.ticker;

  if (kind !== "CEDEAR") {
    return {
      kind,
      name,
      cedearRatio: 1,
      underlyingTicker: null,
      sector: null,
      industry: null,
      country: null,
      listingTicker: null,
      checks: [
        {
          id: "tipo",
          ok: true,
          detail: kind === "FCI" ? "Es un fondo (FCI): no cotiza en Yahoo." : "No es un CEDEAR: se da de alta sin precio externo.",
        },
      ],
      autoEligible: true,
    };
  }

  const checks: Check[] = [];
  const { listing } = input;
  checks.push(
    listing
      ? {
          id: "listado",
          ok: true,
          detail: input.listingMatchedByName
            ? `Figura en el listado de BYMA como ${listing.ticker} (por nombre): ratio ${listing.ratio}.`
            : `Ratio ${listing.ratio} según el listado de BYMA.`,
        }
      : { id: "listado", ok: false, detail: "No figura en el listado de BYMA." }
  );
  if (listing) {
    checks.push(
      isUsMarket(listing.market)
        ? { id: "mercado", ok: true, detail: `Cotiza en ${listing.market}.` }
        : { id: "mercado", ok: false, detail: `Cotiza en ${listing.market}: el precio no está en dólares de EE.UU.` }
    );
  }
  checks.push(
    input.underlying
      ? { id: "subyacente", ok: true, detail: `Subyacente en Yahoo: ${input.underlying.symbol} (${input.underlying.name}).` }
      : { id: "subyacente", ok: false, detail: "No se encontró el subyacente en Yahoo." }
  );
  if (listing && input.underlying) {
    const implied = input.impliedRatio;
    checks.push(
      ratioMatches(listing.ratio, implied)
        ? { id: "ratio", ok: true, detail: `El precio del snapshot confirma el ratio (implícito ${implied!.toFixed(1)}).` }
        : {
            id: "ratio",
            ok: false,
            detail:
              implied === null
                ? "No se pudo verificar el ratio con el precio del snapshot."
                : `El precio del snapshot da un ratio de ${implied.toFixed(1)}, distinto del listado.`,
          }
    );
  }

  return {
    kind,
    name,
    cedearRatio: listing?.ratio ?? null,
    underlyingTicker: input.underlying?.symbol ?? null,
    sector: translateSector(input.profile?.sector ?? null, input.profile?.quoteType ?? input.underlying?.quoteType ?? null),
    industry: input.profile?.industry ?? null,
    country: translateCountry(input.profile?.country ?? null),
    listingTicker: listing?.ticker ?? null,
    checks,
    autoEligible: checks.every((c) => c.ok),
  };
}

export type RequestStatus = "PENDING" | "RUNNING" | "DONE" | "NEEDS_REVIEW" | "FAILED";

// Qué pasa con un pedido cuando otro import vuelve a traer el ticker: uno que
// falló o que ya se resolvió (y el activo se borró después) vuelve a la cola;
// uno en curso o esperando al admin sigue igual, con la observación nueva.
export function statusOnRequest(existing: RequestStatus | null): RequestStatus | "keep" {
  if (existing === null) return "PENDING";
  return existing === "FAILED" || existing === "DONE" ? "PENDING" : "keep";
}

// Intentos antes de dejar de reintentar un pedido que falla (Yahoo caído, etc.).
export const MAX_ATTEMPTS = 5;

// Con todos los controles en verde el sistema da de alta el activo solo
// (ADR-0026); si no, lo deja para el admin.
export function requestOutcome(proposal: Pick<AssetProposal, "autoEligible">): "DONE" | "NEEDS_REVIEW" {
  return proposal.autoEligible ? "DONE" : "NEEDS_REVIEW";
}

// Al admin se le avisa una vez por pedido: cuando queda para revisar o cuando
// agotó los reintentos. Un fallo pasajero lo reintenta el cron sin mail.
export function shouldNotifyAdmin(status: "DONE" | "NEEDS_REVIEW" | "FAILED", attempts: number): boolean {
  if (status === "NEEDS_REVIEW") return true;
  return status === "FAILED" && attempts >= MAX_ATTEMPTS;
}
