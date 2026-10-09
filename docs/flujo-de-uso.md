# Flujo de uso — Portfolio Jubilación

## Descripción general

Portfolio Jubilación es un dashboard personal para hacer seguimiento de un portafolio de inversión a largo plazo compuesto por CEDEARs comprados a través de Cocos Capital.

El sistema funciona con **snapshots**: capturas del estado del portafolio en un momento específico del tiempo. Cada snapshot es inmutable — una vez importado, nunca se modifica. Esto permite reconstruir el historial con total fidelidad.

---

## Primer uso (onboarding)

Al entrar por primera vez al dashboard se abre un **wizard de bienvenida** que guía la carga de datos en el orden correcto. "Más tarde" lo cierra por la sesión del navegador (vuelve a aparecer en la próxima sesión) y "No mostrar más" lo descarta; el progreso se guarda por usuario en la base (`UserSetup`) y el checklist sigue disponible.

Orden recomendado:

1. **Snapshot** (requerido) — CSV de Portfolio. Desbloquea el dashboard.
2. **Assets** (requerido para ADMIN) — al importar el snapshot la app detecta los tickers y ofrece completar ratio, subyacente, sector y país (asistente en `/assets`). El catálogo es global y admin-only: para un usuario `USER` el paso aparece como informativo ("Lo configura el administrador") y no bloquea la puesta en marcha.
3. **Transacciones** — CSV de Actividad. Habilita PPM y P&L.
4. **Históricos** — CCL y precios de acciones para la Ganancia Real.
5. **Preferencias** — plan de retiro.

El **checklist "Puesta en marcha"** (dashboard y `/datos`) muestra qué falta. El **Centro de Datos** (`/datos`) reúne todas las importaciones y actualizaciones. El tour guiado de `nextstepjs` sigue disponible como ayuda contextual desde la Guía.

---

## Flujo mensual recomendado

> **Guía visual en la app:** la sección [Guía Cocos](/guia) explica con esquemas de las pantallas de Cocos dónde descargar cada archivo en Cocos Capital.

### 1. Exportar CSV desde Cocos Capital

Cocos exporta archivos **CSV** (no Excel). Hay **dos descargas distintas** según el dato que necesites:

#### A) Snapshots — estado del portfolio

