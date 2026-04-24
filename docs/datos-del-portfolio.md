# Datos que brinda la aplicación Portfolio Jubilación

Esta aplicación es un tracker personal de CEDEARs operados en Cocos Capital. A continuación se documenta cada métrica, cálculo y dato que la app expone al usuario.

---

## Dashboard (`/`)

Punto de entrada principal. Muestra el estado actual del portfolio basado en el **snapshot más reciente** importado.

### Valor total del portfolio

| Dato | Descripción |
|---|---|
| **Valor total ARS** | Suma de `precio × cantidad` de todas las posiciones del snapshot. Fuente: CSV de Cocos Capital. |
| **Equivalente USD** | `totalValueArs / CCL`, donde CCL es el tipo de cambio contado con liquidación registrado al importar el snapshot. |
| **Tipo de cambio CCL implícito** | El valor del dólar CCL guardado junto al snapshot. Fuente: dolarapi.com en el momento de la importación. |

### KPIs secundarios

| KPI | Cálculo |
|---|---|
| **Rendimiento vs snapshot anterior** | `(valorARS_actual - valorARS_anterior) / valorARS_anterior × 100` en %. |
| **P&L no realizado (ARS)** | `Σ (precio_actual - PPM) × cantidad` para todas las posiciones con PPM disponible. Refleja ganancia/pérdida latente respecto al precio promedio de compra. |
| **Dividendos cobrados (USD)** | Suma acumulada de todos los dividendos registrados en moneda USD. |
| **Posiciones activas** | Cantidad de CEDEARs distintos en el snapshot actual. |

### Tabla de holdings

Por cada posición muestra:
- **Ticker** y nombre del instrumento
- **Cantidad** de CEDEARs
- **Precio ARS** del snapshot + precio USD del subyacente en tiempo real (Yahoo Finance)
- **PPM** (precio promedio ponderado de compra en ARS, desde transacciones registradas)
- **P&L %** = `(precio_actual - PPM) / PPM × 100`
- **Valor ARS** de la posición
- **Valor USD en tiempo real** = `(cantidad / cedearRatio) × precio_USD_Yahoo`
- Barra visual de peso relativo en el portfolio

Al pie de la tabla: **Total live USD** basado en precios de Yahoo Finance actualizados.

### Gráfico de evolución del portfolio

Serie temporal con todos los snapshots importados. Muestra cómo evolucionó el valor total en ARS a lo largo del tiempo.

### Mejores y peores performers

Comparación entre snapshot actual y anterior:
- `Δ% = (precio_actual - precio_anterior) / precio_anterior × 100` por posición
- Se muestran los 3 mejores y 3 peores.

### Panel de allocación

Gráfico de torta con el peso porcentual de cada posición en el portfolio.

### Milestones de capital

Hitos de valor total en USD configurados por el usuario (ej: USD 10.000, USD 25.000…). Muestra progreso hacia cada hito y fecha en que fue alcanzado.

---

## Performance (`/performance`)

Análisis del historial completo usando todos los snapshots importados.

### KPIs de performance

| KPI | Cálculo |
|---|---|
| **Rendimiento del año (%)** | `(valorARS_último - valorARS_base_año) / valorARS_base_año × 100`. Base: último snapshot del año anterior, o el primero disponible. |
| **CAGR** (Tasa anual compuesta) | `(valorFinal / valorInicial)^(1/años) - 1`. Calculado en ARS desde el primer al último snapshot. |
| **Máx. Drawdown** | Mayor caída porcentual desde un pico: `max((peak - value) / peak)` sobre todos los snapshots. |
| **Snapshots importados** | Cantidad total de registros históricos disponibles. |

### Gráfico de evolución

Serie temporal del valor del portfolio en ARS con opción de comparar contra benchmarks.

### Comparación vs benchmarks

Rendimiento normalizado del portfolio vs S&P 500 (`^GSPC`), Merval (`^MERV`) y NASDAQ (`^IXIC`). Los datos históricos se obtienen de Yahoo Finance y se almacenan en la tabla `BenchmarkPoint`. La base 100 es el primer snapshot disponible.

