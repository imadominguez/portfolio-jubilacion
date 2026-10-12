# ADR-0024: El listado oficial de BYMA es la fuente de los ratios de CEDEAR

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Relacionados:** ADR-0006, ADR-0008, ADR-0021, ADR-0023

## Contexto

El ratio de cada CEDEAR (cuántos CEDEARs equivalen a una acción del subyacente)
lo carga un admin a mano en Activos. Ninguna API de precios lo informa, y un
ratio mal puesto multiplica o divide la valuación en USD de esa posición. Cuando
un usuario importa un snapshot con un CEDEAR que no está en el catálogo, sus
datos no aparecen hasta que alguien busca el ratio.

BYMA publica "CEDEARs Negociables en BYMA": un PDF con todos los CEDEARs de todos
los emisores, su código BYMA (el mismo que usa Cocos), el mercado del subyacente
y el ratio. Se actualiza con cada cambio de ratio y la URL del archivo cambia con
cada versión. No hay API oficial; el Excel de Comafi solo cubre sus programas y
está desactualizado.

## Decisión

Guardamos el listado de BYMA en la base (`CedearListingVersion` + `CedearListing`)
y lo usamos como fuente de los ratios. Un paso del cron diario lo baja cuando la
versión guardada tiene más de 7 días; el admin puede forzarlo desde Activos.

- La URL del PDF se busca en la página de CEDEARs de BYMA en cada actualización.
- El texto se extrae con `pdfjs-dist` y las filas se reconstruyen por posición
  (`lib/byma-listing.ts`, puro y testeado).
- Una versión se guarda solo si pasa la validación (ratios `a:b`, códigos
  válidos, más de 300 filas, fecha de versión). Si no, queda la anterior. El
  reemplazo es entero, en una transacción.
- El listado es dato de mercado global, como `Asset` (ADR-0008): no tiene
  `userId` y solo lo escribe el sistema (cron o acción de admin).
- El ratio del listado no se aplica solo sobre un `Asset` existente: un cambio
  de ratio sigue pasando por `CedearRatioChange` con su fecha (ADR-0023).

## Alternativas

- **Seguir cargando el ratio a mano**: es lo que deja a los usuarios sin datos
  hasta que un admin interviene.
- **Estimar el ratio con precios** (precio del subyacente × CCL ÷ precio del
  CEDEAR): el CCL implícito difiere unos puntos y un redondeo puede elegir mal.
  Queda como control cruzado, no como fuente.
- **Excel de Comafi**: estructurado, pero de un solo emisor y desactualizado.
- **Open BYMAData**: endpoints no documentados y sin ratios.

## Consecuencias

**Positivas**

- El ratio oficial está disponible sin buscarlo: el alta manual se precarga y el
  alta automática (PR 2 y 3 del plan) tiene una fuente confiable.
- Comparar versiones permite detectar splits.

**Negativas / costos**

- Dependencia nueva (`pdfjs-dist`) y un parser atado al diseño del PDF: si BYMA
  lo cambia, la actualización falla (sin romper nada) hasta adaptar el parser.
- Una descarga externa más en el cron.

**Reglas para el código**

- Toda descarga pasa por `fetchWithTimeout`.
- No se guarda una versión que no pase `validateListing`.
- El ratio se guarda como las dos partes del PDF; el valor que usa la app es
  `ratioCedear / ratioUnderlying` (CEDEARs por acción).

## Referencias

- `lib/byma-listing.ts`, `lib/market-refresh.ts` (`saveCedearListing`).
- [Plan de alta automática de activos](../plan-alta-automatica-activos.md).
