// fetch con timeout para las APIs externas (Yahoo Finance, dolarapi,
// argentinadatos). Sin límite, una API colgada deja la Server Action esperando
// hasta el maxDuration de la función y el usuario no recibe ningún error.

export const DEFAULT_TIMEOUT_MS = 15_000;

export class FetchTimeoutError extends Error {
  constructor(service: string, timeoutMs: number) {
    super(`${service} no respondió en ${Math.round(timeoutMs / 1000)} s. Probá de nuevo en unos minutos.`);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { service: string; timeoutMs?: number }
): Promise<Response> {
  const { service, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    // AbortSignal.timeout rechaza con un DOMException "TimeoutError".
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new FetchTimeoutError(service, timeoutMs);
    }
    throw error;
  }
}
