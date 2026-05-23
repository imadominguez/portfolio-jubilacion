import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1)
    throw new Error("No se encontró un objeto JSON en la respuesta");
  return raw.slice(start, end + 1);
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

function normalizarReporte(raw: Record<string, unknown>): Record<string, unknown> {
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

async function guardarRespuesta(rawText: string, reporte: Record<string, unknown>) {
  try {
    await db.portfolioReport.create({
      data: {
        fechaReporte: (reporte.fecha_reporte as string) ?? new Date().toISOString(),
        rawText,
        normalizedJson: reporte as Parameters<typeof db.portfolioReport.create>[0]["data"]["normalizedJson"],
      },
    });
  } catch (err) {
    console.error("No se pudo guardar el reporte en DB:", err);
  }
}


export async function POST(request: NextRequest) {
  try {
    const strategy = await db.investmentStrategy.findFirst({ where: { isActive: true } });
    if (!strategy) {
      return NextResponse.json(
        { error: "No hay estrategia de inversión activa configurada. Configurala en /strategy." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("portfolio_pdf") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: strategy.content,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              {
                type: "text",
                text: `Analizá este PDF de mi tenencia en Cocos Capital.
El PDF contiene el estado actual del portafolio: posiciones reales, cantidades, precios en ARS y pesos actuales. Usá esos datos como fuente de verdad del estado presente — no uses el system prompt como reflejo del estado actual.
La estrategia objetivo y el formato exacto del JSON están en el system prompt — seguí ese esquema al pie de la letra.

Buscá en la web antes de responder: (1) CCL actual de hoy, (2) precio en USD y variación mensual de cada ticker relevante del portafolio, (3) noticias o catalizadores recientes cuando afecten alguna posición.

Generá únicamente el JSON del reporte mensual según las instrucciones del system.
No agregues markdown, explicaciones ni bloques \`\`\` — solo el objeto JSON.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "Error al llamar a la API de Claude." }, { status: 500 });
    }

    const data = await response.json();
    const textBlocks = data.content.filter((b: { type: string }) => b.type === "text");
    const rawText = textBlocks.map((b: { text: string }) => b.text).join("");

    let parsed: Record<string, unknown>;
    try {
      const clean = extractJson(rawText);
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      console.error("No se pudo parsear JSON:", rawText);
      return NextResponse.json(
        { error: "La respuesta de Claude no fue JSON válido.", raw: rawText },
        { status: 500 }
      );
    }

    const normalizado = normalizarReporte(parsed);
    await guardarRespuesta(rawText, normalizado);

    return NextResponse.json(normalizado);
  } catch (error) {
    console.error("Error en analyze-portfolio:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}