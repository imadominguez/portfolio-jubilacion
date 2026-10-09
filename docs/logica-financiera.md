# Lógica financiera y cálculos

Este documento reúne las fórmulas implementadas en la app y dónde vive cada una.

---

## CEDEARs — relación de precios

```
Precio CEDEAR (ARS) ≈ (Precio acción USD / Ratio CEDEAR) × CCL
```

- `Ratio CEDEAR` = cantidad de CEDEARs que equivalen a 1 acción subyacente (`Asset.cedearRatio`).
- Para pasar de cantidad de CEDEARs a acciones subyacentes: `acciones = cantidad / cedearRatio`.

---

## Allocation de un snapshot

Definida en `app/actions/snapshots.ts` (`computeTotalsAndAllocations`).

Equivalente en ARS de cada posición:

```
arsEquivalent(p) =
  positionValue                      si currency = ARS
  positionValue × CCL                si currency = USD y CCL > 0
  0                                  si currency = USD y no hay CCL
```

```
totalValueArs = Σ arsEquivalent(p)
allocationPct = arsEquivalent(p) / totalValueArs       (0 si totalValueArs = 0)
totalValueUsd = totalValueArs / CCL                    (solo si CCL válido)
```

`allocationPct` se guarda como **fracción (0–1)** en `Position` y se expone ×100 en la capa de datos.

---

## PPM — Precio Promedio Ponderado (`calculatePPM`)

Definido en `app/actions/transactions.ts`.

Por cada compra (en orden cronológico):

```
cost      = quantity × price + (fee ?? 0)
totalCost += cost
totalQty  += quantity
```

Al vender, se descarga costo a costo promedio:

```
totalQty  = max(0, totalQty − vendido)
ppm       = totalCost / (totalQty + vendido)      // = PPM previo
totalCost = ppm × totalQty
```

Solo se devuelven tickers con `totalQty > 0`:

```
avgPrice = totalCost / totalQty
```

> `getRealizedPnl` usa una variante que **no incluye `fee`** en el costo, por lo que el P&L realizado puede diferir levemente del PPM.

---

## P&L

### No realizado (latente) — Dashboard

```
P&L_no_realizado = Σ (precio_actual − PPM) × cantidad
```

solo posiciones con PPM en ARS y `avgPrice > 0`. El `precio_actual` es el del snapshot más reciente (no el de Yahoo).

### Realizado (`getRealizedPnl`)

Para cada venta contra el costo promedio vigente:

```
avgBuyPrice = totalCost / qty
pnl         = (sellPrice − avgBuyPrice) × cantidadVendida
pnlPct      = ((sellPrice − avgBuyPrice) / avgBuyPrice) × 100
```

Luego se descuenta la cantidad y el costo del estado del ticker. Se ordena por fecha descendente.

Las ventas importadas antes de normalizar el signo tienen cantidad negativa (así las exporta Cocos): `calculatePPM`, `getRealizedPnl`, `getAllTransactions` y el CSV de transacciones usan el valor absoluto.

---

## Performance histórica (`app/(app)/performance/page.tsx`)

El valor de los snapshots sube con cada compra o suscripción al FCI aunque el mercado no se mueva, así que el rendimiento se mide **descontando los flujos** de las tenencias (ADR-0019). Las fórmulas viven en `lib/flow-returns.ts` y `lib/snapshot-returns.ts` (con tests); `getHoldingsFlows()` (`lib/portfolio-data.ts`) arma los flujos del usuario.

- **La serie de rendimiento arranca en el primer snapshot con valor** (`performanceSeries`). Un snapshot puede valer $0 (p. ej. el primer export de una cuenta recién abierta) y es inmutable, así que no se corrige el dato: se evita usarlo como base. De ahí salen la TIR, el rendimiento del año, el drawdown, la fecha desde la que se piden benchmarks e índices, y los gráficos normalizados. El gráfico de evolución y la tabla de registros siguen mostrando todos los snapshots.
- **Sin base positiva no hay porcentaje:** las funciones devuelven `null` y la UI muestra "—".

