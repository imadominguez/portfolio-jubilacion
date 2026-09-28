// Normalización del reporte mensual generado por Claude.
// Aísla el parseo del JSON y la coerción de campos para poder testearlo sin
// levantar la ruta HTTP.

export function extractJson(raw: string): string {
  // Quitar fences de markdown si el modelo los agregó
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No se encontró un objeto JSON en la respuesta");

  // Escanear hasta el cierre balanceado, ignorando llaves dentro de strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  throw new Error("JSON incompleto (respuesta truncada)");
}

const VALID_ESTADO = ["infrapon", "sobrepon", "ok", "ausente", "fuera_objetivo"];
const VALID_ACCION = ["agregar", "no_agregar", "evaluar", "mantener"];
const VALID_ALERTA_TIPO = ["critica", "advertencia", "oportunidad", "info"];
const VALID_SESGO = ["sobreponderar", "subponderar", "neutral", "saltear"];

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

const ESTADO_MAP: Record<string, string> = {
  neutro: "ok",
  sobrepond: "sobrepon",
  fuera_obj: "fuera_objetivo",
  fuera_objetivo_directo: "fuera_objetivo",
};
const ACCION_MAP: Record<string, string> = {
  evaluar_rotacion: "evaluar",
};
const ALERTA_TIPO_MAP: Record<string, string> = {
  ganancia: "oportunidad",
};

function normalizeSesgo(
  value: unknown,
  onlyIfProvided: boolean
): (typeof VALID_SESGO)[number] | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    return onlyIfProvided ? undefined : "neutral";
  }
  const s = String(value).trim().toLowerCase();
  if (VALID_SESGO.includes(s)) {
    return s as (typeof VALID_SESGO)[number];
  }
  return "neutral";
}

export function normalizarReporte(raw: Record<string, unknown>): Record<string, unknown> {
  const r = { ...raw };

  if (Array.isArray(r.posiciones)) {
    r.posiciones = (r.posiciones as Record<string, unknown>[]).map((p) => {
      const sesgo_mes = normalizeSesgo(p.sesgo_mes, true);
      const base = {
        ...p,
        cantidad: coerceNumber(p.cantidad),
        precio_cedear_ars: coerceNumber(p.precio_cedear_ars),
        valor_ars: coerceNumber(p.valor_ars),
        peso_actual: coerceNumber(p.peso_actual),
        peso_objetivo: coerceNumber(p.peso_objetivo),
        diferencia: coerceNumber(p.diferencia),
        ganancia_pct: coerceNumber(p.ganancia_pct),
        ppm_ars: coerceNumber(p.ppm_ars),
        variacion_mensual_pct:
          p.variacion_mensual_pct === undefined ? undefined : coerceNumber(p.variacion_mensual_pct),
        estado: (() => {
          const key = ESTADO_MAP[p.estado as string] ?? p.estado;
          return VALID_ESTADO.includes(key as string) ? key : "ok";
        })(),
        accion: (() => {
          const key = ACCION_MAP[p.accion as string] ?? p.accion;
          return VALID_ACCION.includes(key as string) ? key : "mantener";
        })(),
      };
      return sesgo_mes ? { ...base, sesgo_mes } : base;
    });
  } else {
    r.posiciones = [];
  }

  if (Array.isArray(r.alertas)) {
    r.alertas = (r.alertas as Record<string, unknown>[]).map((a) => ({
      ...a,
      tipo: (() => {
        const v = ALERTA_TIPO_MAP[a.tipo as string] ?? a.tipo;
        return VALID_ALERTA_TIPO.includes(v as string) ? v : "info";
      })(),
    }));
  } else {
    r.alertas = [];
  }

  let im = r.instruccion_mes as Record<string, unknown> | undefined;
  if (!im || typeof im !== "object") {
    im = { intro: "", asignaciones: [], no_invertir: [], total_ars: coerceNumber(r.aporte_mensual_ars) };
    r.instruccion_mes = im;
  }

  const rootVerify = r.verificacion_suma;
  if (
    typeof im.verificacion_suma !== "boolean" &&
    (rootVerify === true || rootVerify === false)
  ) {
    im.verificacion_suma = rootVerify;
  }
  delete r.verificacion_suma;

  if (Array.isArray(im.asignaciones)) {
    im.asignaciones = (im.asignaciones as Record<string, unknown>[]).map((a) => {
      const sesgo = normalizeSesgo(a.sesgo, false);
      return {
        ...a,
        monto_ars: coerceNumber(a.monto_ars),
        monto_usd: coerceNumber(a.monto_usd),
        peso_objetivo:
          a.peso_objetivo === undefined ? undefined : coerceNumber(a.peso_objetivo),
        peso_asignado_mes:
          a.peso_asignado_mes === undefined ? undefined : coerceNumber(a.peso_asignado_mes),
        sesgo,
      };
    });
  } else {
    im.asignaciones = [];
  }

  im.intro = typeof im.intro === "string" ? im.intro : "";
  im.total_ars =
    coerceNumber(im.total_ars) || coerceNumber(r.aporte_mensual_ars, 500_000);

  im.no_invertir = Array.isArray(im.no_invertir)
    ? (im.no_invertir as unknown[])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    : [];

  if (!Array.isArray(r.proximos_balances)) {
    r.proximos_balances = [];
  }

  if (!Array.isArray(r.dividendos_esperados)) {
    r.dividendos_esperados = [];
  }

  r.ccl_actual = coerceNumber(r.ccl_actual);
  r.valor_total_ars = coerceNumber(r.valor_total_ars);
  r.valor_total_usd = coerceNumber(r.valor_total_usd);
  r.aporte_mensual_ars = coerceNumber(r.aporte_mensual_ars, 500_000);
  r.aporte_mensual_usd = coerceNumber(r.aporte_mensual_usd);
  r.resumen_ejecutivo =
    typeof r.resumen_ejecutivo === "string" ? r.resumen_ejecutivo : "";

  return r;
}