### Timeline de snapshots

Lista cronológica de todos los snapshots importados con:
- Fecha
- Valor total ARS
- Variación porcentual vs el snapshot anterior

---

## Análisis (`/analysis`)

Concentración del portfolio basada en el snapshot más reciente.

| Vista | Detalle |
|---|---|
| **Por sector** | % del portfolio en Technology, Healthcare, Financials, etc. Requiere completar el campo `sector` en Assets. |
| **Por país** | % por país del activo subyacente. Requiere campo `country` en Assets. |
| **Por industria** | % por industria. Requiere campo `industry` en Assets. |
| **Top 10 posiciones** | Barra horizontal con el % de cada posición. |

---

## Rebalanceo (`/rebalance`)

Herramienta para alinear el portfolio a una asignación objetivo.

- El usuario define un **porcentaje objetivo** por ticker (ej: AAPL → 15%)
- La app compara con la asignación real del snapshot más reciente
- Muestra desviación: posiciones que hay que **comprar** o **vender**
- Desviaciones menores a ±1% se consideran en rango (sin acción requerida)

---

## Jubilación (`/retirement`)

Calculadora de planificación para el retiro.

### Inputs del usuario

| Campo | Descripción |
|---|---|
| Edad actual | Edad en años |
| Edad de retiro | Cuándo planea jubilarse |
| Gastos mensuales (USD) | Gasto estimado en retiro |
| Tasa de inflación | % anual proyectado |
| Tasa de retiro | % anual del capital que retira (ej: regla del 4%) |
| Contribución mensual | Ahorro mensual adicional proyectado |

### Outputs calculados

| Output | Cálculo |
|---|---|
| **Capital necesario para jubilarse** | `gastos_mensuales × 12 / tasa_retiro` ajustado por inflación |
| **Proyección del portfolio** | Crecimiento proyectado del capital actual asumiendo una tasa de retorno (configurable o basada en el CAGR histórico de la app) |
| **Años para alcanzar la meta** | Estimación en base a la proyección |
| **CAGR histórico** | Calculado automáticamente desde los snapshots en USD: `(último_USD / primero_USD)^(1/años) - 1` |

---

## Transacciones (`/transactions`)

Registro manual de operaciones de compra/venta de CEDEARs y dividendos.

### Transacciones de compra/venta

| Dato | Descripción |
|---|---|
| Ticker | CEDEAR operado |
| Tipo | BUY o SELL |
| Cantidad | CEDEARs comprados/vendidos |
| Precio | Precio en ARS (o USD) al momento de la operación |
| Comisión | Fee opcional |
| Fecha | Fecha de la operación |

### PPM — Precio Promedio Ponderado de Compra

Calculado a partir de todas las compras registradas:

```
Para cada BUY:
  totalCost += cantidad × precio + comisión
  totalQty  += cantidad

PPM = totalCost / totalQty

Al vender, se ajusta el costo proporcional:
  nuevoTotalCost = PPM × (totalQty - vendido)
```

El PPM se muestra en la tabla de holdings del Dashboard para calcular el P&L latente.

### P&L Realizado

Para cada venta registrada:
```
pnl     = (precio_venta - precio_promedio_compra) × cantidad
pnl_pct = (precio_venta - precio_promedio_compra) / precio_promedio_compra × 100
```

### Dividendos

Registro de dividendos cobrados por ticker con monto, moneda (ARS/USD) y fecha. El total acumulado en USD se muestra en el Dashboard.

---

## Snapshots (`/snapshots`)

Vista y gestión del historial de snapshots importados.

- **Importar**: CSV exportado desde Cocos Capital (formato: instrumento, cantidad, precio, moneda, total). Al importar se solicita la fecha y el CCL del día.
- **Ver detalle**: tabla completa de posiciones de cada snapshot histórico.
- **Exportar**: descarga del snapshot en formato JSON.
- **Eliminar**: los snapshots son inmutables pero pueden eliminarse.