### Flujos de las tenencias

Lo medido es todo lo que figura en el snapshot (CEDEARs, bonos, FCI). Un flujo es un movimiento que cruza ese borde (`flowsFromMovements`):

| Categoría | ¿Flujo? |
|---|---|
| `TRADE_BUY`, `TRADE_SELL`, `FCI_SUBSCRIPTION`, `FCI_REDEMPTION`, `DIVIDEND`, `DIVIDEND_IN_KIND` | Sí |
| `OTHER` con instrumento (bonos para dólar MEP) | Sí |
| `PAYMENT`, `RECEIPT`, `CONVERSION`, `OTHER` sin instrumento | No (mueven efectivo, que no está en el snapshot) |

Signo del inversor: `amount < 0` es plata que entra a las tenencias (compra, suscripción) y `amount > 0` la que sale (venta, rescate, dividendo). Los movimientos en USD se pasan a ARS con el CCL de su fecha (último registro en o antes de esa fecha); los que no tienen CCL se cuentan aparte (`sinCcl`). Los flujos en USD (Jubilación) son cada flujo en ARS dividido por el CCL de su fecha.

### Rendimiento de un período (Dietz modificado)

Para dos snapshots consecutivos, con los flujos `f` de `(inicio, fin]`:

```
aporte_f   = −amount_f
peso_f     = (fecha_fin − fecha_f) / (fecha_fin − fecha_inicio)
base       = V_inicio + Σ aporte_f × peso_f
período %  = (V_fin − V_inicio − Σ aporte_f) / base × 100      (null si base ≤ 0)
```

Es el porcentaje de la tabla de registros de `/performance` y de la lista de `/snapshots`, y el "Rendimiento vs snapshot anterior" del Dashboard.

### Índice TWR y rendimiento del año

```
índice_0 = 100
índice_n = índice_{n−1} × (1 + período_n / 100)
```

Un período `null` corta la cadena: desde ahí el índice es `null`. `twrBetween(desde, hasta)` es el índice final − 100 sobre ese tramo.

- **Rendimiento del año** = `twrBetween(base, último)`. Base = último snapshot del año anterior; si no existe, el primero del año en curso.
- **Ganancia del año (ARS)** = `V_último − V_base − aportes netos del tramo` (`netContributions`).
- Los gráficos contra benchmarks e inflación usan este índice en lugar de normalizar el valor (prop `portfolioIndex`).

### TIR anual (XIRR)

```
flujos = [−V_primero en fecha_primero] + flujos de (primero, último] + [+V_último en fecha_último]
Σ flujo_i / (1 + TIR) ^ ((fecha_i − fecha_0) / 365) = 0
```

Se resuelve por bisección en `[−99,99 %, 10.000 %]` (`xirr`); `null` si no hay flujos de ambos signos o no hay solución. Se muestra solo si `años ≥ 0.1`. En USD (`flowsUsd` y `totalValueUsd`) es la tasa histórica de Jubilación.

### Máximo Drawdown

Sobre el índice TWR (sin aportes):

```
peak_t = máx(p_0 .. p_t)
DD_t   = (peak_t − p_t) / peak_t
MaxDD  = máx(DD_t) × 100
```

### En dólares (`?moneda=usd`)

Las mismas fórmulas sobre la serie en USD, con `returnSummary(puntosUsd, flowsUsd, añoActual)`:

- **Puntos:** `totalValueUsd` de cada snapshot (valor ARS al CCL de esa fecha, inmutable). Los snapshots sin CCL quedan afuera.
- **Flujos:** `flowsUsd` = cada flujo en ARS dividido por el CCL de su fecha (`getHoldingsFlows`).
- La diferencia con el análisis en pesos es la devaluación: en pesos, la suba del CCL cuenta como rendimiento.
- **vs S&P 500** reemplaza a la TIR real (la inflación es un concepto en pesos):

