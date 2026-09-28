import { readFileSync } from "node:fs";
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

function fixture(name: string): string {
  const path = fileURLToPath(new URL(`../__fixtures__/movements/${name}`, import.meta.url));
  return readFileSync(path, "utf-8");
}

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
    expect(extractTicker("ON TARJETA NARANJA CL.66 S.1 30/11/26 $ (T661O)")).toBe("T661O");
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

    const registraciones = trades.filter((t) => t.ticker === "T661O");
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

  it("categoriza tipos desconocidos como OTHER con warning", () => {
    const csv = [
      "nroTicket;nroComprobante;fechaEjecucion;fechaLiquidacion;tipoOperacion;instrumento;moneda;mercado;cantidad;precio;montoBruto;comision;ddmm;iva;otros;total",
      "1;1;02-01-2026;02-01-2026;Operacion Rara;;ARS;;;;100;0;0;0;0;100",
    ].join("\n");

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
