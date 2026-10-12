import { describe, expect, it } from "vitest";
import {
  buildProposal,
  classifyInstrument,
  cleanInstrumentName,
  findListingByName,
  impliedRatio,
  isUsMarket,
  nameSimilarity,
  pickUnderlying,
  ratioMatches,
  statusOnRequest,
  translateCountry,
  translateSector,
  type ResolutionInput,
} from "./asset-resolution";

describe("classifyInstrument y cleanInstrumentName", () => {
  it("distingue CEDEAR, FCI y el resto por el nombre del CSV", () => {
    expect(classifyInstrument("CEDEAR EJEMPLO INC. (EJM)")).toBe("CEDEAR");
    expect(classifyInstrument("FCI FONDO AHORRO CL.A U$S ESC. (FDO)")).toBe("FCI");
    expect(classifyInstrument("BANCO EJEMPLO ACC ORD. 1 VOTO (BEJ)")).toBe("OTHER");
    expect(classifyInstrument(null)).toBe("OTHER");
  });

  it("limpia prefijos y el ticker entre paréntesis", () => {
    expect(cleanInstrumentName("CEDEAR DE EJEMPLO CORP. (EJM)")).toBe("EJEMPLO CORP.");
    expect(cleanInstrumentName("CEDEAR FONDO BITCOIN TR (FBT) (FBT)")).toBe("FONDO BITCOIN TR");
    expect(cleanInstrumentName("CEDEAR ALFA INC. CL  A  (ALFA)")).toBe("ALFA INC. CL A");
  });
});

describe("nameSimilarity y findListingByName", () => {
  const listing = [
    { ticker: "UN", name: "Ejemplo Holdings Ltd/Cayman Islands", market: "NYSE", ratio: 2 },
    { ticker: "OTRA", name: "Otra Empresa Corp.", market: "NASDAQ", ratio: 10 },
  ];

  it("ignora sufijos societarios y acentos", () => {
    expect(nameSimilarity("EJEMPLO HOLDINGS LTD", "Ejemplo Holdings Ltd/Cayman Islands")).toBe(1);
    expect(nameSimilarity("Compañía Ñandú S.A.", "COMPANIA NANDU SA")).toBe(1);
    expect(nameSimilarity("Alfa Inc.", "Beta Corp.")).toBe(0);
  });

  it("encuentra la fila por nombre cuando el código del listado difiere", () => {
    expect(findListingByName("EJEMPLO HOLDINGS LTD", listing)?.ticker).toBe("UN");
    expect(findListingByName("NADA QUE VER SA", listing)).toBeNull();
  });

  it("no elige si hay un empate", () => {
    const dup = [...listing, { ticker: "UN2", name: "Ejemplo Holdings Inc.", market: "NYSE", ratio: 2 }];
    expect(findListingByName("EJEMPLO HOLDINGS", dup)).toBeNull();
  });
});

describe("pickUnderlying", () => {
  const cands = [
    { symbol: "ALFA-B", exchange: "NYQ", quoteType: "EQUITY", name: "Alfa Holding Inc. New" },
    { symbol: "ALFA-A", exchange: "NYQ", quoteType: "EQUITY", name: "Alfa Holding Inc." },
    { symbol: "ALFAB.VI", exchange: "VIE", quoteType: "EQUITY", name: "ALFA HOLDING INC" },
    { symbol: "SALFA=F", exchange: "CME", quoteType: "FUTURE", name: "Alfa Holding Futures" },
  ];

  it("toma la variante de clase del ticker en la bolsa del listado", () => {
    expect(pickUnderlying(cands, { ticker: "ALFAB", name: "Alfa Holding Inc.", market: "NYSE" })?.symbol).toBe("ALFA-B");
  });

  it("descarta otras bolsas y tipos, y mercados fuera de EE.UU.", () => {
    const only = cands.filter((c) => c.exchange !== "NYQ");
    expect(pickUnderlying(only, { ticker: "ALFAB", name: "Alfa Holding Inc.", market: "NYSE" })).toBeNull();
    expect(pickUnderlying(cands, { ticker: "ALFAB", name: "Alfa Holding Inc.", market: "B3" })).toBeNull();
  });

  it("no acepta un ticker igual con otro nombre", () => {
    const wrong = [{ symbol: "ZZ", exchange: "NMS", quoteType: "EQUITY", name: "Empresa Distinta Corp." }];
    expect(pickUnderlying(wrong, { ticker: "ZZ", name: "Zeta Zoo Inc.", market: "NASDAQ" })).toBeNull();
  });

  it("reconoce los mercados de EE.UU. del listado", () => {
    expect(isUsMarket("NYSE Arca")).toBe(true);
    expect(isUsMarket("NASDAQ GS")).toBe(true);
    expect(isUsMarket("LONDON STOCK EXCHANGE")).toBe(false);
  });
});

