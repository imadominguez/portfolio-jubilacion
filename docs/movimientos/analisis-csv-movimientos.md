# Análisis de CSVs de movimientos de Cocos Capital

> **Estado:** implementado. El parser vive en `lib/cocos-movements.ts`, el libro de movimientos en el modelo `Movement` y la importación en `app/actions/import-movements.ts`. Ver [modelo-de-datos.md](../modelo-de-datos.md), [server-actions.md](../server-actions.md) y [logica-financiera.md](../logica-financiera.md).

Insumo para planificar el refactor de la importación de transacciones (`app/actions/import-movements.ts`).

---

## 1. Archivos analizados

| Archivo | Período | Rango | Observación |
|---|---|---|---|
| `mivimientos_cuenta.csv` | Ene 2026 → Sep 2026 | `2026-01-02` a `2026-09-18` | Archivo completo de la cuenta |
| `mivimientos_cuenta1.csv` | Sep 2026 | `2026-09-01` a `2026-09-21` | Solapado con el primero (días 01–18); agrega 3 filas nuevas (19, 20, 21 sep) |

**Deduplicación:** el parser actual usa `nroTicket` como clave (`notes = "Cocos #<nroTicket>"`), por lo que las filas solapadas se detectan como duplicadas. Esto funciona correctamente.

---

## 2. Estructura del CSV

### Header (16 columnas)

```
nroTicket; nroComprobante; fechaEjecucion; fechaLiquidacion; tipoOperacion;
instrumento; moneda; mercado; cantidad; precio; montoBruto; comision;
ddmm; iva; otros; total
```

### Formato

- **Separador:** `;`
- **Números:** formato argentino (punto = miles, coma = decimal). Ej: `-40.000,44`, `0,48`, `-28,128`
- **Fechas:** `DD-MM-YYYY` (ej: `02-01-2026` = 2 de enero de 2026)
- **Signo negativo:** montos de egreso (compras, pagos) vienen negativos; ingresos (cobros, ventas) positivos
- **Moneda:** columna explícita (`ARS` o `USD`)

### Columnas que el parser actual ignora

| Columna | Contenido | Potencial uso |
|---|---|---|
| `nroComprobante` | ID interno del comprobante (ej: `82370`) | No relevante |
| `fechaLiquidacion` | Fecha de liquidación (igual a `fechaEjecucion` en todos los casos) | No relevante |
| `mercado` | `BYMA` o `MAE` | Podría distinguir operaciones en bolsa vs mercado abierto |

---

## 3. Tipos de operación encontrados

### Distribución en `mivimientos_cuenta.csv` (~430 filas)

| `tipoOperacion` | Cantidad aprox. | Clasificación actual | ¿Correcto? |
|---|---|---|---|
| `Orden De Pago` | ~170 | `SKIP_PAGO` | ✅ — Pagos de servicios, transferencias, sin instrumento |
| `Liquidacion Rescate Fci` | ~80 | `SKIP_FCI` | ⚠️ — Ver sección 4.1 |
| `Liquidacion Suscripcion Fci` | ~4 | `SKIP_FCI` | ⚠️ — Ver sección 4.1 |
| `Compra` | ~15 | `BUY` | ✅ — Compras de CEDEARs en ARS |
| `Venta` | 1 | `SELL` | ✅ — Venta de CEDEARs |
| `Recibo De Cobro` | ~25 | `SKIP_PAGO` | ✅ — Ingresos de dinero (salario, transferencias) |
| `Dividendos` | ~5 | `SKIP_DIVIDENDO` | ⚠️ — Ver sección 4.3 |
| `DIVIDENDOS EN ESPECIE` | ~15 | `SKIP_DIVIDENDO` | ⚠️ — Ver sección 4.3 |
| `Nota De Credito Conversion` | ~12 | `SKIP_OTHER` (matches `"nota de credito"`) | ✅ — Ajustes de conversiones, sin instrumento |
| `Compra Registracion ARS` | 1 | `SKIP_OTHER` (matches `"registracion"`) | ❌ — Ver sección 4.2 |
| `Venta Registracion USD` | 1 | `SKIP_OTHER` (matches `"registracion"`) | ❌ — Ver sección 4.2 |

---

## 4. Problemas detectados

### 4.1 FCI (Fondos Comunes de Inversión) — se ignoran completamente

Los FCI (`Liquidacion Rescate Fci` / `Liquidacion Suscripcion Fci`) son la operación más frecuente después de los pagos (~85 filas). El parser las ignora con `SKIP_FCI`.

**Ejemplo real:**
```
Liquidacion Suscripcion Fci; FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA); ARS; ; 3.141,068; 11.142,707; -35.000; 0; 0; 0; 0; -35.000
```
```
Liquidacion Rescate Fci; FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA); ARS; ; -6.138,4342; 11.671,957; 71.647,54; 0; 0; 0; 0; 71.647,54
```

