import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { extractJson, normalizarReporte } from "@/lib/report-normalizer";

// El análisis con web_search + thinking puede tardar varios minutos: streaming + límite alto.
export const runtime = "nodejs";
export const maxDuration = 300;

// El timeout propio tiene que vencer antes que maxDuration: si no, la plataforma
// mata la función y el cliente no recibe el 504 descriptivo. Mantener < maxDuration.
const TIMEOUT_CAP_MS = 290_000;

// Precios Sonnet 5 (USD por millón de tokens): input $2, output $10.
// Cache write = 1.25× input ($2.5), cache read = 0.1× input ($0.2).
const PRICE_INPUT = 2 / 1_000_000;
const PRICE_OUTPUT = 10 / 1_000_000;
const PRICE_CACHE_WRITE = 2.5 / 1_000_000;
const PRICE_CACHE_READ = 0.2 / 1_000_000;

function estimateCostUsd(t: {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}): number {
  return (
    t.inputTokens * PRICE_INPUT +
    t.cacheCreationTokens * PRICE_CACHE_WRITE +
    t.cacheReadTokens * PRICE_CACHE_READ +
    t.outputTokens * PRICE_OUTPUT
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function guardarRespuesta(
  rawText: string,
  reporte: Record<string, unknown>,
  userId: string,
) {
  try {
    await db.portfolioReport.create({
      data: {
        fechaReporte: (reporte.fecha_reporte as string) ?? new Date().toISOString(),
        rawText,
        normalizedJson: reporte as Parameters<
          typeof db.portfolioReport.create
        >[0]["data"]["normalizedJson"],
        userId,
      },
    });
  } catch (err) {
    console.error("No se pudo guardar el reporte en DB:", err);
  }
}

export async function POST(request: NextRequest) {
  let abortedByTimeout = false;
  let abortedByClient = false;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    // Mismo criterio que la página /portfolio: cada análisis tiene costo en la API.
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol administrador." },
        { status: 403 },
      );
    }
    const userId = session.user.id;

    const strategy = await db.investmentStrategy.findFirst({ where: { isActive: true } });
    if (!strategy) {
      return NextResponse.json(
        {
          error:
            "No hay estrategia de inversión activa configurada. Configurala en /strategy.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("portfolio_pdf") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const controller = new AbortController();
    const timeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS ?? TIMEOUT_CAP_MS);
    const effectiveTimeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.min(timeoutMs, TIMEOUT_CAP_MS)
        : TIMEOUT_CAP_MS;
    const timeout = setTimeout(() => {
      abortedByTimeout = true;
      controller.abort();
    }, effectiveTimeout);

    // Si el cliente cancela el análisis, abortamos también la llamada a Anthropic.
    const onClientAbort = () => {
      abortedByClient = true;
      controller.abort();
    };
    request.signal.addEventListener("abort", onClientAbort);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
          max_tokens: 32000,
          stream: true,
          output_config: { effort: process.env.ANTHROPIC_EFFORT ?? "low" },
          system: strategy.content,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 12 }],
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
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      let detail = "";
      try {
        detail =
          (JSON.parse(err) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        detail = err.slice(0, 200);
      }
      const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
      return NextResponse.json(
        {
          error: `Error al llamar a la API de Claude (modelo ${model})${detail ? `: ${detail}` : "."}`,
        },
        { status: 500 },
      );
    }

    // Leer el stream SSE de Anthropic y acumular el texto del mensaje.
    let rawText = "";
    let stopReason: string | undefined;
    let inputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let outputTokens: number | undefined;

    const reader = response.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: "Anthropic no devolvió un stream de respuesta." },
        { status: 500 },
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt: {
            type?: string;
            content_block?: { type?: string };
            delta?: { type?: string; text?: string; stop_reason?: string };
            message?: {
              usage?: {
                input_tokens?: number;
                cache_creation_input_tokens?: number;
                cache_read_input_tokens?: number;
                output_tokens?: number;
                output_tokens_details?: { thinking_tokens?: number };
              };
            };
            usage?: {
              output_tokens?: number;
              output_tokens_details?: { thinking_tokens?: number };
            };
            error?: { message?: string };
          };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "message_start") {
            const u = evt.message?.usage;
            if (u) {
              inputTokens = u.input_tokens ?? 0;
              cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
              cacheReadTokens = u.cache_read_input_tokens ?? 0;
            }
          } else if (evt.type === "content_block_delta") {
            if (evt.delta?.type === "text_delta" && typeof evt.delta.text === "string") {
              rawText += evt.delta.text;
            }
          } else if (evt.type === "message_delta") {
            if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
            if (evt.usage?.output_tokens !== undefined)
              outputTokens = evt.usage.output_tokens;
          } else if (evt.type === "error") {
            throw new Error(evt.error?.message ?? "Error de streaming de Anthropic");
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      reader.releaseLock();
    }
    rawText = rawText.trim();

    const costUsd = estimateCostUsd({
      inputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      outputTokens: outputTokens ?? 0,
    });

    if (!rawText) {
      console.error("Claude no devolvió texto. stop_reason:", stopReason);
      return NextResponse.json(
        {
          error:
            stopReason === "max_tokens"
              ? "Claude agotó el límite de tokens antes de responder. Subí max_tokens o achicá la estrategia."
              : "Claude no devolvió texto en la respuesta.",
          stop_reason: stopReason,
        },
        { status: 500 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      const clean = extractJson(rawText);
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      console.error(
        "No se pudo parsear JSON. stop_reason:",
        stopReason,
        "rawText (primeros 2000):",
        rawText.slice(0, 2000),
      );
      return NextResponse.json(
        {
          error:
            stopReason === "max_tokens"
              ? "La respuesta de Claude se cortó por el límite de tokens (max_tokens) y quedó un JSON incompleto. Subí max_tokens o achicá la estrategia."
              : "La respuesta de Claude no fue JSON válido.",
          stop_reason: stopReason,
          raw: rawText.slice(0, 4000),
        },
        { status: 500 },
      );
    }

    const normalizado = normalizarReporte(parsed);
    await guardarRespuesta(rawText, normalizado, userId);

    return NextResponse.json(normalizado, {
      headers: { "x-estimated-cost-usd": costUsd.toFixed(6) },
    });
  } catch (error) {
    console.error("Error en analyze-portfolio:", error);
    if (abortedByTimeout) {
      return NextResponse.json(
        {
          error:
            "El análisis superó el tiempo máximo configurado (ANTHROPIC_TIMEOUT_MS) y se canceló. Probá de nuevo o subí el límite.",
        },
        { status: 504 },
      );
    }
    if (abortedByClient) {
      return NextResponse.json(
        { error: "Análisis cancelado por el usuario." },
        { status: 499 },
      );
    }
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
