import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Yahoo simulado: cookie, crumb y quote. `quoteStatuses` define la respuesta
// de cada llamada sucesiva a /v7/finance/quote.
function yahooMock(
  quoteStatuses: number[],
  quotes: Record<string, unknown>[] = [{ symbol: "AAPL", regularMarketPrice: 200 }]
) {
  let crumbCount = 0;
  let quoteCall = 0;
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.startsWith("https://fc.yahoo.com")) {
      return new Response("", { headers: { "set-cookie": "A1=abc; Path=/" } });
    }
    if (url.includes("/v1/test/getcrumb")) {
      crumbCount += 1;
      return new Response(`crumb${crumbCount}`);
    }
    if (url.includes("/v7/finance/quote")) {
      const status = quoteStatuses[quoteCall++] ?? 200;
      if (status !== 200) return new Response("", { status });
      return Response.json({ quoteResponse: { result: quotes } });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
  return { fetchMock, calls };
}

beforeEach(() => {
  // El cliente cachea la auth a nivel de módulo: cada test arranca limpio.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getQuoteDetails", () => {
  it("toma el dividendo forward y, si falta, el de los últimos 12 meses", async () => {
    const { fetchMock } = yahooMock([], [
      { symbol: "KO", regularMarketPrice: 88, dividendRate: 2.12, trailingAnnualDividendRate: 2.08 },
      { symbol: "SPY", regularMarketPrice: 700, trailingAnnualDividendRate: 5.6 },
      { symbol: "AMZN", regularMarketPrice: 260 },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { getQuoteDetails } = await import("./yahoo-finance-client");

    const quotes = await getQuoteDetails(["KO", "SPY", "AMZN"]);

    expect(quotes.get("KO")).toEqual({ price: 88, dividendRate: 2.12 });
    expect(quotes.get("SPY")).toEqual({ price: 700, dividendRate: 5.6 });
    expect(quotes.get("AMZN")).toEqual({ price: 260, dividendRate: null });
  });
});

describe("getQuotes", () => {
  it("renueva la sesión y reintenta una vez si Yahoo responde 401", async () => {
    const { fetchMock, calls } = yahooMock([401, 200]);
    vi.stubGlobal("fetch", fetchMock);
    const { getQuotes } = await import("./yahoo-finance-client");

    const prices = await getQuotes(["AAPL"]);

    expect(prices.get("AAPL")).toBe(200);
    const quoteCalls = calls.filter((u) => u.includes("/v7/finance/quote"));
    expect(quoteCalls).toHaveLength(2);
    expect(quoteCalls[0]).toContain("crumb=crumb1");
    expect(quoteCalls[1]).toContain("crumb=crumb2");
  });

  it("no reintenta más de una vez si Yahoo sigue rechazando", async () => {
    const { fetchMock, calls } = yahooMock([403, 403, 200]);
    vi.stubGlobal("fetch", fetchMock);
    const { getQuotes } = await import("./yahoo-finance-client");

    await expect(getQuotes(["AAPL"])).rejects.toThrow("status 403");
    expect(calls.filter((u) => u.includes("/v7/finance/quote"))).toHaveLength(2);
  });

  it("reutiliza la sesión cacheada entre llamadas exitosas", async () => {
    const { fetchMock, calls } = yahooMock([200, 200]);
    vi.stubGlobal("fetch", fetchMock);
    const { getQuotes } = await import("./yahoo-finance-client");

    await getQuotes(["AAPL"]);
    await getQuotes(["AAPL"]);

    expect(calls.filter((u) => u.includes("/v1/test/getcrumb"))).toHaveLength(1);
  });
});