```
TWR anual  = annualize(índiceTWR_último − 100, años)
S&P anual  = annualize(indexChangePct(S&P 500, primero_USD, último_USD), años)
vs S&P 500 = TWR anual − S&P anual          (puntos porcentuales)
```

Se compara el TWR (no la TIR) porque el índice del S&P tampoco tiene aportes. El Merval sigue en pesos en el gráfico; el de inflación se mantiene en pesos.

### Cobertura de movimientos

Si no hay movimientos importados, o el último es anterior al último snapshot por más de un día, `/performance` muestra un aviso con link a `/transactions`: sin esos movimientos, una venta o un rescate del FCI se lee como pérdida.

---

## Benchmarks (`app/actions/benchmarks.ts`)

Ver también **Inflación y rendimiento real** más abajo.

Los índices (`^GSPC`, `^MERV`, `^IXIC`) se normalizan a **base 100** en su primer punto:

```
normalizedValue = (value / firstValue) × 100
```

Esto permite superponerlos en `BenchmarkOverlayChart` con el índice TWR del portafolio (base 100, sin aportes; ver Performance histórica).

---

## Inflación y rendimiento real (`lib/inflation.ts`, `app/actions/indices.ts`)

Compara el portfolio en **ARS** contra la inflación argentina (IPC y CER/UVA).

- **IPC** llega como tasa mensual (`valor` = % del mes) → se compone a índice acumulado base 100:

```
nivel_n = nivel_{n-1} × (1 + tasa_n / 100)
```

- **CER/UVA** ya es un índice diario → se guarda directo.
- Ambos se persisten en `BenchmarkPoint` (`benchmarkId` = `inflacion` / `cer`) y se leen con `getBenchmarkPoints` (normalización base 100).

**Rendimiento real** (descunta la inflación del rendimiento nominal):

```
realPct = ((1 + nominal/100) / (1 + inflación/100) − 1) × 100
```

- `annualize(totalPct, años)` lleva el total del período a tasa anual compuesta.
- El KPI "TIR real" de `/performance` = `realReturnPct(tir, annualize(inflaciónPeríodo, años))`.
- La inflación del período se mide con `indexChangePct(serie, primeraFecha, últimaFecha)` (usa IPC; si no hay, CER).

> Nota: el gráfico `InflationChart` usa escala **logarítmica** por defecto, porque con inflación alta la escala lineal aplasta al portfolio.

---

## CCL (`app/actions/exchange-rate.ts`)

- CCL actual: `GET https://dolarapi.com/v1/dolares/contadoconliqui`, se toma `venta ?? compra`, se guarda por fecha (medianoche local), source `dolarapi.com`.
- CCL histórico: `GET https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui`, se filtra por rango, deduplica por día y se hace upsert con source `argentinadatos.com`.

Variaciones mostradas en `/ccl`:

```
variación = (CCL_actual − CCL_período) / CCL_período × 100
```

para 1 mes, YTD y 1 año (se busca el registro más cercano hacia atrás).

---

## Rebalanceo (`app/actions/rebalance.ts`)

```
deviation = currentPct − targetPct
```

| Condición | `suggestedAction` |
|---|---|
| `deviation < −1` | `BUY` |
| `deviation > 1` | `SELL` |
| entre −1 y 1 | `HOLD` |

`targetPct` se persiste como fracción (`/100`) y se expone ×100. La validación exige `0 ≤ targetPct ≤ 100`.

---

## Plan DCA (`lib/dca-planner.ts`)

Reparte un aporte mensual entre los tickers del objetivo (target > 0) priorizando los infraponderados. Función pura `planDca(input): DcaPlan`.

