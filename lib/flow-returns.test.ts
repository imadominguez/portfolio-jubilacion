import { describe, expect, it } from "vitest";
import {
  flowsFromMovements,
  holdingsXirr,
  modifiedDietz,
  netContributions,
  returnSummary,
  twrBetween,
  twrIndex,
  xirr,
  type MovementForFlow,
} from "./flow-returns";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("flowsFromMovements", () => {
  const mov = (category: string, total: number, extra: Partial<MovementForFlow> = {}): MovementForFlow => ({
    date: day("2026-05-08"),
    category,
    currency: "ARS",
    total,
    instrument: "CEDEAR X",
    ...extra,
  });

  it("toma compras, ventas, FCI y dividendos, y deja afuera depósitos y pagos", () => {
    const { flows } = flowsFromMovements(
      [
        mov("TRADE_BUY", -1000),
        mov("TRADE_SELL", 300),
        mov("FCI_SUBSCRIPTION", -500),
        mov("FCI_REDEMPTION", 200),
        mov("DIVIDEND", 10),
        mov("RECEIPT", 1350000, { instrument: null }),
        mov("PAYMENT", -12844, { instrument: null }),
        mov("CONVERSION", 7, { instrument: null }),
      ],
      () => 1500
    );
    expect(flows.map((f) => f.amount)).toEqual([-1000, 300, -500, 200, 10]);
  });

  it("OTHER cuenta solo con instrumento (bonos para dólar MEP)", () => {
    const { flows } = flowsFromMovements(
      [mov("OTHER", -1093488), mov("OTHER", -800, { instrument: null })],
      () => 1500
    );
    expect(flows).toHaveLength(1);
  });

  it("convierte USD con el CCL de la fecha e informa los que no tienen CCL", () => {
    const { flows, sinCcl } = flowsFromMovements(
      [mov("TRADE_BUY", -100, { currency: "USD" }), mov("TRADE_BUY", -50, { currency: "USD", date: day("2020-01-01") })],
      (d) => (d.getUTCFullYear() === 2026 ? 1500 : null)
    );
    expect(flows).toEqual([{ date: day("2026-05-08"), amount: -150000 }]);
    expect(sinCcl).toBe(1);
  });
});

describe("modifiedDietz", () => {
  it("sin flujos es la variación simple", () => {
    expect(modifiedDietz({ date: day("2026-01-01"), value: 100 }, { date: day("2026-12-31"), value: 110 }, [])).toBeCloseTo(10);
  });

  it("un aporte no cuenta como rendimiento", () => {
    // 100 → aporta 100 a mitad de período → termina en 200: rendimiento 0.
    const r = modifiedDietz(
      { date: day("2026-01-01"), value: 100 },
      { date: day("2026-12-31"), value: 200 },
      [{ date: day("2026-07-02"), amount: -100 }]
    );
    expect(r).toBeCloseTo(0, 1);
  });

  it("un retiro no cuenta como pérdida", () => {
    const r = modifiedDietz(
      { date: day("2026-01-01"), value: 200 },
      { date: day("2026-12-31"), value: 110 },
      [{ date: day("2026-01-02"), amount: 100 }]
    );
    expect(r).toBeCloseTo(10, 0);
  });
});

describe("twrIndex / twrBetween", () => {
  const points = [
    { date: day("2025-01-01"), value: 100 },
    { date: day("2025-07-01"), value: 1210 }, // aporte de 1000 el 2/1; todo rinde +10%
    { date: day("2026-01-01"), value: 1331 }, // +10%
  ];
  const flows = [{ date: day("2025-01-02"), amount: -1000 }];

  it("encadena los períodos sin contar el aporte", () => {
    const idx = twrIndex(points, flows);
    expect(idx[0].index).toBe(100);
    expect(idx[2].index!).toBeGreaterThan(118);
    expect(idx[2].index!).toBeLessThan(123);
  });

  it("devuelve el rendimiento acumulado entre dos snapshots", () => {
    expect(twrBetween(points, flows, day("2025-07-01"), day("2026-01-01"))).toBeCloseTo(10);
    expect(twrBetween(points, flows, day("2026-01-01"), day("2026-01-01"))).toBeNull();
  });
});

describe("xirr / holdingsXirr", () => {
  it("un año exacto al 10%", () => {
    expect(xirr([{ date: day("2025-01-01"), amount: -100 }, { date: day("2026-01-01"), amount: 110 }])).toBeCloseTo(10, 4);
  });

  it("descuenta aportes intermedios", () => {
    // Aporta 100 y 100 a mitad de año; termina con 220: TIR > 0 pero muy lejos del +120% del valor.
    const r = holdingsXirr(
      [{ date: day("2025-01-01"), value: 100 }, { date: day("2026-01-01"), value: 220 }],
      [{ date: day("2025-07-02"), amount: -100 }]
    )!;
    expect(r).toBeGreaterThan(10);
    expect(r).toBeLessThan(30);
  });

  it("null sin flujos de ambos signos", () => {
    expect(xirr([{ date: day("2025-01-01"), amount: -100 }])).toBeNull();
    expect(xirr([{ date: day("2025-01-01"), amount: -100 }, { date: day("2026-01-01"), amount: -50 }])).toBeNull();
  });
});

describe("netContributions", () => {
  it("suma aportes y resta retiros dentro del período (excluye el día de inicio)", () => {
    const flows = [
      { date: day("2026-01-01"), amount: -999 },
      { date: day("2026-02-01"), amount: -1000 },
      { date: day("2026-03-01"), amount: 300 },
      { date: day("2026-12-31"), amount: 10 },
    ];
    expect(netContributions(flows, day("2026-01-01"), day("2026-12-31"))).toBe(690);
  });
});

describe("returnSummary", () => {
  const points = [
    { date: day("2024-12-31"), value: 100 },
    { date: day("2025-12-31"), value: 1210 }, // aporte de 1000 el 1/1; todo rinde +10%
    { date: day("2026-06-30"), value: 1331 }, // +10%
  ];
  const flows = [{ date: day("2025-01-01"), amount: -1000 }];

  it("toma la base del año y descuenta los aportes", () => {
    const s = returnSummary(points, flows, 2026)!;
    expect(s.yearBase).toEqual(day("2025-12-31"));
    expect(s.yearReturnPct).toBeCloseTo(10);
    expect(s.yearGain).toBeCloseTo(121);
    expect(s.maxDrawdownPct).toBe(0);
    expect(s.periodReturnByEnd.get(day("2026-06-30").getTime())).toBeCloseTo(10);
  });

  it("anualiza el TWR y la TIR del período completo", () => {
    const s = returnSummary(points, flows, 2026)!;
    expect(s.years).toBeCloseTo(1.5, 1);
    expect(s.twrAnnualPct!).toBeGreaterThan(13);
    expect(s.twrAnnualPct!).toBeLessThan(15);
    expect(s.tirPct!).toBeGreaterThan(9);
  });

  it("no anualiza con menos de ~1 mes y devuelve null sin puntos", () => {
    const s = returnSummary([{ date: day("2026-01-01"), value: 100 }, { date: day("2026-01-10"), value: 101 }], [], 2026)!;
    expect(s.tirPct).toBeNull();
    expect(s.twrAnnualPct).toBeNull();
    expect(returnSummary([], [], 2026)).toBeNull();
  });
});
