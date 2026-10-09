import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { userTags } from "@/lib/cache-tags";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { getLatestSnapshot } from "@/lib/portfolio-data";
import { calculatePPM } from "@/app/actions/transactions";
import { getAssetCatalog } from "@/app/actions/assets";
import { getHistorical, getNews } from "@/lib/yahoo-finance-client";
import { priceSignals, selectNews } from "@/lib/opportunity-signals";
import {
  OpportunityAnalysisSchema,
  buildAnalysisInput,
  estimateCostUsd,
  modelRequestOptions,
  type Effort,
  type OpportunityReport,
  type PositionInput,
} from "@/lib/opportunity-report";
import { mapLimit } from "@/lib/map-limit";

// Reporte de oportunidades (ADR-0018): la app junta precios (Yahoo) y titulares
// de noticias por acción, y Claude solo decide compra / mantener / venta.
// Corre en el runtime de Node.js (el default; Cache Components no admite el
// export `runtime`).
export const maxDuration = 300;

// El timeout propio tiene que vencer antes que maxDuration: si no, la plataforma
// mata la función y el cliente no recibe el 504 descriptivo. Mantener < maxDuration.
const TIMEOUT_CAP_MS = 290_000;
const DEFAULT_MODEL = "claude-sonnet-5-5";
// Pedidos a Yahoo en paralelo, sin saturar la API.
const YAHOO_CONCURRENCY = 4;
const HISTORY_DAYS = 370;

function fechaHoy(): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

export async function POST(request: NextRequest) {
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
        { error: "No hay estrategia activa configurada. Configurala en /strategy." },
        { status: 500 },
      );
    }

    const [snapshot, ppm, assets] = await Promise.all([
      getLatestSnapshot(),
      calculatePPM(),
      getAssetCatalog(),
    ]);
    if (!snapshot || snapshot.positions.length === 0) {
      return NextResponse.json(
        { error: "No hay snapshots importados. Importá tu tenencia desde Snapshots o el Dashboard." },
        { status: 400 },
      );
    }

    const underlyingByTicker = new Map(assets.map((a) => [a.ticker, a.underlyingTicker]));
    const avgPriceByTicker = new Map(
      ppm.filter((p) => p.currency === "ARS").map((p) => [p.ticker, p.avgPrice]),
    );
    const from = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

    // Precio y noticias por posición; una acción que falla no tumba el reporte.
    const gathered = await mapLimit(snapshot.positions, YAHOO_CONCURRENCY, async (pos) => {
      const underlying = underlyingByTicker.get(pos.ticker);
      if (!underlying) return { ticker: pos.ticker, input: null };
      try {
        const [history, news] = await Promise.all([
          getHistorical(underlying, from),
          getNews(underlying).catch(() => []),
        ]);
        const signals = priceSignals(history);
        if (!signals) return { ticker: pos.ticker, input: null };
        const input: PositionInput = {
          ticker: pos.ticker,
          underlying,
          companyName: pos.instrumentName,
          priceArs: pos.price,
          avgPriceArs: avgPriceByTicker.get(pos.ticker) ?? null,
          signals,
          news: selectNews(news, underlying, { companyName: pos.instrumentName }),
        };
        return { ticker: pos.ticker, input };
      } catch {
        return { ticker: pos.ticker, input: null };
      }
    });

    const positions = gathered.flatMap((g) => (g.input ? [g.input] : []));
    const sinDatos = gathered.filter((g) => !g.input).map((g) => g.ticker);
    if (positions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se pudieron obtener precios para ninguna posición. Revisá que los assets tengan subyacente cargado o probá de nuevo en unos minutos.",
        },
        { status: 502 },
      );
    }

    const timeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS ?? TIMEOUT_CAP_MS);
    const effectiveTimeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, TIMEOUT_CAP_MS) : TIMEOUT_CAP_MS;
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    const effort = (process.env.ANTHROPIC_EFFORT ?? "low") as Effort;
    // Solo los parámetros que acepta el modelo elegido (un 400 si no).
    const opts = modelRequestOptions(model, effort);

    const client = new Anthropic({ timeout: effectiveTimeout, maxRetries: 1 });
    const response = await client.beta.messages.parse(
      {
        model,
        max_tokens: 16000,
        system: strategy.content,
        messages: [{ role: "user", content: buildAnalysisInput(positions, snapshot.snapshotDate) }],
        output_config: {
          format: betaZodOutputFormat(OpportunityAnalysisSchema),
          ...(opts.effort ? { effort: opts.effort } : {}),
        },
        ...(opts.thinking ? { thinking: opts.thinking } : {}),
        ...(opts.fallbacks ?? {}),
      },
      // Si el usuario cancela el análisis, se corta también la llamada a Claude.
      { signal: request.signal },
    );

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude declinó generar el análisis. Probá de nuevo más tarde." },
        { status: 502 },
      );
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return NextResponse.json(
        {
          error:
            response.stop_reason === "max_tokens"
              ? "La respuesta se cortó por el límite de tokens. Probá con menos posiciones o un effort más bajo."
              : "La respuesta de Claude no tuvo el formato esperado.",
          stop_reason: response.stop_reason,
        },
        { status: 500 },
      );
    }

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    const reporte: OpportunityReport = {
      version: 2,
      ...response.parsed_output,
      fecha_reporte: fechaHoy(),
      snapshot_fecha: snapshot.snapshotDate.toISOString().slice(0, 10),
      posiciones_sin_datos: sinDatos,
      uso: { model: response.model, ...usage, costUsd: estimateCostUsd(response.model, usage) },
    };

    try {
      await db.portfolioReport.create({
        data: {
          fechaReporte: reporte.fecha_reporte,
          rawText: JSON.stringify(response.parsed_output),
          normalizedJson: reporte as unknown as Parameters<
            typeof db.portfolioReport.create
          >[0]["data"]["normalizedJson"],
          userId,
        },
      });
      // Historial de señales y Plan DCA (updateTag solo funciona en Server Actions).
      revalidateTag(userTags.reports(userId), "max");
    } catch (err) {
      // El reporte ya se generó (y se pagó): se devuelve aunque no se pueda guardar.
      console.error("No se pudo guardar el reporte en DB:", err);
    }

    return NextResponse.json(reporte);
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError) {
      return NextResponse.json({ error: "Análisis cancelado por el usuario." }, { status: 499 });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json(
        {
          error:
            "El análisis superó el tiempo máximo configurado (ANTHROPIC_TIMEOUT_MS) y se canceló. Probá de nuevo.",
        },
        { status: 504 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "La API de Claude está limitando pedidos. Esperá un minuto y probá de nuevo." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", error.status, error.message);
      return NextResponse.json(
        { error: `Error al llamar a la API de Claude: ${error.message}` },
        { status: 500 },
      );
    }
    console.error("Error en analyze-portfolio:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