describe("impliedRatio y ratioMatches", () => {
  it("calcula el ratio con el CCL del snapshot", () => {
    // Acción a US$ 200; CEDEAR a $ 10.000 con CCL 1.000 → US$ 10 → ratio 20.
    expect(impliedRatio({ underlyingUsd: 200, cedearPrice: 10_000, cedearCurrency: "ARS", ccl: 1_000 })).toBe(20);
    expect(impliedRatio({ underlyingUsd: 200, cedearPrice: 10, cedearCurrency: "USD", ccl: null })).toBe(20);
    expect(impliedRatio({ underlyingUsd: 200, cedearPrice: 10_000, cedearCurrency: "ARS", ccl: null })).toBeNull();
  });

  it("acepta el desvío del CCL implícito y rechaza un ratio vecino", () => {
    expect(ratioMatches(20, 20.9)).toBe(true);
    expect(ratioMatches(20, 18.5)).toBe(true);
    expect(ratioMatches(20, 15)).toBe(false);
    expect(ratioMatches(20, null)).toBe(false);
  });
});

describe("traducciones", () => {
  it("usa los nombres del catálogo y marca los ETF", () => {
    expect(translateSector("Consumer Defensive", "EQUITY")).toBe("Consumo Básico");
    expect(translateSector(null, "ETF")).toBe("ETF / Índice");
    expect(translateSector("Something New", "EQUITY")).toBe("Something New");
    expect(translateCountry("United States")).toBe("Estados Unidos");
  });
});

describe("buildProposal", () => {
  const base: ResolutionInput = {
    ticker: "EJM",
    instrumentName: "CEDEAR EJEMPLO INC. (EJM)",
    listing: { ticker: "EJM", name: "Ejemplo Inc.", market: "NASDAQ", ratio: 20 },
    listingMatchedByName: false,
    underlying: { symbol: "EJM", exchange: "NMS", quoteType: "EQUITY", name: "Ejemplo Inc." },
    profile: { sector: "Technology", industry: "Software", country: "United States", quoteType: "EQUITY" },
    impliedRatio: 19.6,
  };

  it("con todos los controles en verde queda lista para darse de alta", () => {
    const p = buildProposal(base);
    expect(p).toMatchObject({
      kind: "CEDEAR",
      cedearRatio: 20,
      underlyingTicker: "EJM",
      sector: "Tecnología",
      country: "Estados Unidos",
      autoEligible: true,
    });
    expect(p.checks.map((c) => c.id)).toEqual(["listado", "mercado", "subyacente", "ratio"]);
  });

  it("explica por qué no puede darse de alta sola", () => {
    const sinListado = buildProposal({ ...base, listing: null });
    expect(sinListado.autoEligible).toBe(false);
    expect(sinListado.checks.find((c) => c.id === "listado")?.ok).toBe(false);

    const ratioRaro = buildProposal({ ...base, impliedRatio: 6.7 });
    expect(ratioRaro.autoEligible).toBe(false);
    expect(ratioRaro.checks.find((c) => c.id === "ratio")?.detail).toContain("6.7");

    const otroMercado = buildProposal({ ...base, listing: { ...base.listing!, market: "B3" } });
    expect(otroMercado.checks.find((c) => c.id === "mercado")?.ok).toBe(false);
  });

  it("un FCI se propone con ratio 1 y sin subyacente", () => {
    const p = buildProposal({ ...base, instrumentName: "FCI FONDO AHORRO CL.A (FDO)", listing: null, underlying: null });
    expect(p).toMatchObject({ kind: "FCI", cedearRatio: 1, underlyingTicker: null, autoEligible: true });
  });
});

describe("statusOnRequest", () => {
  it("vuelve a la cola lo que falló o se resolvió; deja lo que está en curso o en revisión", () => {
    expect(statusOnRequest(null)).toBe("PENDING");
    expect(statusOnRequest("FAILED")).toBe("PENDING");
    expect(statusOnRequest("DONE")).toBe("PENDING");
    expect(statusOnRequest("RUNNING")).toBe("keep");
    expect(statusOnRequest("NEEDS_REVIEW")).toBe("keep");
    expect(statusOnRequest("PENDING")).toBe("keep");
  });
});