```
gap_i      = max(0, targetPct_i/100 · valorCartera − valorActual_i)
techo_i    = gap_i                       // no se compra más de lo que falta
asignado_i = water-filling proporcional al "room" restante (gap_i − asignado_i)
newPct_i   = (valorActual_i + asignado_i) / (valorCartera + aporte) · 100
```

- Los tickers fuera del objetivo o ya en objetivo reciben 0.
- El excedente que no cabe en ningún *gap* se reporta como `unallocatedArs`.
- `estimatedCedears = floor(asignado_i / precioCedearArs)`, con `precioCedearArs = precioSubyacenteUSD · CCL / ratio` (o el precio del snapshot si la posición existe).

---

## Ganancia real en USD e impacto CCL (`lib/real-gains-data.ts`)

Dos metodologías por posición, comparadas al final:

**Método A — valor ARS convertido por CCL**

Costo de cada compra:
```
costArs_tx  = quantity × price + fee
costUsdCcl  = costArs_tx / cclEnCompra        (CCL más cercano ±7 días)
```
Valor actual:
```
valueUsdCcl = valueArsActual / cclActual
```

**Método B — apreciación del subyacente**

Costo:
```
costUsdStock  = (quantity / cedearRatio) × precioUsdSubyacenteEnCompra   (±5 días)
```
Valor actual:
```
valueUsdStock = (quantity / cedearRatio) × precioUsdActual
```

**Ganancias**

```
gainArs             = valueArs − costArs
gainUsdReal         = valueUsdCcl − costUsdCcl
gainUsdAppreciation = valueUsdStock − costUsdStock
gainUsdCclImpact    = gainUsdReal − gainUsdAppreciation
```

Porcentajes análogos `gainPct = gain / costo × 100`. Los totales de cartera se anulan a `null` si falta el dato de alguna posición (mientras que los acumuladores por ticker suman parcialmente). `cclCoverage = compras con CCL / total compras × 100`.

**Interpretación:** si la acción sube 20% en USD pero el CCL sube 30%, aunque en ARS se gane, el poder de compra en dólares baja; el impacto CCL captura ese efecto (puede ser negativo).

**Alcance:** sólo se incluyen posiciones con `underlyingTicker` (CEDEARs). Los instrumentos sin subyacente (bonos y acciones locales como `T661O` o `VALO`) quedan **excluidos** del cálculo y de los totales de este módulo.

---

## Proyección de jubilación (`lib/projections.ts`)

### Meta de capital (`calculateRetirementGoal`)

```
añosRestantes   = retirementAge − currentAge
gastosRetiro    = monthlyExpensesUsd × (1 + inflationRate)^añosRestantes
gastosAnuales   = gastosRetiro × 12
capitalNeeded   = gastosAnuales / withdrawalRate          (0 si withdrawalRate ≤ 0)
```

Capital proyectado al retiro con `r = annualReturnRate / 12`, `n = añosRestantes × 12`:

```
si r = 0:  capitalAtRetirement = currentPortfolioUsd × n + monthlyContribution × n
si r ≠ 0:  capitalAtRetirement = currentPortfolioUsd × (1+r)^n
                                + monthlyContribution × ((1+r)^n − 1) / r
```

```
currentGap    = max(0, capitalNeeded − currentPortfolioUsd)
isOnTrack     = capitalAtRetirement ≥ capitalNeeded
yearsToGoal   = simulación mes a mes hasta alcanzar la meta, o añosRestantes + 10 si no alcanza
```

### Curva de proyección (`buildProjectionCurve`)

Año a año de `currentAge` a `max(retirementAge+10, currentAge+40)`, capitalizando 12 meses por año. Cada punto incluye `projected` y `goal` (tomado de `capitalNeeded` inyectado por el cliente).

### Monte Carlo (`runMonteCarlo(inputs, simulations = 500/1000)`)

