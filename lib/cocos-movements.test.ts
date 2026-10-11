import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyTipoOperacion,
  extractTicker,
  parseArNumber,
  parseDateDDMMYYYY,
  parseMovementCsv,
  type MovementCategory,
} from "./cocos-movements";

// Los CSV reales de la cuenta viven en __fixtures__/ (ignorado por git porque
// contienen datos personales). Los tests contra esos archivos solo corren
// localmente; en CI se usa el CSV sintético de abajo.
function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../__fixtures__/movements/${name}`, import.meta.url));
}

function fixture(name: string): string {
  return readFileSync(fixturePath(name), "utf-8");
}

const HEADER =
  "nroTicket;nroComprobante;fechaEjecucion;fechaLiquidacion;tipoOperacion;instrumento;moneda;mercado;cantidad;precio;montoBruto;comision;ddmm;iva;otros;total";

// CSV sintético (tickets y montos inventados) con una o más filas de cada
// tipo de operación que exporta Cocos, en el formato real de cada una.
const SYNTHETIC_CSV = [
  HEADER,
  "1001;5001;02-01-2026;02-01-2026;Orden De Pago;;ARS;;;;-12.345,67;0;0;0;0;-12.345,67",
  "1002;5002;02-01-2026;02-01-2026;Liquidacion Rescate Fci;FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA);ARS;;-1.000,5;10.000;10.005;0;0;0;0;10.005",
  "1003;5003;05-01-2026;05-01-2026;Liquidacion Suscripcion Fci;FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA);ARS;;2.000;10.000;-20.000;0;0;0;0;-20.000",
  "1004;5004;06-01-2026;07-01-2026;Compra;CEDEAR MERCADOLIBRE INC. (MELI);ARS;BYMA;4;25.000;-100.000;-450;-50;-105;0;-100.605",
  "1005;5005;06-01-2026;07-01-2026;Compra;CEDEAR NVIDIA CORPORATION (NVDA);ARS;BYMA;10;15.000;-150.000;-675;-75;-157,5;0;-150.907,5",
  "1006;5006;08-01-2026;09-01-2026;Venta;CEDEAR ADVANCED MICRO DEVICES, INC. (AMD);ARS;BYMA;-2;80.000;160.000;-720;-80;-168;0;159.032",
  "1007;5007;10-01-2026;10-01-2026;Compra Registracion ARS;ON EJEMPLO CL.1 S.1 $ (ONX1);ARS;MAE;1.000;100;-1.000;0;0;0;0;-1.000",
  "1008;5008;12-01-2026;12-01-2026;Venta Registracion USD;ON EJEMPLO CL.1 S.1 $ (ONX1);USD;MAE;-1.000;0,07;0,7;0;0;0;0;0,7",
  "1009;5009;15-01-2026;15-01-2026;Recibo De Cobro;;ARS;;;;50.000;0;0;0;0;50.000",
  "1010;5010;15-01-2026;15-01-2026;Orden De Pago Usd;;USD;;;;-5;0;0;0;0;-5",
  "1011;5011;20-01-2026;20-01-2026;Dividendos;Peso argentino;ARS;;;;0,30;0;0;0;0;0,30",
  "1012;5012;20-01-2026;20-01-2026;DIVIDENDOS EN ESPECIE;Dólar estadounidense;ARS;;0,25;0;0;0;-12,5;-2,625;0;-15,13",
  "1013;5013;21-01-2026;21-01-2026;Nota De Credito Conversion;;USD;;;;0,25;0;0;0;0;0,25",
].join("\n");

const EXPECTED_SYNTHETIC: Record<MovementCategory, number> = {
  TRADE_BUY: 3,
  TRADE_SELL: 2,
  FCI_SUBSCRIPTION: 1,
  FCI_REDEMPTION: 1,
  PAYMENT: 2,
  RECEIPT: 1,
  DIVIDEND: 1,
  DIVIDEND_IN_KIND: 1,
  CONVERSION: 1,
  OTHER: 0,
};

describe("parseDateDDMMYYYY", () => {
  it("convierte DD-MM-YYYY a YYYY-MM-DD", () => {
    expect(parseDateDDMMYYYY("02-01-2026")).toBe("2026-01-02");
    expect(parseDateDDMMYYYY("18-09-2026")).toBe("2026-09-18");
  });

  it("devuelve null para fechas inválidas", () => {
    expect(parseDateDDMMYYYY("")).toBeNull();
    expect(parseDateDDMMYYYY("2026-01-02")).toBeNull();
    expect(parseDateDDMMYYYY("99-99-2026")).toBeNull();
    expect(parseDateDDMMYYYY("abc")).toBeNull();
  });
});

describe("parseArNumber", () => {
  it("parsea el formato argentino", () => {
    expect(parseArNumber("-40.000,44")).toBeCloseTo(-40000.44);
    expect(parseArNumber("115.467,3308")).toBeCloseTo(115467.3308);
    expect(parseArNumber("0,48")).toBeCloseTo(0.48);
    expect(parseArNumber("1.349.999")).toBe(1349999);
    expect(parseArNumber("-0,0005")).toBeCloseTo(-0.0005);
  });

  it("devuelve null para vacíos o inválidos", () => {
    expect(parseArNumber("")).toBeNull();
    expect(parseArNumber("   ")).toBeNull();
    expect(parseArNumber(undefined)).toBeNull();
    expect(parseArNumber("abc")).toBeNull();
  });
});

describe("extractTicker", () => {
  it("extrae el ticker del paréntesis", () => {
    expect(extractTicker("CEDEAR NVIDIA CORPORATION (NVDA)")).toBe("NVDA");
    expect(extractTicker("ON EJEMPLO CL.1 S.1 $ (ONX1)")).toBe("ONX1");
  });

  it("devuelve null si no hay ticker", () => {
    expect(extractTicker("Peso argentino")).toBeNull();
    expect(extractTicker("FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA)")).toBe("COCORMA");
  });
});

describe("classifyTipoOperacion", () => {
  it("mapea los tipos conocidos", () => {
    expect(classifyTipoOperacion("Compra")).toBe("TRADE_BUY");
    expect(classifyTipoOperacion("Venta")).toBe("TRADE_SELL");
    expect(classifyTipoOperacion("Compra Registracion ARS")).toBe("TRADE_BUY");
    expect(classifyTipoOperacion("Venta Registracion USD")).toBe("TRADE_SELL");
    expect(classifyTipoOperacion("Compra Registracion USD")).toBe("TRADE_BUY");
    expect(classifyTipoOperacion("Venta Registracion ARS")).toBe("TRADE_SELL");
    expect(classifyTipoOperacion("Compra Esp App Pesos")).toBe("TRADE_BUY");
    expect(classifyTipoOperacion("Venta Esp App Dolares")).toBe("TRADE_SELL");
    expect(classifyTipoOperacion("Compra bono Operatoria dolar MEP ARS")).toBe("TRADE_BUY");
    expect(classifyTipoOperacion("Venta bono Operatoria dolar MEP USD")).toBe("TRADE_SELL");
    expect(classifyTipoOperacion("Recibo De Cobro Dolares")).toBe("RECEIPT");
    expect(classifyTipoOperacion("Liquidacion Suscripcion Fci")).toBe("FCI_SUBSCRIPTION");
    expect(classifyTipoOperacion("Liquidacion Rescate Fci")).toBe("FCI_REDEMPTION");
    expect(classifyTipoOperacion("Orden De Pago")).toBe("PAYMENT");
    expect(classifyTipoOperacion("Orden De Pago Usd")).toBe("PAYMENT");
    expect(classifyTipoOperacion("Recibo De Cobro")).toBe("RECEIPT");
    expect(classifyTipoOperacion("Dividendos")).toBe("DIVIDEND");
    expect(classifyTipoOperacion("DIVIDENDOS EN ESPECIE")).toBe("DIVIDEND_IN_KIND");
    expect(classifyTipoOperacion("Nota De Credito Conversion")).toBe("CONVERSION");
  });

  it("devuelve null para tipos desconocidos", () => {
    expect(classifyTipoOperacion("Algo Nuevo")).toBeNull();
  });
});

const EXPECTED_FILE1: Record<MovementCategory, number> = {
  TRADE_BUY: 9,
  TRADE_SELL: 2,
  FCI_SUBSCRIPTION: 4,
  FCI_REDEMPTION: 102,
  PAYMENT: 344,
  RECEIPT: 25,
  DIVIDEND: 7,
  DIVIDEND_IN_KIND: 23,
  CONVERSION: 12,
  OTHER: 0,
};

const EXPECTED_FILE2: Record<MovementCategory, number> = {
  TRADE_BUY: 0,
  TRADE_SELL: 0,
  FCI_SUBSCRIPTION: 1,
  FCI_REDEMPTION: 47,
  PAYMENT: 50,
  RECEIPT: 1,
  DIVIDEND: 0,
  DIVIDEND_IN_KIND: 5,
  CONVERSION: 2,
  OTHER: 0,
};

describe("parseMovementCsv", () => {
  it("categoriza cada tipo de operación de Cocos", () => {
    const result = parseMovementCsv(SYNTHETIC_CSV);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.movements).toHaveLength(13);
    expect(result.counts).toEqual(EXPECTED_SYNTHETIC);
    expect(result.warnings).toEqual([]);
  });

  it("genera trades con ticker, incluyendo las registraciones de bonos", () => {
    const result = parseMovementCsv(SYNTHETIC_CSV);
    if (!result.success) throw new Error(result.error);

    const trades = result.movements.filter(
      (m) => m.category === "TRADE_BUY" || m.category === "TRADE_SELL"
    );
    expect(trades.map((t) => t.ticker)).toEqual(["MELI", "NVDA", "AMD", "ONX1", "ONX1"]);

    const registraciones = trades.filter((t) => t.ticker === "ONX1");
    expect(registraciones.map((t) => t.category)).toEqual(["TRADE_BUY", "TRADE_SELL"]);
    expect(registraciones[1].currency).toBe("USD");
  });

  it("parsea montos, fechas y comisiones de una compra", () => {
    const result = parseMovementCsv(SYNTHETIC_CSV);
    if (!result.success) throw new Error(result.error);

    const meli = result.movements.find((m) => m.nroTicket === "1004");
    expect(meli).toMatchObject({
      date: "2026-01-06",
      settlementDate: "2026-01-07",
      market: "BYMA",
      quantity: 4,
      price: 25000,
      grossAmount: -100000,
      total: -100605,
    });
    expect(meli?.commission).toBeCloseTo(-450);
  });

  it("asigna el ticker del fondo a las operaciones FCI", () => {
    const result = parseMovementCsv(SYNTHETIC_CSV);
    if (!result.success) throw new Error(result.error);

    const fci = result.movements.filter((m) => m.category.startsWith("FCI_"));
    expect(fci).toHaveLength(2);
    for (const m of fci) expect(m.ticker).toBe("COCORMA");
  });

  it("acepta BOM y saltos de línea CRLF", () => {
    const result = parseMovementCsv("﻿" + SYNTHETIC_CSV.replace(/\n/g, "\r\n"));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.counts).toEqual(EXPECTED_SYNTHETIC);
  });

  it("avisa cuando un trade no tiene ticker", () => {
    const csv = [HEADER, "2001;1;02-01-2026;02-01-2026;Compra;CEDEAR SIN TICKER;ARS;BYMA;1;100;-100;0;0;0;0;-100"].join("\n");
    const result = parseMovementCsv(csv);
    if (!result.success) throw new Error(result.error);

    expect(result.movements[0].ticker).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it("omite filas sin nroTicket o con fecha inválida", () => {
    const csv = [
      HEADER,
      ";1;02-01-2026;02-01-2026;Orden De Pago;;ARS;;;;-1;0;0;0;0;-1",
      "2002;1;2026-01-02;02-01-2026;Orden De Pago;;ARS;;;;-1;0;0;0;0;-1",
      "2003;1;02-01-2026;02-01-2026;Orden De Pago;;ARS;;;;-1;0;0;0;0;-1",
    ].join("\n");
    const result = parseMovementCsv(csv);
    if (!result.success) throw new Error(result.error);

    expect(result.movements.map((m) => m.nroTicket)).toEqual(["2003"]);
    expect(result.warnings).toHaveLength(2);
  });

  it("categoriza tipos desconocidos como OTHER con warning", () => {
    const csv = [HEADER, "1;1;02-01-2026;02-01-2026;Operacion Rara;;ARS;;;;100;0;0;0;0;100"].join("\n");

    const result = parseMovementCsv(csv);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].category).toBe("OTHER");
    expect(result.counts.OTHER).toBe(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("falla con un header no reconocido", () => {
    const result = parseMovementCsv("foo;bar\n1;2");
    expect(result.success).toBe(false);
  });

  it("falla con archivo vacío", () => {
    const result = parseMovementCsv("");
    expect(result.success).toBe(false);
  });
});

// Regresión contra exportaciones reales de la cuenta. Se saltea si los
// archivos no están (checkout limpio / CI).
const hasRealFixtures =
  existsSync(fixturePath("mivimientos_cuenta.csv")) &&
  existsSync(fixturePath("mivimientos_cuenta1.csv"));

describe.skipIf(!hasRealFixtures)("parseMovementCsv (CSV reales)", () => {
  it("parsea el archivo completo y categoriza todas las filas", () => {
    const result = parseMovementCsv(fixture("mivimientos_cuenta.csv"));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.movements).toHaveLength(528);
    expect(result.counts).toEqual(EXPECTED_FILE1);
    expect(result.warnings).toEqual([]);
  });

  it("parsea el archivo solapado", () => {
    const result = parseMovementCsv(fixture("mivimientos_cuenta1.csv"));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.movements).toHaveLength(106);
    expect(result.counts).toEqual(EXPECTED_FILE2);
  });

  it("genera trades con ticker, incluyendo las registraciones de bonos", () => {
    const result = parseMovementCsv(fixture("mivimientos_cuenta.csv"));
    if (!result.success) throw new Error(result.error);

    const trades = result.movements.filter(
      (m) => m.category === "TRADE_BUY" || m.category === "TRADE_SELL"
    );
    expect(trades).toHaveLength(11);
    for (const t of trades) expect(t.ticker).not.toBeNull();

    const registraciones = trades.filter((t) => t.instrument?.startsWith("ON "));
    expect(registraciones).toHaveLength(2);
    expect(registraciones.map((t) => t.category).sort()).toEqual(["TRADE_BUY", "TRADE_SELL"]);

    const compras = trades.filter((t) => t.category === "TRADE_BUY");
    expect(compras).toHaveLength(9);
    const ventas = trades.filter((t) => t.category === "TRADE_SELL");
    expect(ventas).toHaveLength(2);
  });

  it("asigna el ticker del fondo a las operaciones FCI", () => {
    const result = parseMovementCsv(fixture("mivimientos_cuenta.csv"));
    if (!result.success) throw new Error(result.error);

    const fci = result.movements.filter((m) => m.category.startsWith("FCI_"));
    expect(fci).toHaveLength(106);
    for (const m of fci) {
      expect(m.ticker).toBe("COCORMA");
      expect(m.instrument).toContain("FCI COCOS RENDIMIENTO");
    }
  });

});