**Problema:** el usuario tiene fondos en el FCI Cocos Rendimiento. Estas operaciones representan suscripciones (compra de cuotapartes) y rescates (venta de cuotapartes). No tienen ticker extraíble del campo `instrumento` (el nombre es `FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA)`, sin ticker entre paréntesis).

**Opciones:**
1. Seguir ignorándolos (actual) — pero el usuario pierde visibilidad de estos movimientos.
2. Importarlos como transacciones con un ticker especial (ej: `COCORMA` o `FCI_COCOS`) — requiere crear el asset correspondiente.
3. Mostrarlos en una sección separada del UI sin importarlos a `Transaction`.

### 4.2 Registraciones (canje de bonos) — se ignoran incorrectamente

Hay 1 par de operaciones de registración (canje):
```
Compra Registracion ARS; ON TARJETA NARANJA CL.66 S.1 30/11/26 $ (T661O); ARS; MAE; 5.132; 103,95; -5.334,714; 0; 0; 0; 0; -5.334,71
Venta Registracion USD; ON TARJETA NARANJA CL.66 S.1 30/11/26 $ (T661O); USD; MAE; -5.132; 0,068; 3,4898; 0; 0; 0; 0; 3,49
```

**Problema:** estas operaciones **sí tienen ticker** (`T661O`) y representan una conversión real (bono en ARS → bono en USD). El parser las descarta porque el regex `extractTicker` busca `/\(([A-Z0-9]+)\)/` y el ticker `T661O` sí matchea, pero la clasificación `"registracion"` las manda a `SKIP_OTHER` antes de llegar ahí.

**Opciones:**
1. Importarlas como BUY/SELL — la compra en ARS y la venta en USD del mismo bono.
2. Seguir ignorándolas — son operaciones de canje, no de inversión.
3. Agregar una categoría `CONVERSION` separada.

### 4.3 Dividendos — no se importan automáticamente

Hay ~20 filas de dividendos de dos tipos:

**A) `Dividendos` en ARS (moneda local):**
```
Dividendos; Peso argentino; ARS; ; ; 0,48; 0; -0,0005; -0,0001; 0; 0,45
```
- Montos muy pequeños (ARS 0,45–3,02)
- Sin cantidad ni precio
- `instrumento` = `"Peso argentino"` (no tiene ticker)

**B) `DIVIDENDOS EN ESPECIE` en ARS (pagados en USD pero liquidados en ARS):**
```
DIVIDENDOS EN ESPECIE; Dólar estadounidense; ARS; ; 0,48; 0; 0; 0; -28,128; -5,9069; 0; -34,03
```
- Cantidades pequeñas (0,04–0,57 unidades)
- Tienen `cantidad` pero no `precio`
- `instrumento` = `"Dólar estadounidense"` (no tiene ticker)
- Monto negativo en `total` (egreso de USD por retención)

**Problema:** el parser no puede importarlos porque no hay ticker. La UI sugiere "cargalos manualmente" (línea 323 de `import-movements-button.tsx`), pero no hay un flujo automático. El usuario tendría que identificar manualmente qué ticker generó cada dividendo (lo cual no está en el CSV de movimientos).

**Opciones:**
1. Seguir ignorándolos con hint de carga manual (actual).
2. Parsear la columna `cantidad` + `montoBruto` y asociar el dividendo al ticker más probable (heurística por fecha).
3. Importar los `DIVIDENDOS EN ESPECIE` como dividendos genéricos sin ticker específico.

### 4.4 Parser requiere `cantidad` como columna obligatoria

En `parseCocosMovimientosCsv`, línea 119:
```ts
if (idx.tipoOperacion === -1 || idx.instrumento === -1 || idx.cantidad === -1) {
  return { error: "Columnas no reconocidas..." };
}
```

**Problema:** muchas filas de pagos, cobros, dividendos y notas de crédito tienen `cantidad` vacía. El parser las ignora bien (no llegan a usar `cantidad`), pero la validación del header fallaría si el CSV viniera sin la columna `cantidad`. En la práctica, los CSVs de Cocos sí incluyen la columna, así que esto no es un bug actual, pero es una fragilidad.

### 4.5 `Nota De Credito Conversion` — se ignora como "nota de credito"

```
Nota De Credito Conversion; ; USD; ; ; 0,58; 0; 0; 0; 0; 0,58
```

Son conversiones de CEDEARs (ej: cambio de ISIN, ajustes). Tienen moneda USD pero sin instrumento ni ticker. Se ignoran correctamente como `SKIP_OTHER`.

