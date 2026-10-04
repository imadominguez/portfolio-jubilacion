# ADR-0007: Cliente propio de Yahoo Finance en lugar de `yahoo-finance2`

- **Estado:** Aceptado
- **Fecha:** 2026-04-21 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0006

## Contexto

La app necesita precios actuales e históricos en USD de los subyacentes de los CEDEARs (NYSE/NASDAQ) y de índices (S&P 500, Merval, NASDAQ). Yahoo Finance es la fuente gratuita más completa, pero no tiene API oficial y desde 2023 exige un flujo de **cookie + crumb** para sus endpoints.

Originalmente se usaba el paquete `yahoo-finance2`. Según el comentario del módulo, su manejo interno de ese flujo no funcionaba de forma confiable en todos los entornos de servidor (serverless/Vercel).

## Decisión

Reemplazamos `yahoo-finance2` por un cliente propio y mínimo, `lib/yahoo-finance-client.ts`, con `fetch` nativo:

1. `GET https://fc.yahoo.com` con User-Agent de Chrome para obtener cookies de sesión.
2. `GET /v1/test/getcrumb` (`query1`, fallback `query2`) para el crumb.
3. Cookie + crumb cacheados a nivel de módulo por **23 horas**.
4. Solo dos funciones: `getQuotes(symbols)` (`/v7/finance/quote`) y `getHistorical(symbol, from, to)` (`/v8/finance/chart`), que descarta velas sin `close` y normaliza fechas a medianoche UTC.

## Alternativas

- **Seguir con `yahoo-finance2`:** más completo, pero era la fuente de los fallos en servidor y trae mucha superficie que la app no usa.
- **API paga (Alpha Vantage, Polygon, Twelve Data):** más estable, pero con costo o límites gratuitos chicos para un uso personal.
- **Scraping de otra fuente:** igual de frágil, con peor cobertura de históricos.

## Consecuencias

**Positivas**

- Control total sobre el flujo de autenticación y los headers; sin dependencias.
- Unas 170 líneas fáciles de leer y de ajustar cuando Yahoo cambia algo.

**Negativas / costos**

- Somos responsables de seguir los cambios de Yahoo (endpoints no documentados).
- Sin timeout ni `AbortController`, y sin reintento de re-auth si el crumb expira antes de las 23 h (deuda técnica).
- La caché de módulo se pierde en cada cold start, lo que fuerza un nuevo handshake.

**Reglas para el código**

- Todo acceso a Yahoo pasa por `lib/yahoo-finance-client.ts`; no agregar otra librería de Yahoo.
- Los consumidores (actions de refresco) persisten el resultado según ADR-0006; nunca se llama en el render.

## Referencias

- `lib/yahoo-finance-client.ts` (comentario de cabecera), commit `ab70262` ("Remove dependency on yahoo-finance2 package").
- [`integraciones.md`](../integraciones.md#4-yahoo-finance--precios).