- `meanMonthlyReturn = annualReturnRate / 12`, volatilidad fija `stdDevMonthly = 0.04`.
- Shock normal por Box–Muller: `z = sqrt(−2·ln(u1))·cos(2π·u2)`.
- Retorno mensual con clamp: `r_t = clamp(mean + 0.04·z, −0.5, 0.5)`.
- `balance = balance × (1 + r_t) + monthlyContribution`, con piso en 0.
- Devuelve percentiles **P10, P50, P90** por año y `successProbability` = % de simulaciones cuyo valor final alcanza la meta.

Meta de éxito:

```
adjExpenses = monthlyExpensesUsd × (1 + inflationRate)^años
goalAmount  = adjExpenses × 12 / withdrawalRate        (o × 25 si withdrawalRate = 0)
```

---

## Parsing de CSV de Cocos

### Snapshots de portafolio (`app/actions/snapshots.ts`)

- Delimitador autodetectado: `;` si hay más o igual puntos y coma que comas, si no `,`.
- Columnas esperadas: `instrumento, cantidad, precio, moneda, total`.
- Obligatorias: `instrumento`, `cantidad`, `total`.
- Ticker extraído del paréntesis: `/\(([A-Z0-9]+)\)/` (ej. `CEDEAR NVIDIA CORPORATION (NVDA)` → `NVDA`).
- Números en formato argentino (punto de miles, coma decimal); `positionValue = total` o `cantidad × precio` si `total` es 0.
- Filas sin ticker o con `cantidad ≤ 0` se omiten.

### Movimientos (`lib/cocos-movements.ts`)

- Separador autodetectado (`;` o `,`); se quita el BOM.
- Columnas: `nroTicket, nroComprobante, fechaEjecucion, fechaLiquidacion, tipoOperacion, instrumento, moneda, mercado, cantidad, precio, montoBruto, comision, ddmm, iva, otros, total`.
- Fechas `DD-MM-YYYY`; números en formato argentino (punto de miles, coma decimal). Vacío o inválido → `null`.
- Clasificación de `tipoOperacion` (mapa explícito, sin heurísticas de substring):

| `tipoOperacion` | `MovementCategory` | ¿Genera `Transaction`? |
|---|---|---|
| `Compra`, `Compra Dolar Mep`, `Compra Registracion ARS` | `TRADE_BUY` | Sí |
| `Venta`, `Venta Dolar Mep`, `Venta Registracion USD` | `TRADE_SELL` | Sí |
| `Liquidacion Suscripcion Fci` | `FCI_SUBSCRIPTION` | No |
| `Liquidacion Rescate Fci` | `FCI_REDEMPTION` | No |
| `Orden De Pago`, `Orden De Pago Usd` | `PAYMENT` | No |
| `Recibo De Cobro` | `RECEIPT` | No |
| `Dividendos` | `DIVIDEND` | No (carga manual) |
| `DIVIDENDOS EN ESPECIE` | `DIVIDEND_IN_KIND` | No (carga manual) |
| `Nota De Credito Conversion` | `CONVERSION` | No |
| desconocido | `OTHER` (+ warning) | No |

- Sólo se crea una `Transaction` si la categoría es `TRADE_*` y hay `ticker`, `quantity` y `price`.
- `fee = |comision| + |ddmm| + |iva| + |otros|` redondeado a 2 decimales.
- El ticker se extrae del paréntesis del instrumento (`COCORMA` para el FCI, `T661O` para el bono).
- Deduplicación al importar: por `Movement.(userId, nroTicket)` (con `skipDuplicates`), y por compatibilidad con `Transaction.notes = "Cocos #<nroTicket>"` legacy.

---

## Milestones (`app/actions/milestones.ts`)

Hitos por defecto: **USD 10.000, 25.000, 50.000, 100.000, 250.000**. Se crean una sola vez, al importar el **primer** snapshot del usuario (si todavía no tiene ninguno); si después los borra todos, no vuelven. Al importar cada snapshot, `checkAndUpdateMilestones` marca como alcanzados los que cumplen:

```
currentValueUsd ≥ targetValueUsd  →  reached = true, reachedAt = now
```

