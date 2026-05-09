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

function normalizarReporte(r: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(r.posiciones)) {
    r.posiciones = (r.posiciones as Record<string, unknown>[]).map((p) => ({
      ...p,
      estado: (() => {
        const v = ESTADO_MAP[p.estado as string] ?? p.estado;
        return VALID_ESTADO.includes(v as string) ? v : "ok";
      })(),
      accion: (() => {
        const v = ACCION_MAP[p.accion as string] ?? p.accion;
        return VALID_ACCION.includes(v as string) ? v : "mantener";
      })(),
    }));
  }
  if (Array.isArray(r.alertas)) {
    r.alertas = (r.alertas as Record<string, unknown>[]).map((a) => ({
      ...a,
      tipo: (() => {
        const v = ALERTA_TIPO_MAP[a.tipo as string] ?? a.tipo;
        return VALID_ALERTA_TIPO.includes(v as string) ? v : "info";
      })(),
    }));
  }
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
La estrategia objetivo está definida en el system prompt — úsala como referencia para evaluar cada posición.
Primero buscá en la web: (1) el CCL actual de hoy, (2) precio actual en USD de cada ticker relevante.
Luego generá el reporte mensual completo en JSON según las instrucciones.
Solo respondé con el JSON, sin texto adicional ni bloques de código.`,
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