1. Iniciá sesión en [Cocos Capital](https://cocos.capital)
2. En el menú lateral, entrá a **Portfolio** (no Actividad)
3. Abrí **Descargar portfolio**
4. Seleccioná la **fecha** del snapshot
5. Descargá el archivo en formato **CSV**
6. El archivo se llamará `portfolio_report_AAAAMMDD.csv` (ej: `portfolio_report_20260504.csv`)

Columnas del CSV:

```
instrumento;cantidad;precio;moneda;total
```

Ejemplo de contenido:

```
instrumento;cantidad;precio;moneda;total
CEDEAR MERCADOLIBRE INC. (MELI);4;21950;ARS;87800
CEDEAR META PLATFORMS INC. (META);3;39780;ARS;119340
CEDEAR NVIDIA CORPORATION (NVDA);11;11100;ARS;122100
```

#### B) Transacciones — movimientos (compras/ventas)

1. Iniciá sesión en [Cocos Capital](https://cocos.capital)
2. En el menú lateral, entrá a **Actividad** (no Portfolio)
3. Abrí **Descargar movimientos**
4. Seleccioná el **año y mes** (o reporte anual) que necesitás
5. Descargá el archivo en formato **CSV**
6. El archivo se llamará `movements_report_YYYY-MM-DD_YYYY-MM-DD.csv`

Importá este archivo en **Transacciones** o en el **Centro de Datos** (`/datos`) con el botón **Importar CSV Cocos**. Arriba de Transacciones aparecen los **gastos del mes** (los pagos de la cuenta): total, promedio por día, proyección, comparación con el mes anterior y el total por categoría; a cada pago le podés poner una categoría y una nota. La app muestra una previsualización agrupada por categoría (compras, ventas, FCI, pagos, dividendos…) donde podés destildar filas. Solo las compras y ventas generan transacciones; el resto queda en el libro de movimientos. Podés reimportar el mismo archivo (o uno que se superponga en fechas) sin duplicar: se deduplica por número de ticket de Cocos.

---

### 2. Importar el snapshot en la plataforma

1. Desde el dashboard, Snapshots o el Centro de Datos, hacé click en el botón **"Importar CSV"** del header
2. Si tenés dudas sobre la descarga en Cocos, consultá la [Guía Cocos](/guia#snapshots)
3. Se abre el sheet lateral de importación
4. **Paso 1 — Seleccionar:**
   - Adjuntá el archivo CSV exportado
   - La **fecha del snapshot** se toma del nombre del archivo (`portfolio_report_AAAAMMDD.csv`). Si el nombre no tiene ese formato, se pide a mano
   - El **CCL del día** se autocompleta con el CCL guardado para esa fecha; si no hay, se avisa y podés ingresarlo. Es opcional, salvo que el CSV tenga posiciones en USD
   - Hacé click en **"Previsualizar"**

5. **Paso 2 — Revisar:**
   - El sistema parsea el CSV y muestra una tabla con todas las posiciones detectadas: ticker, cantidad, precio, valor y peso porcentual
   - Verificá que los datos sean correctos
   - Hacé click en **"Confirmar importación"** para guardar el snapshot

> El sistema impide importar dos snapshots para la misma fecha: el aviso aparece al elegir la fecha, antes de previsualizar. Si un snapshot quedó mal cargado, eliminalo desde su detalle (`/snapshots/[id]` → "Eliminar snapshot") y volvé a importarlo.
>
> Al confirmar, la pantalla de éxito muestra el total importado y el siguiente paso pendiente de la puesta en marcha.

---

### 3. Consultar el dashboard

Una vez importado el snapshot, estas son las secciones principales (el detalle de cada métrica está en [datos-del-portfolio.md](./datos-del-portfolio.md)):

#### Dashboard (`/`)
- Valor total del portfolio en ARS y su equivalente en USD (si se ingresó el CCL)
- Rendimiento vs el snapshot anterior, P&L no realizado, dividendos y CCL
- Resumen de ganancia real, jubilación, Plan DCA y concentración, con acceso a cada módulo
- Tabla de posiciones actuales ordenadas por valor y panel de distribución
- Mientras falten datos, el checklist de **puesta en marcha**

#### Performance (`/performance`)
- Rendimiento del año, **TIR anual** y **TIR real** (descontando inflación), máximo drawdown, todos sin contar aportes
- Selector **Pesos / Dólares**: en dólares, las mismas métricas sin la devaluación y la comparación anual contra el S&P 500
- Gráfico de evolución con toggle ARS / USD
- Comparación contra S&P 500, Merval y NASDAQ, y contra IPC y CER/UVA
- Timeline de todos los snapshots con el rendimiento de cada período

#### Análisis y planificación
- **Análisis** (`/analysis`): concentración por sector, país e industria
- **Ganancia Real** (`/real-gains`): cuánto de la ganancia en USD es apreciación de la acción y cuánto es efecto del CCL
- **Plan DCA** (`/plan`): cómo repartir el aporte del mes según las señales del último reporte de oportunidades (más a lo que está en "compra", nada a lo que está en "venta")
- **Jubilación** (`/retirement`): capital necesario, proyección y Monte Carlo
- **Flujo de caja** (`/flujo`): por mes, cuánto depositaste en Cocos, cuánto gastaste, tu tasa de ahorro y cuánto fue a CEDEARs
- **Alertas** (`/alertas`): mail diario si una acción cae más de lo configurado desde su máximo o en la semana (con los titulares de la empresa) y recordatorio para cargar el mes
- **Impuestos** (`/impuestos`): para la declaración de un año, la tenencia al 31/12, las ventas con su resultado y los dividendos cobrados, con descarga en CSV

#### Snapshots (`/snapshots`)
- Lista cronológica de todos los snapshots importados
- Para cada snapshot: fecha, valor ARS, valor USD, CCL, cantidad de posiciones y rendimiento del período (sin aportes)
- Click en cualquier snapshot para ver su detalle completo

#### Snapshot detalle (`/snapshots/[id]`)
- Estado completo del portfolio en esa fecha específica
- KPIs de ese momento: valor ARS, USD, CCL, posiciones
- Tabla de posiciones con todos los datos
- Panel de distribución

#### Assets (`/assets`) — solo ADMIN
- Catálogo de CEDEARs con su ratio de conversión, subyacente, sector, industria y país
- Permite agregar, editar y eliminar activos de referencia (el catálogo es compartido por todos los usuarios)
- El ratio y el subyacente se usan para los cálculos en USD (precios de Yahoo, ganancia real, plan DCA, reporte de oportunidades)

#### Oportunidades (`/portfolio`) — solo ADMIN
- **Generar reporte**: para cada acción del último snapshot, la app baja el precio del último año y los titulares de noticias recientes, y Claude dice si es oportunidad de **compra**, **mantener** o **venta**, con el motivo, los riesgos y su confianza
- **Señales por acción:** tabla con la señal de cada acción en los últimos reportes, marcando las que cambiaron
- No habla de porcentajes de tenencia: el reparto del aporte está en el Plan DCA
- Al pie de cada reporte se ve el costo de esa corrida; los reportes quedan en el historial

---

## Reglas del sistema

| Regla | Descripción |
|---|---|
| Snapshots inmutables | Una vez importado, un snapshot no puede modificarse ni sobreescribirse (sí borrarse, para reimportarlo) |
| Una fecha, un snapshot | No pueden existir dos snapshots para la misma fecha (por usuario) |
| Datos históricos preservados | El historial nunca se modifica; los nuevos snapshots se agregan al final |
| Fuente única de datos | Todo el historial proviene de CSV exportados de Cocos Capital |
| Importación idempotente | Reimportar movimientos no duplica: se deduplica por número de ticket |
| Datos por usuario | Cada usuario ve solo sus snapshots, transacciones, reportes, gastos e hitos; el CCL, los precios y el catálogo de assets son compartidos |

---

## Ciclo de vida del dato

```
Cocos Capital
     │
     ├── CSV de Portfolio ──► PortfolioSnapshot (inmutable) ──► Positions
     │
     └── CSV de Actividad ──► Movement (libro) ──► Transaction (solo compras/ventas) ──► PPM, P&L

Último snapshot + PPM + precios y titulares de Yahoo ──► Claude ──► PortfolioReport (oportunidades)

dolarapi / argentinadatos / Yahoo ──► caches en DB (CCL, precios, benchmarks, IPC/CER)
                                            │
                                            ▼
              Dashboard / Performance / Análisis / Ganancia real / Plan DCA / Jubilación
                                  (lectura y visualización)
```

---

## Frecuencia sugerida

| Frecuencia | Acción |
|---|---|
| **Diaria (automática)** | Si están activadas, las alertas revisan caídas y la carga del mes y mandan un mail solo si hay algo |
| **Mensual** | Exportar e importar un snapshot nuevo y el CSV de movimientos del mes; categorizar los gastos en Transacciones; actualizar CCL y precios en `/datos`; revisar el Plan DCA; generar el reporte de oportunidades en `/portfolio` (ADMIN) |
| **Semestral** | Revisar la página de Performance para evaluar el crecimiento del portfolio |
| **Anual (enero)** | Importar el snapshot del 31/12 y los movimientos del año, y descargar el CSV de `/impuestos` para la declaración |
| **Cuando cambia un ratio** | Actualizar el ratio CEDEAR correspondiente en la sección Assets |

---

## Notas sobre los CEDEARs

Los CEDEARs son certificados que representan acciones extranjeras cotizando en el mercado argentino. Su precio en ARS depende de tres factores:

```
Precio CEDEAR ≈ (Precio acción USD / Ratio) × CCL
```

Ejemplo con AAPL:
- Precio acción: USD 200
- Ratio CEDEAR: 10:1
- CCL: ARS 1.200

```
Precio CEDEAR ≈ (200 / 10) × 1.200 = ARS 24.000
```

El ratio de cada CEDEAR se gestiona en la sección **Assets** y permite calcular el valor implícito en USD de cada posición.