---

## Reporte de oportunidades (`lib/opportunity-signals.ts`, `lib/opportunity-report.ts`)

La app calcula estos datos sin IA y Claude solo decide la señal por acción ([ADR-0018](./adr/0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md)). Todo es puro y tiene tests.

### Señales de precio (`priceSignals`)

Sobre el último año de cierres diarios del subyacente (Yahoo), ordenados por fecha y sin cierres `≤ 0`:

```
último        = cierre más reciente
variación_N   = pctChange(último, cierre en o antes de (fecha_último − N días))   N = 30, 91, 365
máx_52s, mín_52s = máximo y mínimo de los cierres de los últimos 365 días
desde_máximo  = (último − máx_52s) / máx_52s × 100      (≤ 0)
desde_mínimo  = (último − mín_52s) / mín_52s × 100      (≥ 0)
```

Si no hay cierre anterior a la fecha buscada, esa variación es `null` ("s/d" en la entrada de Claude). Sin cierres válidos, la acción queda fuera del análisis.

### CEDEAR vs precio promedio de compra

```
vs_promedio = (precio CEDEAR ARS del snapshot − PPM ARS) / PPM ARS × 100
```

Solo con PPM en ARS (`calculatePPM`); sin PPM se informa "s/d".

### Filtro de noticias (`selectNews`)

De los titulares de la búsqueda de Yahoo para el subyacente, se queda con los que cumplen **todo**:

- publicados en los últimos **30 días**;
- el ticker es el **principal** de la nota (`relatedTickers[0]`), **o** el título nombra el ticker como palabra, **o** nombra la empresa (primera palabra de 4+ letras del nombre del instrumento, sin el prefijo "CEDEAR");
- sin títulos repetidos.

Ordenados del más nuevo al más viejo, hasta **5** por acción.

### Costo por reporte (`estimateCostUsd`)

```
costo = (entrada × p_entrada + salida × p_salida + cache_write × p_cache_write + cache_read × p_cache_read) / 1.000.000
```

Con los precios (USD por millón de tokens) del **modelo que respondió**, de la tabla `MODEL_PRICING`. Si el modelo no está en la tabla, el costo es `null` (no se informa uno equivocado). Medición de referencia: 14 acciones, 6.222 tokens de entrada y 5.314 de salida con `claude-sonnet-5` sin `effort` → US$ 0,0656.

---

## Reporte para impuestos (`lib/tax-report.ts`)

Junta los datos para la declaración anual; no aplica reglas impositivas (exenciones, tipo de cambio BNA, fuente). Las fechas son medianoche UTC, así que el año sale de `getUTCFullYear()`.

### Tenencia al cierre

`lastSnapshotPerYear` toma el último snapshot de cada año; `daysBeforeYearEnd` mide cuántos días le faltan al 31/12 (la UI avisa con más de 7). Valuación = `positionValue` de cada posición, en ARS como la exporta Cocos.

### Ventas (`salesForYear`)

Costo promedio ponderado **por ticker**, recorriendo todas las operaciones desde la primera (una venta de este año consume compras de años anteriores). Con la misma fecha, primero las compras.

```
bruto     = |grossAmount del movimiento de Cocos|   (si no hay movimiento: cantidad × precio)
compra:   costo[moneda] += bruto + comisión;  cantidad += q
venta:    cubierto   = mín(q, cantidad)
          costoVendido[m] = costo[m] × cubierto / cantidad      (por moneda)
          ingresoNeto = bruto − comisión
          resultado   = ingresoNeto − costoVendido                (solo si el costo está todo en la moneda de la venta)
```

