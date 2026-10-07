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

---

## Performance histórica (`app/(app)/performance/page.tsx`)

Las fórmulas viven en `lib/snapshot-returns.ts` (con tests). Un snapshot puede valer $0 (p. ej. el primer export de una cuenta recién abierta) y es inmutable, así que no se corrige el dato: se evita usarlo como base.

- **Sin base positiva no hay porcentaje.** `pctChange` y `cagrPct` devuelven `null` y la UI muestra "—" (antes salía `+Infinity%` o un CAGR de 0%).
- **La serie de rendimiento arranca en el primer snapshot con valor** (`performanceSeries`). De ahí salen el CAGR, el rendimiento del año, el drawdown, la fecha desde la que se piden benchmarks e índices, y los gráficos normalizados (benchmarks e inflación). El gráfico de evolución y la tabla de registros siguen mostrando todos los snapshots.

### CAGR

```
CAGR = ((V_final / V_inicial) ^ (1 / años) − 1) × 100
```

`años = (fecha_último − fecha_primero) / 365`. Se muestra solo si `años ≥ 0.1`.

### Máximo Drawdown

```
peak_t = máx(p_0 .. p_t)
DD_t   = (peak_t − p_t) / peak_t
MaxDD  = máx(DD_t) × 100
```

### Rendimiento del año

Base = último snapshot del año anterior; si no existe, el primero del año en curso.

```
rendimientoAnualPct = (V_último − V_base) / V_base × 100
```

### Variación entre snapshots consecutivos

```
((snapshot_actual − snapshot_previo) / snapshot_previo) × 100
```

---

## Benchmarks (`app/actions/benchmarks.ts`)

Ver también **Inflación y rendimiento real** más abajo.

Los índices (`^GSPC`, `^MERV`, `^IXIC`) se normalizan a **base 100** en su primer punto:

```
normalizedValue = (value / firstValue) × 100
```

Esto permite superponerlos con el portafolio normalizado de la misma forma en `BenchmarkOverlayChart`.

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
- El KPI "CAGR real" de `/performance` = `realReturnPct(cagr, annualize(inflaciónPeríodo, años))`.
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

Hitos por defecto si el usuario no tiene ninguno: **USD 10.000, 25.000, 50.000, 100.000, 250.000**. Al importar un snapshot con `totalValueUsd > 0`, `checkAndUpdateMilestones` marca como alcanzados los que cumplen:

```
currentValueUsd ≥ targetValueUsd  →  reached = true, reachedAt = now
```

---

## Reglas transversales

1. Todos los valores financieros se guardan como `Decimal` y se leen con `Number(...)`.
2. Toda conversión ARS↔USD usa el CCL de la fecha correspondiente, no el actual (con la salvedad del CCL "más cercano" en ganancia real, hasta ±7 días).
3. Las fechas `@db.Date` se normalizan a medianoche UTC para evitar desfases; el front las formatea con `timeZone: "UTC"`.
