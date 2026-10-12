# Plan: alta automática de activos con el listado de BYMA

Estado: en curso. PR 1 (listado de BYMA) y PR 2 (pedidos y revisión, [ADR-0025](./adr/0025-pedidos-de-alta-de-activos-desde-el-import.md)) hechos; PR 3 (alta automática, [ADR-0026](./adr/0026-alta-automatica-de-activos-con-controles-en-verde.md)) hecho; PR 4 pendiente.
Decisión de arquitectura: [ADR-0024](./adr/0024-listado-oficial-de-byma-como-fuente-de-ratios.md).

## Problema

Un usuario común importa un snapshot con tickers que no están en el catálogo de
`Asset`. Hasta que un admin los carga a mano (ratio, subyacente, sector, país),
esas posiciones no tienen valuación en USD, ganancia real, concentración ni
señales. El dato difícil es el **ratio del CEDEAR**: Yahoo no lo da.

## Objetivo

Cuando aparece un ticker nuevo, el sistema busca sus datos **en segundo plano**
y da de alta el activo sin intervención cuando la fuente oficial y una
verificación independiente coinciden. Si no, lo deja listo para que un admin lo
apruebe con un clic. El import nunca espera ese proceso.

## Fuentes evaluadas

| Fuente | Formato | Actualización | Cobertura | Uso |
|---|---|---|---|---|
| BYMA, "CEDEARs Negociables en BYMA" | PDF enlazado desde byma.com.ar (la URL cambia con cada versión) | Al día (versión con fecha en el documento) | Todos los emisores; códigos iguales a los de Cocos (`BRKB`) | **Fuente del ratio** |
| Comafi, "Lista total de CEDEARs" | Excel | Desactualizado (marzo 2025) | Solo programas de Comafi | Descartado |
| Open BYMAData | Endpoints no documentados | — | Precios, sin ratios | Descartado |

El PDF trae nombre de la compañía, código BYMA, mercado donde cotiza el
subyacente y ratio `CEDEAR:subyacente` (también invertidos, como `1:3`).

Hallazgos del PR 1 (versión del 16/09/2026): 445 CEDEARs; los 19 CEDEARs del
catálogo coinciden con el listado. La fuente tiene errores puntuales: Nu Holdings
figura con el código `UN` (en Cocos es `NU`). Por eso el PR 2 busca también por
nombre cuando el código no aparece, y el control cruzado con precios es
obligatorio. Los activos que faltaban al implementar eran FCI de Cocos, que no
están en el listado: los resuelve la clasificación por tipo del paso 1.

## 1. Listado de BYMA (PR 1)

**Tablas globales** (dato de mercado, ADR-0008):
- `CedearListingVersion`: fecha de la versión ("Actualizado dd/mm/aaaa"), URL, cuándo se bajó y cuántas filas trajo.
- `CedearListing`: una fila por CEDEAR con código BYMA (único), nombre, mercado, ratio en dos partes (`ratioCedear`, `ratioUnderlying`) y la versión de la que salió.

**Actualización:** paso dentro del cron diario existente; baja el listado solo si
la versión guardada tiene más de 7 días. El admin también puede forzarla desde
Activos.
1. Lee la página de CEDEARs de BYMA y busca el link al PDF (`…BYMA-CEDEARs.pdf`).
2. Extrae el texto con `pdfjs-dist` (texto + coordenadas).
3. Reconstruye las filas por altura (con tolerancia: nombre y código difieren en
   ±1 punto) y asigna columnas según la posición de los encabezados.
4. Valida: ratio `a:b` positivo, código de 1 a 8 caracteres, más de 300 filas y
   fecha de versión. Si falla, conserva la versión anterior y el cron lo reporta.
   El listado se reemplaza entero en una transacción, nunca a medias.

**En Activos:** versión vigente y el alta rápida precarga el ratio oficial de los
tickers faltantes.

## 2. Detección y cola (PR 2)

- Tabla global `AssetRequest`: `ticker` (único), `instrumentName` del CSV,
  `status` (`PENDING` → `RUNNING` → `DONE` | `NEEDS_REVIEW` | `FAILED`),
  `attempts`, `lastError`, `proposal` (JSON con lo encontrado y el motivo),
  `requestedBy`, fechas.
- `Asset` suma `source` (`MANUAL` | `AUTO`) y `reviewedAt`.
- `importSnapshot` guarda como hoy, registra los tickers sin `Asset` (upsert),
  responde enseguida y dispara `after(() => processAssetRequests(tickers))`.
