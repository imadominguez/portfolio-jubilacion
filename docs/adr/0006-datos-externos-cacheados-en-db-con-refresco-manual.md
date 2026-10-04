# ADR-0006: Datos externos cacheados en DB con refresco manual

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0007, ADR-0015

## Contexto

La app depende de cuatro fuentes externas gratuitas y sin SLA: dolarapi.com (CCL actual), argentinadatos.com (CCL histórico, IPC, UVA/CER), Yahoo Finance (precios y benchmarks, con un flujo de autenticación frágil) y Anthropic (pago por uso). Llamarlas en cada render haría las páginas lentas y dependientes de la red, expondría la app a rate limits y, en el caso del histórico, repetiría descargas idénticas.

Además, el uso es mensual (ver [`flujo-de-uso.md`](../flujo-de-uso.md)): no hace falta precio en tiempo real, sino datos consistentes al momento de revisar la cartera.

## Decisión

- Todo dato externo se **persiste en tablas propias** y las páginas leen **solo de la base**:
  - `ExchangeRate` (CCL por fecha, único por `date`, upsert).
  - `MarketPriceCache` (último precio por subyacente).
  - `HistoricalPriceCache` (precio diario por subyacente).
  - `BenchmarkPoint` (S&P 500, Merval, NASDAQ, IPC, CER).
  - `PortfolioReport` (resultado del análisis con IA).
- La actualización es **manual y explícita**: botones en `/datos`, `/ccl`, `/assets`, el wizard de ganancia real y la carga on-demand de benchmarks/índices en `/performance`. No hay cron ni refresco automático.
- Antes de pedir históricos a Yahoo se consulta la base; un fallo de un ticker no aborta el resto.

## Alternativas

- **Fetch en el render (con o sin caché de Next):** páginas lentas y frágiles; Yahoo puede fallar la autenticación en cualquier momento.
- **Cron job (Vercel Cron) que refresque todo:** suma infraestructura y costo para un uso mensual; además los históricos solo se necesitan una vez.
- **Caché en memoria:** se pierde en cada cold start serverless.

## Consecuencias

**Positivas**

- Las páginas renderizan rápido y funcionan aunque las APIs externas estén caídas.
- Los históricos se descargan una vez y se reutilizan.

**Negativas / costos**

- Los datos pueden estar desactualizados si el usuario no aprieta "Actualizar"; la UI muestra fechas (`fetchedAt`) para hacerlo visible.
- Las llamadas externas no tienen timeout: un cuelgue bloquea la action (deuda técnica).

**Reglas para el código**

- Ninguna página ni helper de lectura llama a una API externa: solo actions de refresco disparadas por el usuario.
- Fechas de series diarias normalizadas a medianoche UTC para coincidir con `@db.Date`.
- Upsert por la clave natural (`date`, `ticker`, `[ticker, date]`, `[benchmarkId, date]`).

## Referencias

- `app/actions/exchange-rate.ts`, `market-prices.ts`, `historical-prices.ts`, `benchmarks.ts`, `indices.ts`.
- `.cursor/rules.md` (Price Cache Rules), [`integraciones.md`](../integraciones.md).
