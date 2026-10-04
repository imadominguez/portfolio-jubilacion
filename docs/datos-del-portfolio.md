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
| **Tipo de cambio CCL implícito** | El valor del dólar CCL guardado junto al snapshot. Se ingresa al importar y se autocompleta con el CCL registrado para esa fecha (`ExchangeRate`), si existe. Una vez guardado no cambia. |

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
| **CAGR real** | CAGR nominal descontando la inflación anualizada del período (IPC): `(1 + CAGR) / (1 + inflación) - 1`. Requiere haber cargado el IPC. |
| **Máx. Drawdown** | Mayor caída porcentual desde un pico: `max((peak - value) / peak)` sobre todos los snapshots. |
| **Snapshots importados** | Cantidad total de registros históricos disponibles. |

### Gráfico de evolución

Serie temporal del valor del portfolio con toggle ARS/USD.

### Comparación vs benchmarks

Rendimiento normalizado del portfolio vs S&P 500 (`^GSPC`), Merval (`^MERV`) y NASDAQ (`^IXIC`). Los datos históricos se obtienen de Yahoo Finance y se almacenan en la tabla `BenchmarkPoint`. La base 100 es el primer snapshot disponible.

### Comparación vs inflación

Portfolio en ARS frente al **IPC acumulado** y al **CER/UVA** (argentinadatos.com), todos en base 100 desde el primer snapshot. Escala logarítmica por defecto. Responde a la pregunta "¿le gané a la inflación en pesos?". Detalle del cálculo en [logica-financiera.md](./logica-financiera.md#inflación-y-rendimiento-real-libinflationts-appactionsindicests).

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

## Plan DCA (`/plan`)

Reparto **determinista** (sin IA) del aporte del mes entre las posiciones del objetivo de rebalanceo.

| Dato | Descripción |
|---|---|
| **Aporte** | Monto en ARS a invertir este mes (editable; default $500.000). |
| **Gap por ticker** | `max(0, targetPct × valorCartera − valorActual)`: cuánto falta para llegar al peso objetivo. |
| **Monto a comprar** | El aporte se reparte en proporción al gap restante de cada ticker (las más infraponderadas reciben más), sin superar el gap de ninguna. Lo que no entra en ningún gap queda como "sin asignar". |
| **CEDEARs estimados** | Monto / precio estimado del CEDEAR (`precio USD del subyacente / ratio × CCL`). |
| **Peso resultante** | Peso de cada posición después de la compra. |

Requiere un snapshot y objetivos cargados en `/rebalance`. Detalle del algoritmo en [logica-financiera.md](./logica-financiera.md#plan-dca-libdca-plannerts).

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

Operaciones de compra/venta y dividendos. Las compras/ventas pueden cargarse a mano o, preferentemente, **importando el CSV de movimientos de Cocos**: cada fila queda en el libro de movimientos (pestaña *Movimientos*, con sub-vista de fondos FCI) y solo las compras/ventas generan una transacción que impacta el PPM. La importación es idempotente: reimportar el mismo CSV no duplica nada.

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

- **Importar**: CSV `portfolio_report_AAAAMMDD.csv` exportado desde Cocos Capital (formato: instrumento, cantidad, precio, moneda, total). La fecha se deriva del nombre del archivo y el CCL se autocompleta con el registrado para esa fecha (editable). Si hay posiciones en USD, el CCL es obligatorio. No se puede importar dos veces la misma fecha.
- **Ver detalle**: tabla completa de posiciones de cada snapshot histórico.
- **Exportar**: PDF, HTML imprimible o CSV (ver [api-y-exportacion.md](./api-y-exportacion.md)).
- **Eliminar**: los snapshots son inmutables (no se editan), pero el usuario puede borrar los propios.

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

Solo-ADMIN. Hoy contiene únicamente la gestión de **milestones**: crear y eliminar hitos de valor en USD y ver el progreso al próximo. Los hitos se marcan como alcanzados automáticamente al importar un snapshot que los supera.

La actualización de CCL, precios e índices vive en el **Centro de Datos** (`/datos`); los parámetros de jubilación se editan en `/retirement`.

---

## Centro de Datos (`/datos`)

Hub para cargar y mantener los datos. Muestra el checklist de **puesta en marcha** (qué falta cargar y dónde) y agrupa:

| Bloque | Acciones |
|---|---|
| **Importar** | Snapshot (CSV de Portfolio) y movimientos (CSV de Actividad) de Cocos. |
| **Mantenimiento** | CCL actual, precios de mercado (Yahoo), inflación IPC y CER/UVA. |
| **Históricos** | Wizard de ganancia real: CCL histórico y precios históricos de subyacentes. |

---

## Historial CCL (`/ccl`)

| Dato | Descripción |
|---|---|
| **CCL actual** | Último valor registrado en `ExchangeRate`. |
| **Variación 1 mes / YTD / 1 año** | `(CCL_actual − CCL_período) / CCL_período × 100`, con el registro más cercano hacia atrás. Los colores están invertidos: que suba el CCL se muestra como negativo (el portfolio pierde valor medido en USD si los precios en ARS no acompañan). |
| **Gráfico** | CCL y valor del portfolio en USD en doble eje Y. |
| **Tabla** | Últimos 30 registros. |

---

## Ganancia Real (`/real-gains`)

Módulo avanzado que descompone la ganancia en USD en sus dos componentes:

| Métrica | Descripción |
|---|---|
| **Ganancia real en USD** | `(valor_ARS_actual / CCL_hoy) - (costo_ARS_compra / CCL_en_fecha_compra)` |
| **Ganancia por apreciación de acciones** | `(cantidad/ratio × precio_USD_hoy) - (cantidad/ratio × precio_USD_en_compra)` usando precios reales de Yahoo Finance |
| **Impacto CCL** | Diferencia entre ambas. Cuánto de la ganancia (o pérdida) en USD se debe a la variación del tipo de cambio |

**Ejemplo de interpretación**: Si una acción subió 20% en USD pero el CCL subió 30%, aunque ganaste en ARS, en dólares reales tu poder adquisitivo bajó. El impacto CCL captura exactamente ese efecto.

La pantalla muestra KPIs, una barra de desglose (apreciación vs impacto CCL), una tabla por posición con la **cobertura de datos** (qué compras tienen CCL y precio histórico) y una nota metodológica. Solo incluye CEDEARs (posiciones con subyacente); bonos y acciones locales quedan fuera. Requiere haber cargado el CCL histórico y los precios históricos (wizard de 2 pasos). Fórmulas completas en [logica-financiera.md](./logica-financiera.md#ganancia-real-en-usd-e-impacto-ccl-libreal-gains-datats).

---

## Fuentes de datos externas

| Fuente | Datos obtenidos | Actualización |
|---|---|---|
| **Cocos Capital (CSV)** | Posiciones del portfolio (snapshot) y movimientos de la cuenta | Manual, al importar |
| **Cocos Capital (PDF)** | Tenencia para el reporte mensual con IA | Manual, en `/portfolio` |
| **dolarapi.com** | CCL actual | Manual (botón en `/datos`, `/ccl` o `/assets`) |
| **argentinadatos.com** | CCL histórico, IPC y CER/UVA | Manual (`/datos`, wizard de ganancia real, `/performance`) |
| **Yahoo Finance** | Precios actuales e históricos de subyacentes en USD y benchmarks | Manual (botón en `/datos` o `/assets`; benchmarks on-demand en `/performance`) |

Detalle técnico en [integraciones.md](./integraciones.md).

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
