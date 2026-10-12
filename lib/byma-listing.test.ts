import { describe, expect, it } from "vitest";
import {
  findListingPdfUrl,
  parseListingItems,
  parseRatio,
  parseVersionDate,
  ratioValue,
  validateListing,
  type PdfTextItem,
} from "./byma-listing";

// Una página sintética con el mismo diseño que el PDF de BYMA: encabezados
// repetidos, columnas en x ≈ 57 / 285 / 340 / 415 y filas cada ~13 puntos.
function header(page: number): PdfTextItem[] {
  const at = (x: number, y: number, str: string) => ({ page, x, y, str });
  return [
    at(57, 713, "CEDEARs Negociables en BYMA"),
    at(57, 713, "CEDEARs Negociables en BYMA"),
    at(118, 687, "Nombre de la Compañía"),
    at(281, 694, "Código"),
    at(283, 681, "BYMA"),
    at(283, 680, "BYMA"),
    at(325, 694, "Mercado donde"),
    at(342, 681, "Cotiza"),
    at(406, 687, "Ratio (*)"),
  ];
}

function row(page: number, y: number, name: string, ticker: string, market: string, ratio: string): PdfTextItem[] {
  return [
    { page, x: 57, y, str: name },
    { page, x: 93, y, str: " " },
    // El código y el mercado llegan un punto más arriba que el nombre.
    { page, x: 285, y: y + 1, str: ticker },
    { page, x: 339, y: y + 1, str: market },
    { page, x: 416, y, str: ratio },
  ];
}

const footer = (page: number): PdfTextItem[] => [
  { page, x: 57, y: 40, str: "(*) Relación CEDEAR Subyacente" },
  { page, x: 500, y: 40, str: `Página ${page}` },
];

describe("parseListingItems", () => {
  it("arma las filas por posición e ignora encabezados y pie", () => {
    const items = [
      ...header(1),
      ...row(1, 667, "Empresa Uno Inc.", "UNO", "NASDAQ", "20:1"),
      ...row(1, 654, "Empresa Dos Corp.", "DOS", "NYSE", "1:3"),
      ...footer(1),
      { page: 1, x: 57, y: 30, str: "Actualizado 16/09/2026" },
    ];
    const r = parseListingItems(items);
    expect(r.version?.toISOString().slice(0, 10)).toBe("2026-09-16");
    expect(r.skipped).toEqual([]);
    expect(r.rows).toEqual([
      { ticker: "UNO", name: "Empresa Uno Inc.", market: "NASDAQ", ratioCedear: 20, ratioUnderlying: 1 },
      { ticker: "DOS", name: "Empresa Dos Corp.", market: "NYSE", ratioCedear: 1, ratioUnderlying: 3 },
    ]);
  });

  it("une nombres y mercados partidos en dos líneas con su fila", () => {
    const items = [
      ...header(1),
      ...row(1, 655, "Fila Anterior SA", "ANT", "NASDAQ GS", "1:1"),
      // Nombre largo: una línea arriba y otra abajo de la del código.
      { page: 1, x: 57, y: 642, str: "Compañía de Nombre Muy Largo del" },
      { page: 1, x: 57, y: 629, str: "Estado–Ejemplo" },
      { page: 1, x: 287, y: 636, str: "LRG" },
      { page: 1, x: 344, y: 636, str: "NYSE" },
      { page: 1, x: 416, y: 636, str: "1:2" },
      // Mercado de dos palabras, partido arriba y abajo.
      { page: 1, x: 57, y: 604, str: "Empresa Europea" },
      { page: 1, x: 285, y: 604, str: "EURD" },
      { page: 1, x: 327, y: 610, str: "LONDON STOCK" },
      { page: 1, x: 335, y: 598, str: "EXCHANGE" },
      { page: 1, x: 416, y: 604, str: "4:1" },
      ...row(1, 590, "Fila Siguiente SA", "SIG", "B3", "1:1"),
    ];
    const r = parseListingItems(items);
    expect(r.skipped).toEqual([]);
    const by = Object.fromEntries(r.rows.map((x) => [x.ticker, x]));
    expect(by.LRG.name).toBe("Compañía de Nombre Muy Largo del Estado–Ejemplo");
    expect(by.EURD.market).toBe("LONDON STOCK EXCHANGE");
    expect(by.ANT.name).toBe("Fila Anterior SA");
    expect(by.SIG.name).toBe("Fila Siguiente SA");
  });

  it("procesa cada página con sus propios encabezados", () => {
    const items = [
      ...header(1),
      ...row(1, 667, "Primera SA", "PRI", "NYSE", "2:1"),
      ...header(2),
      ...row(2, 667, "Segunda SA", "SEG", "NYSE Arca", "60:1"),
    ];
    expect(parseListingItems(items).rows.map((x) => x.ticker)).toEqual(["PRI", "SEG"]);
  });

  it("descarta las filas que no se pueden interpretar y las reporta", () => {
    const items = [...header(1), ...row(1, 667, "Sin Ratio SA", "MAL", "NYSE", "veinte")];
    const r = parseListingItems(items);
    expect(r.rows).toEqual([]);
    expect(r.skipped).toEqual(["Sin Ratio SA | MAL | NYSE | veinte"]);
  });

  it("una página sin encabezados no se interpreta", () => {
    const r = parseListingItems(row(3, 667, "Huérfana SA", "HUE", "NYSE", "1:1"));
    expect(r.rows).toEqual([]);
    expect(r.skipped).toEqual(["página 3: sin encabezados"]);
  });
});

