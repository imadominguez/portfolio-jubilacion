// Yahoo Finance requires cookie + crumb auth since 2023.
// This client handles the flow manually with native fetch so it works reliably
// in all server environments, bypassing yahoo-finance2's internal handling.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BASE = "https://query1.finance.yahoo.com";
const BASE2 = "https://query2.finance.yahoo.com";

// Module-level cache — valid for 23 hours
let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cacheExpiry = 0;

async function getAuth(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < cacheExpiry) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  // Step 1: fetch fc.yahoo.com to get session cookies
  const cookieRes = await fetch("https://fc.yahoo.com", {
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

  // Step 2: fetch the crumb using the session cookie
  const crumbRes = await fetch(
    `${BASE}/v1/test/getcrumb`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookie,
        Accept: "*/*",
      },
    }
  );

  if (!crumbRes.ok) {
    // Retry with query2
    const crumbRes2 = await fetch(`${BASE2}/v1/test/getcrumb`, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookie,
        Accept: "*/*",
      },
    });
    if (!crumbRes2.ok) {
      throw new Error(`No se pudo obtener el crumb de Yahoo Finance (${crumbRes2.status}).`);
    }
    const crumb = await crumbRes2.text();
    cachedCookie = cookie;
    cachedCrumb = crumb.trim();
    cacheExpiry = Date.now() + 23 * 60 * 60 * 1000;
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  const crumb = await crumbRes.text();
  cachedCookie = cookie;
  cachedCrumb = crumb.trim();
  cacheExpiry = Date.now() + 23 * 60 * 60 * 1000;

  return { cookie: cachedCookie, crumb: cachedCrumb };
}

// ---------------------------------------------------------------------------
// getQuotes — bulk price fetch for multiple symbols
// Returns a map of symbol → regularMarketPrice (USD)
// ---------------------------------------------------------------------------

export async function getQuotes(
  symbols: string[]
): Promise<Map<string, number>> {
  const { cookie, crumb } = await getAuth();

  const url = `${BASE}/v7/finance/quote?symbols=${symbols.join(",")}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: cookie,
      Accept: "application/json",
    },
  });

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
  const { cookie, crumb } = await getAuth();

  const period1 = Math.floor(from.getTime() / 1000);
  const period2 = Math.floor(to.getTime() / 1000);

  const encodedSymbol = encodeURIComponent(symbol);
  const url =
    `${BASE}/v8/finance/chart/${encodedSymbol}` +
    `?interval=1d&period1=${period1}&period2=${period2}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: cookie,
      Accept: "application/json",
    },
  });

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
