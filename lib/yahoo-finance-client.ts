// Yahoo Finance requires cookie + crumb auth since 2023.
// This client handles the flow manually with native fetch so it works reliably
// in all server environments, bypassing yahoo-finance2's internal handling.

import { fetchWithTimeout } from "@/lib/http";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BASE = "https://query1.finance.yahoo.com";
const BASE2 = "https://query2.finance.yahoo.com";
const SERVICE = "Yahoo Finance";
const AUTH_TTL_MS = 23 * 60 * 60 * 1000;

// Module-level cache — valid for 23 hours
let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cacheExpiry = 0;

// Yahoo puede invalidar la sesión antes de las 23 h: ante un 401/403 se
// descarta la auth cacheada y se reintenta una vez con una nueva.
function resetAuth(): void {
  cachedCookie = null;
  cachedCrumb = null;
  cacheExpiry = 0;
}

async function getAuth(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < cacheExpiry) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  // Step 1: fetch fc.yahoo.com to get session cookies
  const cookieRes = await fetchWithTimeout("https://fc.yahoo.com", {
    service: SERVICE,
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });

  const setCookieHeader = cookieRes.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No se pudo obtener la cookie de sesión de Yahoo Finance.");
  }

  // Extract all cookie name=value pairs (ignore attributes like Path, Expires, etc.)
  const cookie = setCookieHeader
    .split(/,(?=[^;]+=)/)
    .map((part) => part.split(";")[0].trim())
    .join("; ");

  // Step 2: fetch the crumb using the session cookie (query1, then query2)
  const crumbHeaders = { "User-Agent": USER_AGENT, Cookie: cookie, Accept: "*/*" };
  let crumbRes = await fetchWithTimeout(`${BASE}/v1/test/getcrumb`, {
    service: SERVICE,
    headers: crumbHeaders,
  });
  if (!crumbRes.ok) {
    crumbRes = await fetchWithTimeout(`${BASE2}/v1/test/getcrumb`, {
      service: SERVICE,
      headers: crumbHeaders,
    });
    if (!crumbRes.ok) {
      throw new Error(`No se pudo obtener el crumb de Yahoo Finance (${crumbRes.status}).`);
    }
  }

  cachedCookie = cookie;
  cachedCrumb = (await crumbRes.text()).trim();
  cacheExpiry = Date.now() + AUTH_TTL_MS;
  return { cookie: cachedCookie, crumb: cachedCrumb };
}

// GET autenticado: arma la URL con el crumb vigente y, si Yahoo rechaza la
// sesión (401/403), renueva la auth y reintenta una sola vez.
async function authedGet(buildUrl: (crumb: string) => string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie, crumb } = await getAuth();
    const res = await fetchWithTimeout(buildUrl(crumb), {
      service: SERVICE,
      headers: { "User-Agent": USER_AGENT, Cookie: cookie, Accept: "application/json" },
    });
    if ((res.status === 401 || res.status === 403) && attempt === 0) {
      resetAuth();
      continue;
    }
    return res;
  }
  // Inalcanzable: el segundo intento siempre retorna.
  throw new Error("Yahoo Finance rechazó la autenticación.");
}

// ---------------------------------------------------------------------------
// getQuotes — bulk price fetch for multiple symbols
// Returns a map of symbol → regularMarketPrice (USD)
// ---------------------------------------------------------------------------

export async function getQuotes(
  symbols: string[]
): Promise<Map<string, number>> {
  const res = await authedGet(
    (crumb) =>
      `${BASE}/v7/finance/quote?symbols=${symbols.join(",")}&crumb=${encodeURIComponent(crumb)}`
  );

  if (!res.ok) {
    throw new Error(`Yahoo Finance quote falló con status ${res.status}.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const results: Map<string, number> = new Map();

  const quoteList = data?.quoteResponse?.result ?? [];
  for (const q of quoteList) {
    const price: number | undefined =
      q.regularMarketPrice ?? q.ask ?? q.bid;
    if (q.symbol && price && price > 0) {
      results.set(q.symbol, price);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// getHistorical — daily closes for a symbol between two dates
// Returns array of { date: Date, close: number }
// ---------------------------------------------------------------------------

export async function getHistorical(
  symbol: string,
  from: Date,
  to: Date = new Date()
): Promise<Array<{ date: Date; close: number }>> {
  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(to.getTime() / 1000);

  const encodedSymbol = encodeURIComponent(symbol);
  const res = await authedGet(
    (crumb) =>
      `${BASE}/v8/finance/chart/${encodedSymbol}` +
      `?interval=1d&period1=${period1}&period2=${period2}&crumb=${encodeURIComponent(crumb)}`
  );

  if (!res.ok) {
    throw new Error(
      `Yahoo Finance chart/${symbol} falló con status ${res.status}.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const chart = data?.chart?.result?.[0];
  if (!chart) {
    throw new Error(`Sin datos históricos para ${symbol}.`);
  }

  const timestamps: number[] = chart.timestamp ?? [];
  const closes: number[] = chart.indicators?.quote?.[0]?.close ?? [];

  const rows: Array<{ date: Date; close: number }> = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (!close || close <= 0) continue;
    const date = new Date(timestamps[i] * 1000);
    date.setUTCHours(0, 0, 0, 0);
    rows.push({ date, close });
  }

  return rows;
}