---

## Assets (`/assets`)

Tabla de referencia de los CEDEARs disponibles.

| Campo | Descripción |
|---|---|
| Ticker | Símbolo del CEDEAR en el mercado local (ej: `AAPL`) |
| Instrumento | Nombre completo |
| CEDEAR Ratio | Cantidad de CEDEARs equivalente a 1 acción subyacente |
| Underlying Ticker | Símbolo del subyacente en NYSE/NASDAQ (ej: `AAPL`) para obtener precios de Yahoo Finance |
| Sector / Industria / País | Metadatos para el módulo de análisis de concentración |

---

## Configuración (`/settings`)

| Sección | Funcionalidad |
|---|---|
| **Tipo de cambio CCL** | Botón para obtener el CCL actual desde dolarapi.com y guardarlo. Historial de fechas guardadas. |
| **Milestones** | Crear y eliminar hitos de valor en USD. |
| **Benchmarks** | Botón para cargar/actualizar datos históricos del S&P500, Merval y NASDAQ desde Yahoo Finance. |
| **Retiro** | Configurar los parámetros de la calculadora de jubilación. |

---

## Ganancia Real (`/real-gains`) *(feature en desarrollo)*

Módulo avanzado que descompone la ganancia en USD en sus dos componentes:

| Métrica | Descripción |
|---|---|
| **Ganancia real en USD** | `(valor_ARS_actual / CCL_hoy) - (costo_ARS_compra / CCL_en_fecha_compra)` |
| **Ganancia por apreciación de acciones** | `(cantidad/ratio × precio_USD_hoy) - (cantidad/ratio × precio_USD_en_compra)` usando precios reales de Yahoo Finance |
| **Impacto CCL** | Diferencia entre ambas. Cuánto de la ganancia (o pérdida) en USD se debe a la variación del tipo de cambio |

**Ejemplo de interpretación**: Si una acción subió 20% en USD pero el CCL subió 30%, aunque ganaste en ARS, en dólares reales tu poder adquisitivo bajó. El impacto CCL captura exactamente ese efecto.

---

## Fuentes de datos externas

| Fuente | Datos obtenidos | Actualización |
|---|---|---|
| **Cocos Capital (CSV)** | Posiciones, precios y valores del portfolio | Manual, al importar snapshot |
| **dolarapi.com** | CCL actual e histórico | Manual (botón en Settings) |
| **Yahoo Finance** | Precios actuales y históricos de acciones subyacentes en USD | Manual (botón en Assets/Settings) |

---

## Glosario

| Término | Definición |
|---|---|
| **CEDEAR** | Certificado de Depósito Argentino. Representa una fracción de una acción extranjera, cotizada en ARS en mercados locales. |
| **CEDEAR Ratio** | Cantidad de CEDEARs necesarios para representar 1 acción del subyacente (ej: ratio 10 → 10 CEDEARs = 1 AAPL). |
| **CCL** | Contado con Liquidación. Tipo de cambio implícito que resulta de comprar un activo en ARS y venderlo en USD. |
| **PPM** | Precio Promedio Ponderado de compra. Costo promedio por CEDEAR considerando todas las compras y sus comisiones. |
| **P&L latente / no realizado** | Ganancia o pérdida sobre posiciones que todavía se tienen (no se vendieron). |
| **P&L realizado** | Ganancia o pérdida efectivamente concretada al vender una posición. |
| **Snapshot** | Fotografía inmutable del estado del portfolio en una fecha específica, importada desde el CSV de Cocos Capital. |
| **CAGR** | Compound Annual Growth Rate. Tasa de crecimiento anual compuesta. |
| **Drawdown** | Caída porcentual desde un máximo histórico. El máx. drawdown es la mayor caída registrada. |
| **Benchmark** | Índice de referencia contra el que se compara el rendimiento (S&P 500, Merval, NASDAQ). |
