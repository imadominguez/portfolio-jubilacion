import { describe, expect, it } from "vitest";
import { extractJson, normalizarReporte } from "./report-normalizer";

describe("extractJson", () => {
  it("extrae el objeto aunque venga con fences de markdown", () => {
    const raw = '```json\n{"a": 1}\n```';
    expect(extractJson(raw)).toBe('{"a": 1}');
  });

  it("ignora llaves dentro de strings", () => {
    const raw = 'texto {"msg": "hola {mundo}", "n": 2} resto';
    expect(extractJson(raw)).toBe('{"msg": "hola {mundo}", "n": 2}');
  });

  it("lanza si no hay JSON", () => {
    expect(() => extractJson("sin objeto")).toThrow();
  });
});

describe("normalizarReporte", () => {
  it("normaliza strings numéricos y completa arrays faltantes", () => {
    const out = normalizarReporte({
      posiciones: [{ ticker: "MSFT", cantidad: "12", peso_actual: "8.5", estado: "neutro" }],
      aporte_mensual_ars: "500000",
    });

    const pos = (out.posiciones as Record<string, unknown>[])[0];
    expect(pos.cantidad).toBe(12);
    expect(pos.peso_actual).toBe(8.5);
    expect(pos.estado).toBe("ok");
    expect(pos.accion).toBe("mantener");
    expect(out.alertas).toEqual([]);
    expect(out.proximos_balances).toEqual([]);
    expect(out.dividendos_esperados).toEqual([]);
    expect(out.aporte_mensual_ars).toBe(500000);
  });

  it("construye instruccion_mes por defecto y mueve verificacion_suma", () => {
    const out = normalizarReporte({ verificacion_suma: true, aporte_mensual_ars: 100 });
    const im = out.instruccion_mes as Record<string, unknown>;
    expect(im.verificacion_suma).toBe(true);
    expect(im.total_ars).toBe(100);
    expect(im.asignaciones).toEqual([]);
    expect(out.verificacion_suma).toBeUndefined();
  });

  it("sanea valores inválidos de estado, acción y alerta", () => {
    const out = normalizarReporte({
      posiciones: [{ estado: "cualquiera", accion: "evaluar_rotacion" }],
      alertas: [{ tipo: "ganancia" }, { tipo: "desconocido" }],
    });
    const pos = (out.posiciones as Record<string, unknown>[])[0];
    expect(pos.estado).toBe("ok");
    expect(pos.accion).toBe("evaluar");
    const alertas = out.alertas as Record<string, unknown>[];
    expect(alertas[0].tipo).toBe("oportunidad");
    expect(alertas[1].tipo).toBe("info");
  });
});