**Observación:** el parser las clasifica por match de `"nota de credito"` en el string completo. Si algún día Cocos agrega un tipo que contenga "nota de credito" y tenga ticker, se ignoraría igual. Sería más seguro matchear exactamente.

### 4.6 El parser ignora `montoBruto` — podría usarse como fallback

En las operaciones de CEDEARs (`Compra`/`Venta`), el campo `montoBruto` es el valor total sin comisiones (cantidad × precio). El parser actual usa `cantidad` y `precio` por separado, que es más preciso. Pero para operaciones sin `cantidad` ni `precio` (dividendos, pagos), `montoBruto` es el único dato numérico útil.

### 4.7 Deduplicación por `nroTicket` — sin protección contra re-importación parcial

Si el usuario importa un CSV, luego importa otro CSV que incluye las mismas filas + nuevas, las duplicadas se omiten correctamente. Pero si la importación falla a mitad de camino (`createMany` es atómico en Prisma, así que esto no debería ocurrir), no hay forma de reanudar sin re-importar todo.

---

## 5. Resumen de gaps

| Gap | Severidad | Descripción |
|---|---|---|
| FCI ignorados | Media | ~85 movimientos de fondos no se ven. El usuario no tiene visibilidad de su posición en el FCI. |
| Registraciones ignoradas | Baja | 2 operaciones de canje de bonos. Poco frecuente. |
| Dividendos no importados | Media | ~20 dividendos no se importan. La UI sugiere carga manual, pero no hay forma de saber el ticker desde el CSV. |
| Clasificación `"registracion"` muy agresiva | Baja | Descarta operaciones que podrían ser válidas (canjes con ticker). |
| Sin separación de monedas en dividendos | Baja | Los dividendos en USD (especie) se mezclan con los de ARS. |

---

## 6. Datos para el refactor

### Operaciones que el parser **sí importa** correctamente (del CSV analizado)

```
Compra (MELI, AMZN, MSFT, KO, JNJ, WMT) — 15 filas, ticker extraído correctamente
Venta (AMD) — 1 fila, ticker extraído correctamente
```

### Operaciones que el parser **ignora correctamente**

```
Orden De Pago (~170) — pagos de servicios, transferencias, comisiones
Recibo De Cobro (~25) — ingresos de dinero
Nota De Credito Conversion (~12) — ajustes de conversiones
```

### Operaciones que el parser **ignora pero podrían importarse**

```
Liquidacion Rescate Fci (~80) — rescates de FCI
Liquidacion Suscripcion Fci (~4) — suscripciones a FCI
Dividendos (~5) — dividendos en ARS
DIVIDENDOS EN ESPECIE (~15) — dividendos en USD
Compra Registracion ARS (1) — canje bono ARS→USD
Venta Registracion USD (1) — canje bono USD→ARS
```

### Tickers encontrados en compras/ventas

| Ticker | Nombre completo | Moneda | Operaciones |
|---|---|---|---|
| `MELI` | CEDEAR MERCADOLIBRE INC. | ARS | 2 compras |
| `AMD` | CEDEAR ADVANCED MICRO DEVICES, INC. | ARS | 1 venta |
| `MSFT` | CEDEAR DE MICROSOFT CORP. | ARS | 2 compras |
| `AMZN` | CEDEAR AMAZON.COM, INC | ARS | 1 compra |
| `KO` | CEDEAR COCA-COLA COMPANY | ARS | 1 compra |
| `JNJ` | CEDEAR JOHNSON & JOHNSON | ARS | 1 compra |
| `WMT` | CEDEAR DE WAL-MART INC. | ARS | 1 compra |
| `T661O` | ON TARJETA NARANJA CL.66 S.1 30/11/26 $ | ARS/USD | 2 (ignoradas) |

### FCI encontrado

| Instrumento | Moneda | Operaciones |
|---|---|---|
| FCI COCOS RENDIMIENTO CL. A $ ESC (COCORMA) | ARS | ~84 (ignoradas) |

### Estructura de los dividendos

```
Dividendos; Peso argentino; ARS; ; ; 0,48; 0; -0,0005; -0,0001; 0; 0,45
                                              ↑ cantidad vacía           ↑ total (ARS neto)
```

```
DIVIDENDOS EN ESPECIE; Dólar estadounidense; ARS; ; 0,48; 0; 0; 0; -28,128; -5,9069; 0; -34,03
                                                    ↑ cantidad (USD)     ↑ ddmm (retención) ↑ total (ARS neto)
```

Los dividendos no tienen ticker. Los montos son pequeños (ARS 0,45–3,02 para los locales; ARS -34,03 para los de especie). Los `DIVIDENDOS EN ESPECIE` tienen un `total` negativo porque incluyen la retención impositiva en `ddmm` e `iva`.