- El usuario no escribe el catálogo: solo pide datos de tickers de su propio
  snapshot; escribe el sistema.

## 3. Resolución de cada ticker (PR 2 propone, PR 3 da de alta)

0. Reclamar el pedido (`PENDING → RUNNING` con `updateMany`), para que dos
   imports no lo procesen dos veces.
1. Clasificar por el nombre del CSV: `CEDEAR …` sigue; FCI → `assetKind = FCI`;
   bonos, ONs y acciones locales → `OTHER` sin precio externo.
2. Ratio desde `CedearListing`. Si no figura → `NEEDS_REVIEW`.
3. Subyacente: búsqueda en Yahoo por nombre, con un resultado del mismo mercado
   (`BRKB` → `BRK-B`). Solo NYSE, NASDAQ y NYSE Arca se dan de alta solos (la app
   asume precios en USD); otros mercados van a revisión.
4. Control cruzado: ratio implícito = cierre del subyacente en la fecha del
   snapshot × CCL del snapshot ÷ precio del CEDEAR. Desvío < 10 % contra BYMA →
   confirmado; si no, revisión.
5. Perfil de Yahoo (sector, industria, país; ETF → `sector = "ETF"`). Sin perfil
   se da de alta igual.
6. Alta (2, 3 y 4 cumplidos): `Asset` con `source = AUTO`, precio e históricos
   solo de ese ticker, invalidación de `assets`, `marketPrices`,
   `historicalPrices`; pedido en `DONE`.
7. Si no: `NEEDS_REVIEW` con la propuesta y mail al admin.
8. Error externo: `FAILED`, `attempts + 1`.

Reintentos en el cron diario (`PENDING`, `FAILED` con menos de 5 intentos,
`RUNNING` de más de 15 minutos). Máximo 10 tickers por corrida, llamadas en serie.

## 4. Qué ve cada uno

- **Usuario:** aviso al importar ("Encontramos 2 activos nuevos…"), banner en
  Dashboard y Cartera mientras haya pendientes (refresca cada ~15 s), y aviso si
  quedó esperando a un admin.
- **Admin (Activos):** pedidos con su estado; los `NEEDS_REVIEW` abren el alta
  rápida precargada; badge "Revisar" en los `AUTO`; versión del listado.

A confirmar al implementar: si `updateTag` funciona dentro de `after()` o hace
falta `revalidateTag`.

## 5. Splits desde el listado (PR 4)

Al guardar una versión nueva, se compara cada ratio con el `cedearRatio` de su
`Asset`. Si cambió, se propone el cambio; el admin confirma la fecha efectiva
(el PDF no la trae) y se crea la `CedearRatioChange` (ADR-0023).

## 6. Tests (datos sintéticos)

- Parser del listado: filas partidas, ratios `a:b` e invertidos, validación y
  rechazo de un listado incompleto (textos con coordenadas armados a mano).
- Resolución: clasificación, coincidencia del ratio estimado, elección del
  subyacente por mercado.
- Cola: transiciones, reclamo, reintentos y pedidos colgados.

## 7. Entregas

| PR | Contenido | Ya sirve para |
|---|---|---|
| 1 | Tablas del listado, parser, `saveCedearListing`, paso en el cron, vista y precarga en Activos, ADR-0024 | El admin carga ratios oficiales sin buscarlos |
| 2 | `AssetRequest`, detección en el import, `after()`, avisos y banner; todo termina en `NEEDS_REVIEW` con la propuesta | Alta en un clic; el usuario sabe qué pasa |
| 3 | Alta automática con los tres controles, precios e históricos por ticker, mail, reintentos | Sin intervención en el caso normal |
| 4 | Detección de splits desde el listado | Ratios al día |

Cada PR con migración aditiva (`prisma migrate deploy` antes del merge) y docs.

## 8. Riesgos

| Riesgo | Cobertura |
|---|---|
| BYMA cambia el formato o la URL del PDF | Se rechaza la versión nueva, se sigue con la anterior y el cron lo reporta |
| Listado desactualizado | El control cruzado con precios lo manda a revisión |
| Ratio incorrecto | Ningún alta sin coincidencia de BYMA y estimación; queda `AUTO` para revisar |
| `after()` se corta | El cron reprocesa los colgados |
| Yahoo cambia búsqueda o perfil | Sin perfil se da de alta igual; sin búsqueda, revisión |

## Decisiones tomadas

- Alta automática solo con los tres controles.
- Lo que no es CEDEAR se da de alta con su tipo y sin precio externo.
- Mercados que no son de EE.UU. siempre a revisión.