- Se usa el **bruto del movimiento** porque en bonos y ONs el precio de Cocos es cada 100 nominales: cantidad × precio da 100 veces el monto.
- Las ventas importadas traen la **cantidad negativa**: se toma el valor absoluto (la importación nueva ya la guarda positiva).
- **Compra y venta en distinta moneda** (p. ej. ON comprada en pesos y vendida en dólares para hacer dólar MEP): `resultado = null`. Convertir el costo pide elegir un tipo de cambio, y eso queda para la declaración. Si el costo mezcla las dos monedas, también `costo = null`.
- `missingBuys`: se vendió más de lo comprado; esa diferencia no tiene costo y el resultado está inflado.

A diferencia de `getRealizedPnl`, incluye las comisiones de compra y de venta.

### Dividendos (`dividendsForYear`)

| Movimiento | Monto | Gastos (ARS) |
|---|---|---|
| Instrumento "Dólar …" (CEDEARs, en especie) | `quantity` en USD | `−total` (el total son solo los gastos en pesos) |
| Resto (p. ej. VALO, "Peso argentino") | `grossAmount` en la moneda del movimiento | `grossAmount − total` |
| `Dividend` cargado a mano | `amount` | 0 |

Se omiten los de monto 0. Cocos no informa de qué CEDEAR viene cada dividendo en dólares.

---

## Gastos del mes (`lib/expenses.ts`)

Salen de los pagos (`PAYMENT`, "Orden De Pago") del libro de movimientos de Cocos, en pesos. Cocos no informa el destino del pago: la categoría y la nota las pone el usuario en `ExpenseTag` (aparte del `Movement`, que no se edita, ADR-0012). Los cortes por mes y por día usan la fecha local de Argentina (`lib/local-date.ts`).

```
monto            = −Movement.total            (un pago con total positivo es un reintegro y resta)
días transcurridos = hoy (mes actual) | días del mes (mes cerrado)
promedio diario  = total / días transcurridos
proyección       = promedio diario × días del mes      (solo mes actual)
vs mes anterior  = (total − anterior) / anterior × 100
                   anterior = mes anterior hasta el mismo día (mes actual) o completo (mes cerrado)
```

Por categoría: suma por `ExpenseTag.category`; los pagos sin categoría (o con una que ya no existe) van a "Sin categorizar". Los pagos en dólares no entran en los totales (se informa cuántos hay).

---

## Alertas por mail (`lib/alerts.ts`)

Ver [ADR-0020](./adr/0020-alertas-por-mail-con-cron-y-gmail-smtp.md). Se revisa una vez por día (cron a las 9 de Argentina) y se manda un único mail por usuario.

### Caídas

Para cada posición del último snapshot con subyacente, sobre los cierres diarios del último año en USD (Yahoo):

```
desdeMáximo = (último − máx52s) / máx52s × 100                 (priceSignals)
5 ruedas    = (último − cierre de 5 ruedas antes) / ese cierre × 100   (sessionChangePct)
alerta si   desdeMáximo ≤ −umbralMáximo  o  5 ruedas ≤ −umbralSemanal  (15 % y 8 % por defecto)
```

**No repetir** (`shouldNotifyDrop`): vuelve a avisar si pasaron 7 días desde el último aviso de ese ticker o si `desdeMáximo` bajó al menos 5 puntos más que el valor avisado (`AlertLog.value`).

### Recordatorio de carga

Desde el día `reminderDay` del mes (fecha local de Argentina), para el mes anterior `M` (`reminderMonth`):

- Falta el snapshot si el último es anterior al 1° de `M`.
- Faltan los movimientos si el último es anterior a la última semana de `M` (fin de mes − 7 días).

Se repite cada 3 días (`shouldNotifyReminder`) mientras falte algo.

---

## Reglas transversales

1. Todos los valores financieros se guardan como `Decimal` y se leen con `Number(...)`.
2. Toda conversión ARS↔USD usa el CCL de la fecha correspondiente, no el actual (con la salvedad del CCL "más cercano" en ganancia real, hasta ±7 días).
3. Las fechas `@db.Date` se normalizan a medianoche UTC para evitar desfases; el front las formatea con `timeZone: "UTC"`.
