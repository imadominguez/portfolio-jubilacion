# ADR-0025: Los tickers nuevos de un snapshot generan un pedido de alta que el sistema resuelve en segundo plano

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Relacionados:** ADR-0008, ADR-0009, ADR-0024

## Contexto

El catálogo de `Asset` es global y solo lo escribe un admin (ADR-0008,
ADR-0009). Cuando un usuario común importa un snapshot con un ticker que no está
en el catálogo, esa posición queda sin valuación en USD ni análisis, y el admin
no se entera: el alta rápida de Activos solo muestra los faltantes del snapshot
del propio admin.

Con el listado oficial de BYMA (ADR-0024) y Yahoo se pueden proponer casi todos
los datos de un activo nuevo, pero buscarlos lleva varios segundos por ticker y
no puede bloquear el import.

## Decisión

El import registra un pedido (`AssetRequest`) por cada ticker que no está en el
catálogo y lo resuelve después de responder, con `after()`. El sistema arma una
propuesta (tipo, ratio, subyacente, sector, país) con un control explicado por
cada dato; un admin la aprueba desde Activos.

- `AssetRequest` es global, con el ticker como clave: varios usuarios comparten
  el pedido. Guarda el precio, la moneda, el CCL y la fecha del snapshot que lo
  pidió, para verificar el ratio sin volver a leer datos del usuario.
- El usuario no escribe el catálogo: solo genera pedidos de los tickers de su
  propio snapshot. El alta la hace el admin (`approveAssetRequest`, con
  `requireAdmin`); el activo queda con `source = AUTO` y `reviewedAt`.
- Estados: `PENDING` → `RUNNING` → `NEEDS_REVIEW` | `FAILED`; `DONE` al aprobar.
  El reclamo `PENDING → RUNNING` es un `updateMany` condicionado, para que dos
  procesos no tomen el mismo pedido. Un `RUNNING` de más de 15 minutos se
  considera colgado y vuelve a tomarse.
- Controles de un CEDEAR: figura en el listado de BYMA (por código o, si no, por
  nombre), cotiza en una bolsa de EE.UU., se encontró el subyacente en Yahoo y el
  precio del snapshot confirma el ratio (±10 %). Un FCI o un bono se propone con
  su tipo, ratio 1 y sin subyacente.
- `after()` invalida con `revalidateTag(tag, { expire: 0 })`: fuera de la acción
  no hay `updateTag`.
- En esta etapa todo termina en revisión; el alta automática de las propuestas
  que pasan todos los controles es el paso siguiente del plan.

## Alternativas

- **Que el usuario cargue el activo**: rompe ADR-0008 (un usuario editaría un
  dato que ven todos) y un ratio mal puesto afecta a todos los que lo tengan.
- **Resolver dentro del import**: varios segundos por ticker con Yahoo; el
  usuario espera y un timeout tira abajo un import ya guardado.
- **Una cola externa (Vercel Queues)**: más infraestructura para 1 a 5 tickers
  por import. La cola ya vive en la base; se puede migrar sin cambiar la lógica.

## Consecuencias

**Positivas**

- El admin ve qué falta en los snapshots de todos los usuarios, con los datos
  propuestos y por qué.
- El usuario sabe qué pasa: aviso al importar y un banner mientras haya
  pedidos de sus tickers.

**Negativas / costos**

- `after()` depende del `maxDuration` de la función: un corte deja el pedido en
  `RUNNING` hasta que se lo vuelva a tomar.
- Llamadas a Yahoo no documentadas (búsqueda y perfil) que pueden cambiar.

**Reglas para el código**

- La resolución es pura (`lib/asset-resolution.ts`); las consultas y escrituras
  viven en `lib/asset-requests-runner.ts`.
- `processAssetRequestsInBackground` no se exporta desde un archivo
  `"use server"`: sería invocable desde el cliente.
- Un error al registrar los pedidos no invalida el snapshot ya guardado.

## Referencias

- `lib/asset-resolution.ts`, `lib/asset-requests-runner.ts`,
  `app/actions/asset-requests.ts`, `components/assets/asset-requests-panel.tsx`,
  `components/dashboard/pending-assets-banner.tsx`.
- [Plan de alta automática de activos](../plan-alta-automatica-activos.md).
