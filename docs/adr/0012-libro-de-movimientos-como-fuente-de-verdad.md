# ADR-0012: Libro de movimientos de Cocos como fuente de verdad de la importación

- **Estado:** Aceptado
- **Fecha:** 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0008, ADR-0016

## Contexto

El PPM y el P&L realizado se calculan a partir de las compras y ventas (`Transaction`). Al principio, la importación del CSV de Actividad de Cocos creaba transacciones directamente y descartaba el resto de las filas.

Pero ese CSV trae mucho más que compras y ventas: suscripciones y rescates de FCI (COCORMA, COCOUSDPA), pagos y cobros (ingresos y retiros de dinero), dividendos en efectivo y en especie, conversiones de moneda. Al descartarlas se perdía información útil (cuánto se aportó, cuánto se movió por fondos), no había forma de saber qué filas ya se habían importado salvo por un `notes = "Cocos #<ticket>"` y la categorización vivía mezclada con la persistencia.

## Decisión

- **Cada fila del CSV se guarda en `Movement`** (el "libro de movimientos"), ya categorizada en `MovementCategory` (`TRADE_BUY`, `TRADE_SELL`, `FCI_SUBSCRIPTION`, `FCI_REDEMPTION`, `PAYMENT`, `RECEIPT`, `DIVIDEND`, `DIVIDEND_IN_KIND`, `CONVERSION`, `OTHER`), con todos sus montos y comisiones.
- **Solo `TRADE_BUY` / `TRADE_SELL` generan una `Transaction`**, vinculada 1:1 por `movementId`. El resto queda registrado sin afectar el PPM.
- **Importación idempotente:** deduplicación por `@@unique([userId, nroTicket])` (`createManyAndReturn` + `skipDuplicates`), con compatibilidad para las transacciones legacy marcadas en `notes`. Todo dentro de una transacción de base de datos.
- **Parser puro y separado:** `lib/cocos-movements.ts` (`parseMovementCsv`) no usa Prisma ni APIs del servidor. Corre en el cliente para la previsualización (agrupada por categoría, con selección por fila) y su resultado se envía a la action `importMovements`, que decide qué persistir.

## Alternativas

- **Seguir creando solo transacciones:** pierde información y la deduplicación por `notes` es frágil.
- **Guardar el CSV crudo y parsear al leer:** repite trabajo en cada render y complica las consultas por categoría.
- **Parsear solo en el servidor:** obliga a subir el archivo para previsualizar; parsear en el cliente da feedback inmediato con la misma lógica.

## Consecuencias

**Positivas**

- Reimportar un CSV (o uno superpuesto en fechas) no duplica nada.
- La vista de Movimientos (con sub-vista de fondos FCI) sale del libro sin otra importación.
- El parser se testea sin base de datos, con un CSV sintético (en CI) y con exportaciones reales (localmente).

**Negativas / costos**

- Dos tablas para una misma operación (movimiento + transacción) que hay que mantener consistentes.
- El formato del CSV de Cocos puede cambiar sin aviso; los tipos no reconocidos caen en `OTHER` con un aviso en la previsualización.
- Los fixtures reales están ignorados por git (contienen datos de la cuenta); el CSV sintético del test tiene que cubrir cada tipo de operación nuevo que aparezca.

**Reglas para el código**

- Categorizar en `lib/cocos-movements.ts`; persistir y deduplicar en `app/actions/import-movements.ts`. No mezclar.
- Una categoría nueva que deba impactar el PPM tiene que crear `Transaction` en la action, con test.
- No crear transacciones de Cocos sin su `Movement`.

## Referencias

- `lib/cocos-movements.ts` (comentario de cabecera), `lib/cocos-movements.test.ts`, `app/actions/import-movements.ts`.
- Migración `20260920120000_add_movements_ledger`, commit `8e29c75`, `scripts/backfill-movements.ts`.
- [`movimientos/analisis-csv-movimientos.md`](../movimientos/analisis-csv-movimientos.md).
