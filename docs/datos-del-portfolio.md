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
| **Rendimiento vs snapshot anterior** | Rendimiento del período sin contar compras, ventas ni movimientos del FCI (Dietz modificado, [logica-financiera.md](./logica-financiera.md#rendimiento-de-un-período-dietz-modificado)). El monto es `valor_actual − valor_anterior − aportes netos`. |
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

Todas las métricas descuentan los aportes: el valor del portfolio sube con cada compra o suscripción al FCI aunque el mercado no se mueva (ADR-0019). Por eso necesitan los movimientos importados hasta la fecha del último snapshot; si faltan, la página lo avisa.

| KPI | Cálculo |
|---|---|
| **Rendimiento del año (%)** | Rendimiento encadenado (TWR) desde la base del año, sin contar aportes. Base: último snapshot del año anterior, o el primero disponible. Debajo, la ganancia en pesos: `valor_último − valor_base − aportes netos`. |
| **TIR anual** | Tasa anual que iguala el valor inicial, los flujos de las tenencias (compras, ventas, FCI, dividendos) y el valor final (XIRR). Calculada en ARS desde el **primer snapshot con valor** (un snapshot de $0, como el primer export de una cuenta nueva, no sirve de base) hasta el último. |
| **TIR real** | TIR descontando la inflación anualizada del período (IPC): `(1 + TIR) / (1 + inflación) - 1`. Requiere haber cargado el IPC. |
| **Máx. Drawdown** | Mayor caída porcentual desde un pico del índice sin aportes: `max((peak - value) / peak)`. |
| **Snapshots importados** | Cantidad total de registros históricos disponibles. |

**En dólares** (selector Pesos / Dólares): las mismas métricas con cada snapshot al CCL de su fecha y cada flujo al CCL del día en que se hizo, así no cuenta la devaluación como ganancia. La TIR real se reemplaza por **vs S&P 500**: cuántos puntos por año le sacaste (o te sacó) el S&P 500 en el mismo período. Es la comparación justa con el S&P 500 y el NASDAQ, que cotizan en dólares.

### Gráfico de evolución

Serie temporal del valor del portfolio con toggle ARS/USD.

### Comparación vs benchmarks

Rendimiento del portfolio sin aportes (índice TWR base 100) vs S&P 500 (`^GSPC`), Merval (`^MERV`) y NASDAQ (`^IXIC`). Los datos históricos se obtienen de Yahoo Finance y se almacenan en la tabla `BenchmarkPoint`. La base 100 es el primer snapshot con valor (un snapshot de $0 no sirve de base).

### Comparación vs inflación

Rendimiento del portfolio en ARS sin aportes frente al **IPC acumulado** y al **CER/UVA** (argentinadatos.com), todos en base 100 desde el primer snapshot con valor. Escala logarítmica por defecto. Responde a la pregunta "¿le gané a la inflación en pesos?". Detalle del cálculo en [logica-financiera.md](./logica-financiera.md#inflación-y-rendimiento-real-libinflationts-appactionsindicests).

### Timeline de snapshots

Lista cronológica de todos los snapshots importados con:
- Fecha
- Valor total ARS
- Rendimiento del período vs el snapshot anterior, sin contar aportes (vacío si no hay base positiva)

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

## Plan DCA (`/plan`)

Reparto del aporte del mes según las **señales del último reporte de oportunidades** ([ADR-0022](./adr/0022-plan-dca-segun-las-senales-del-reporte-sin-pesos-objetivo.md)). Sin pesos objetivo ni topes por acción.

| Dato | Descripción |
|---|---|
| **Aporte** | Monto en ARS a invertir este mes (editable; default $500.000). |
| **Señal** | Compra, mantener o venta, con su confianza, del último reporte. |
| **Monto a comprar** | Va a las acciones en "compra", proporcional a la confianza (alta 3, media 2, baja 1). Si ninguna está en "compra", partes iguales entre las "mantener". "Venta" no recibe. Sin reporte, partes iguales entre todos los CEDEARs. |
| **CEDEARs estimados** | Monto / precio del CEDEAR (el del snapshot, o `precio USD del subyacente / ratio × CCL`). |
| **Peso resultante** | Peso de cada posición después de la compra (informativo: no hay objetivo). |

Si el reporte tiene más de 45 días, la página avisa. Detalle en [logica-financiera.md](./logica-financiera.md#plan-dca-libdca-plannerts).

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
| **Proyección del portfolio** | Crecimiento proyectado del capital actual con el **retorno anual esperado** configurado (7 % nominal en USD por defecto). La TIR histórica se muestra como referencia, no como supuesto. |
| **Años para alcanzar la meta** | Estimación en base a la proyección |
| **Aporte real** | Promedio mensual en USD de lo que entró neto al portfolio en los últimos 12 meses cerrados (compras, ventas, FCI, dividendos), y la parte que fue a CEDEARs y bonos. Se muestra al lado del aporte configurado y se puede usar en la proyección. |
| **TIR histórica en USD** | Calculada automáticamente desde los snapshots con valor en USD (> 0) y los flujos de las tenencias pasados a USD con el CCL de su fecha (XIRR). No cuenta los aportes como rendimiento. |

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

> Las ventas importadas de Cocos traen la cantidad en negativo; el PPM y el P&L realizado usan su valor absoluto (la importación nueva ya la guarda positiva).

### Gastos del mes

Arriba de las pestañas. Sale de los pagos ("Orden De Pago") del CSV de Actividad, en pesos: Cocos no informa a quién se pagó, así que cada pago acepta una **categoría** (Supermercado, Alquiler y expensas, Servicios e impuestos, Suscripciones, etc.) y una **nota**.

| Dato | Cálculo |
|---|---|
| **Gastado** | Suma de los pagos del mes (un pago con total positivo es un reintegro y resta). |
| **Promedio por día** | Gastado / días transcurridos (hasta hoy en el mes actual, todos en un mes cerrado). |
| **Proyección del mes** | Promedio por día × días del mes. Solo en el mes actual. |
| **Contra el mes anterior** | Variación contra el mes anterior **hasta el mismo día** (en un mes cerrado, contra el mes anterior completo). |
| **Por categoría** | Total y % por categoría; los pagos sin categoría van aparte. Si la categoría tiene **presupuesto**, muestra lo gastado contra él (la barra se pone amarilla desde el 80 % y roja al superarlo). |

Un pago sin categoría con el mismo monto que otros ya categorizados muestra una **sugerencia** ("¿Suscripciones?") que la aplica con un clic. Los presupuestos se cargan con el botón **Presupuestos**; con las alertas activadas, llega un mail la primera vez que una categoría supera el suyo en el mes.

Los cortes por día y por mes usan la hora de Argentina. Los pagos en dólares no entran en los totales. Detalle en [logica-financiera.md](./logica-financiera.md#gastos-del-mes-libexpensests).

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

## Flujo de caja (`/flujo`)

Cuánto entró y salió de la cuenta de Cocos cada mes. Solo ve lo que pasa por Cocos.

| Dato | Cálculo |
|---|---|
| **Depósitos** | Recibos de cobro del mes. |
| **Gastos** | Órdenes de pago del mes (un reintegro resta). |
| **Ahorro / tasa de ahorro** | Depósitos − gastos, y ese ahorro sobre los depósitos. Negativo: se gastó más de lo depositado y la diferencia salió del FCI o del efectivo. |
| **Invertido** | Compras menos ventas de CEDEARs y bonos. |
| **FCI neto** | Suscripciones menos rescates del FCI. |

El resumen de arriba usa los últimos 12 meses cerrados. Los movimientos en dólares se pasan al CCL de su fecha. Detalle en [logica-financiera.md](./logica-financiera.md#flujo-de-caja-libcash-flowts).

---

## Impuestos (`/impuestos`)

Datos de un año para la declaración, con descarga en CSV. No aplica reglas impositivas (exenciones, tipo de cambio BNA): eso queda para la declaración.

| Sección | Qué muestra |
|---|---|
| **Tenencia al cierre** (Bienes Personales) | Posiciones del último snapshot del año, valuadas al precio de esa fecha. Avisa si el snapshot está a más de 7 días del 31/12. No incluye el efectivo de la cuenta. |
| **Ventas** (Ganancias) | Por venta: ingreso neto, costo promedio ponderado con comisiones y resultado. Si se compró en otra moneda (dólar MEP), el resultado queda sin calcular. |
| **Dividendos cobrados** | Del libro de movimientos más los cargados a mano, con totales por moneda. |

Detalle en [logica-financiera.md](./logica-financiera.md#reporte-para-impuestos-libtax-reportts).

---

## Alertas (`/alertas`)

Mail diario (9:00 de Argentina) solo si hay algo para avisar ([ADR-0020](./adr/0020-alertas-por-mail-con-cron-y-gmail-smtp.md)):

| Alerta | Cuándo |
|---|---|
| **Caída** | Una acción del último snapshot cae más que el umbral desde su máximo de 52 semanas (15 % por defecto) o en 5 ruedas (8 %), en USD del subyacente. Incluye titulares recientes de la empresa. No se repite salvo que caiga 5 puntos más; si sigue abajo, se recuerda a los 30 días. |
| **Carga del mes** | Desde el día configurado (5 por defecto), si falta el snapshot o los movimientos del mes anterior. Se repite cada 3 días. |
| **Resumen mensual** | Cuando el mes anterior está cargado (o desde el día 20): valor y rendimiento del año sin aportes, flujo de caja, en qué gastaste y el Plan DCA del mes. |
| **Reporte automático** (ADMIN) | El 1° de cada mes, si no hay un reporte de oportunidades del mes, lo genera (unos US$ 0,07), así el Plan DCA usa señales nuevas. |

En la página se activan, se ajustan los umbrales, se manda un mail de prueba y se ve el historial de lo enviado.

---

## Fuentes de datos externas

| Fuente | Datos obtenidos | Actualización |
|---|---|---|
| **Cocos Capital (CSV)** | Posiciones del portfolio (snapshot) y movimientos de la cuenta | Manual, al importar |
| **Yahoo Finance (alertas)** | Cierres del último año y titulares de las acciones del último snapshot | Automática: cron diario (no se guardan) |
| **Gmail (SMTP)** | Envío de las alertas por mail | Automática: cron diario, o manual en `/alertas` |
| **Yahoo Finance (titulares)** | Noticias por acción para el reporte de oportunidades con IA | Al generar el reporte en `/portfolio` (no se guardan aparte) |
| **dolarapi.com** | CCL actual | Automática todos los días a las 9, y manual (botón en `/datos`, `/ccl` o `/assets`) |
| **argentinadatos.com** | CCL histórico, IPC y CER/UVA | IPC y CER automáticos todos los días; manual en `/datos`, wizard de ganancia real y `/performance` |
| **Yahoo Finance** | Precios actuales e históricos de subyacentes en USD y benchmarks | Automática todos los días a las 9, y manual (botón en `/datos` o `/assets`; benchmarks on-demand en `/performance`) |

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
| **TIR** | Tasa interna de retorno. Rendimiento anual de lo invertido, teniendo en cuenta cuándo entró y salió cada peso. |
| **TWR** | Time-weighted return. Rendimiento encadenado de cada período, sin el efecto de los aportes; es lo que se compara contra benchmarks. |
| **Drawdown** | Caída porcentual desde un máximo histórico. El máx. drawdown es la mayor caída registrada. |
| **Benchmark** | Índice de referencia contra el que se compara el rendimiento (S&P 500, Merval, NASDAQ). |
