# ADR-0027: Los cambios de ratio se detectan comparando el catálogo con el listado de BYMA

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Relacionados:** ADR-0023, ADR-0024

## Contexto

Un split de CEDEAR (SPY pasó de 20:1 a 60:1) se registraba solo cuando alguien
notaba números raros: Cocos acredita los CEDEARs nuevos sin movimiento, y hasta
que un admin cargaba la `CedearRatioChange` el PPM y la tenencia no cerraban.
El listado de BYMA (ADR-0024) ya trae el ratio vigente de cada CEDEAR, pero no
la fecha desde la que rige.

## Decisión

Después de cada revisión del listado (cron diario y botón de Activos) se compara
el ratio de cada CEDEAR del catálogo con el del listado. Cada diferencia nueva
se guarda como `RatioChangeProposal` y se avisa a los admins por mail. El admin
la aplica con la fecha del split, como corrección sin fecha, o la descarta.

- Aplicar con fecha pasa por `updateAsset` con `ratioChangeDate`: se crea la
  `CedearRatioChange` y las operaciones anteriores se ajustan al leerlas
  (ADR-0023). La fecha sugerida es la de la versión del listado.
- La clave es `(ticker, newRatio)`: una propuesta descartada no se vuelve a
  proponer con el mismo ratio.
- Una propuesta pendiente que el catálogo ya refleja (un admin cargó el ratio a
  mano) se cierra sola.
- Solo se comparan los CEDEARs que figuran en el listado con el mismo código; un
  código distinto (Nu Holdings figura como `UN`) no genera propuestas.

## Alternativas

- **Aplicar el ratio del listado solo**: sin la fecha del split, las compras
  anteriores quedarían mal ajustadas.
- **Inferir la fecha con precios** (el salto del precio del CEDEAR): los snapshots
  son espaciados y el ruido del CCL lo hace poco confiable; queda como mejora.

## Consecuencias

**Positivas**

- Un split publicado por BYMA llega al admin en el día, con el ratio nuevo listo.

**Negativas / costos**

- El admin tiene que conocer o buscar la fecha efectiva del split.

**Reglas para el código**

- Las propuestas no cambian el catálogo por sí solas; solo `applyRatioProposal`
  (admin) lo hace, y siempre por `updateAsset`.
- `detectRatioChanges` es idempotente: correrlo dos veces no duplica ni re-avisa.

## Referencias

- `lib/byma-listing.ts` (`diffCatalogRatios`), `lib/asset-requests-runner.ts`
  (`detectRatioChanges`), `app/actions/asset-requests.ts`,
  `components/assets/ratio-proposals-panel.tsx`.
- [Plan de alta automática de activos](../plan-alta-automatica-activos.md).
