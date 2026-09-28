// ---------------------------------------------------------------------------
// Glosario de términos financieros de la app.
//
// Se usa para tooltips contextuales en los KPIs y como referencia en la UI.
// ---------------------------------------------------------------------------

export type GlossaryEntry = {
  term: string;
  definition: string;
};

export const GLOSSARY = {
  snapshot: {
    term: "Snapshot",
    definition:
      "Fotografía inmutable del estado de tu cartera en una fecha, importada desde el CSV de Portfolio de Cocos Capital.",
  },
  ccl: {
    term: "CCL",
    definition:
      "Contado con Liquidación. Tipo de cambio implícito que se usa para convertir tu cartera de ARS a USD.",
  },
  ppm: {
    term: "PPM",
    definition:
      "Precio Promedio Ponderado de compra. Costo promedio por CEDEAR considerando todas tus compras y comisiones.",
  },
  pnl: {
    term: "P&L",
    definition:
      "Profit & Loss. Ganancia o pérdida. El P&L no realizado es el latente sobre posiciones que todavía tenés.",
  },
  cagr: {
    term: "CAGR",
    definition:
      "Tasa de crecimiento anual compuesta. El rendimiento promedio por año de tu cartera en el período.",
  },
  drawdown: {
    term: "Drawdown",
    definition:
      "Caída porcentual desde un máximo. El máximo drawdown es la mayor caída registrada en tu historial.",
  },
  cedear: {
    term: "CEDEAR",
    definition:
      "Certificado de Depósito Argentino. Representa una fracción de una acción extranjera y cotiza en ARS.",
  },
  ratio: {
    term: "Ratio CEDEAR",
    definition:
      "Cantidad de CEDEARs que equivalen a 1 acción subyacente. Ej: ratio 10 → 10 CEDEARs = 1 acción.",
  },
  subyacente: {
    term: "Subyacente",
    definition:
      "La acción extranjera que representa el CEDEAR (ej: AAPL para el CEDEAR de Apple). Se usa para precios en USD.",
  },
  dca: {
    term: "DCA",
    definition:
      "Dollar Cost Averaging. Estrategia de aportes periódicos fijos para promediar el precio de compra.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
