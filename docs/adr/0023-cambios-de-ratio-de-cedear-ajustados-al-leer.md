# ADR-0023: Los cambios de ratio de CEDEAR se registran aparte y se aplican al leer las operaciones

- **Estado:** Aceptado
- **Fecha:** 2026-10-11
- **Relacionados:** ADR-0008, ADR-0012, ADR-0016

## Contexto

BYMA a veces cambia el ratio de un CEDEAR. Por ejemplo, SPY pasó de 20:1 a 60:1 entre el 29/05 y el 01/06/2026, y acreditó 2 CEDEARs más por cada uno. Cocos acredita esas unidades sin dejar ningún movimiento en el CSV de actividad, así que el libro tiene un tercio de los SPY que muestra la tenencia (el snapshot). Con ese desfasaje:

- el PPM reparte el costo entre un tercio de las unidades y da el triple, y la posición figura con pérdida aunque tenga ganancia;
- la ganancia real calcula las acciones subyacentes como `cantidad / ratio de hoy` y le quedan un tercio;
- una venta posterior al split descontaría unidades que las compras no tienen (P&L realizado e impuestos).

`Asset.cedearRatio` guarda solo el ratio vigente, sin historia.

## Decisión

Guardamos cada cambio de ratio en `CedearRatioChange` (`ticker`, `effectiveDate` = primer día con el ratio nuevo, `oldRatio`, `newRatio`), un dato de mercado global como `Asset`. Al leer las operaciones, toda operación con fecha anterior a un cambio se expresa en CEDEARs del ratio actual: `cantidad × nuevo/viejo` y `precio ÷ nuevo/viejo`. El monto operado, la comisión y el movimiento no cambian.

- La lógica es pura: `lib/ratio-changes.ts` (`ratioFactor`, `adjustForRatioChanges`), con sus tests.
- La aplican todos los lectores de cantidades de `Transaction`: PPM (`getPpmForUser`), P&L realizado (`getRealizedPnl`), ganancia real (`real-gains-data.ts`) y reporte para impuestos (`tax-report-data.ts`). Cargan los cambios con `loadRatioChanges()` y declaran `marketTags.assets`.
- Se registran desde Assets: al editar el ratio con una "vigencia del nuevo ratio", `updateAsset` guarda el cambio y el ratio nuevo en la misma transacción. Si se edita el ratio sin fecha, es una corrección de un dato mal cargado y no ajusta nada.
- El split de SPY ya viene cargado en la migración que crea la tabla.

## Alternativas

- **Escribir un movimiento o una transacción sintética por las unidades acreditadas.** Rompe el libro como fuente de verdad (ADR-0012), y una "compra" a precio cero bajaría el PPM sin que haya un costo real.
- **Editar las cantidades y precios de las transacciones anteriores.** Pierde lo que dijo Cocos, y una reimportación lo deshace.
- **Detectar el salto comparando snapshots y ledger.** Sirve como alerta, no como fuente: no sabe el factor exacto ni la fecha, y los snapshots no son diarios.

## Consecuencias

**Positivas**

- PPM, P&L y ganancia real cuadran con la tenencia que muestra Cocos.
- El ledger y las transacciones quedan como se importaron.

**Negativas / costos**

- Alguien tiene que registrar cada split desde Assets: no hay un feed de BYMA.
- Las pantallas que listan transacciones crudas (pestaña Transacciones, export CSV) siguen mostrando la cantidad original, que es lo que figura en el comprobante.

**Reglas para el código**

- Todo cálculo nuevo que combine cantidades de `Transaction` con la tenencia o con `Asset.cedearRatio` pasa las operaciones por `adjustForRatioChanges` / `ratioFactor`.
- No se editan `Movement` ni `Transaction` para reflejar un split.

## Referencias

- `lib/ratio-changes.ts`, `lib/portfolio-data.ts` (`loadRatioChanges`), `app/actions/assets.ts` (`updateAsset`).
- Migración `20261011160000_cedear_ratio_changes`.
