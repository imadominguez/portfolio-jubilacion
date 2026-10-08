import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchTimeoutError, fetchWithTimeout } from "./http";

// fetch que nunca responde salvo que lo aborten, como una API colgada.
function hangingFetch(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("corta una API colgada con un error que nombra el servicio", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));
    const promise = fetchWithTimeout("https://ejemplo.test", { service: "Yahoo Finance", timeoutMs: 20 });
    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
    await expect(promise).rejects.toThrow("Yahoo Finance no respondió en 0 s");
  });

  it("devuelve la respuesta si llega a tiempo y pasa el resto de las opciones", async () => {
    const ok = new Response("ok", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithTimeout("https://ejemplo.test", {
      service: "dolarapi.com",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    expect(res).toBe(ok);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty("service");
  });

  it("propaga los errores que no son de timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(
      fetchWithTimeout("https://ejemplo.test", { service: "argentinadatos.com" })
    ).rejects.toThrow("fetch failed");
  });
});