describe("parseRatio y ratioValue", () => {
  it("lee ratios directos, invertidos y con decimales", () => {
    expect(parseRatio("20:1")).toEqual({ ratioCedear: 20, ratioUnderlying: 1 });
    expect(parseRatio(" 1 : 3 ")).toEqual({ ratioCedear: 1, ratioUnderlying: 3 });
    expect(parseRatio("2,5:1")).toEqual({ ratioCedear: 2.5, ratioUnderlying: 1 });
    expect(ratioValue({ ratioCedear: 1, ratioUnderlying: 4 })).toBe(0.25);
  });

  it("rechaza lo que no es un ratio positivo", () => {
    expect(parseRatio("0:1")).toBeNull();
    expect(parseRatio("NYSE")).toBeNull();
    expect(parseRatio("20")).toBeNull();
  });
});

describe("parseVersionDate", () => {
  it("lee la fecha de actualización", () => {
    expect(parseVersionDate("… Actualizado 05/03/2026 Bolsas …")?.toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });

  it("rechaza fechas imposibles o ausentes", () => {
    expect(parseVersionDate("Actualizado 31/02/2026")).toBeNull();
    expect(parseVersionDate("sin fecha")).toBeNull();
  });
});

describe("findListingPdfUrl", () => {
  it("toma el PDF con la fecha más nueva", () => {
    const html = `
      <a href="https://cdn.example.com/abc/aaa_2026-03-01-BYMA-CEDEARs.pdf">viejo</a>
      <a href="https://cdn.example.com/abc/bbb_2026-09-16-BYMA-CEDEARs.pdf">nuevo</a>
      <a href="https://cdn.example.com/abc/bbb_2026-09-16-BYMA-CEDEARs.pdf">repetido</a>
      <a href="https://cdn.example.com/abc/circular.pdf">otro</a>`;
    expect(findListingPdfUrl(html)).toBe("https://cdn.example.com/abc/bbb_2026-09-16-BYMA-CEDEARs.pdf");
  });

  it("devuelve null si la página no enlaza el listado", () => {
    expect(findListingPdfUrl("<a href='https://cdn.example.com/x.pdf'>x</a>")).toBeNull();
  });
});

describe("validateListing", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ticker: `T${i}`, name: "X", market: "NYSE", ratioCedear: 1, ratioUnderlying: 1 }));
  const version = new Date("2026-09-16T00:00:00.000Z");

  it("acepta un listado completo con fecha", () => {
    expect(validateListing({ version, rows: rows(3), skipped: [] }, 3)).toEqual({ ok: true });
  });

  it("rechaza un listado incompleto o sin fecha", () => {
    expect(validateListing({ version, rows: rows(2), skipped: [] }, 3).ok).toBe(false);
    expect(validateListing({ version: null, rows: rows(3), skipped: [] }, 3).ok).toBe(false);
  });
});
