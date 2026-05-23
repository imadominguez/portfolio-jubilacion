# Flujo de uso — Portfolio Jubilación

## Descripción general

Portfolio Jubilación es un dashboard personal para hacer seguimiento de un portafolio de inversión a largo plazo compuesto por CEDEARs comprados a través de Cocos Capital.

El sistema funciona con **snapshots**: capturas del estado del portafolio en un momento específico del tiempo. Cada snapshot es inmutable — una vez importado, nunca se modifica. Esto permite reconstruir el historial con total fidelidad.

---

## Flujo mensual recomendado

> **Guía visual en la app:** la sección [Guía Cocos](/guia) explica con capturas de pantalla dónde descargar cada archivo en Cocos Capital.

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

Importá este archivo en la sección **Transacciones** de la app con el botón **Importar CSV Cocos**.

---

### 2. Importar el snapshot en la plataforma

1. Desde el dashboard o Snapshots, hacé click en el botón **"Importar CSV"** del header
2. Si tenés dudas sobre la descarga en Cocos, consultá la [Guía Cocos](/guia#snapshots)
3. Se abre el sheet lateral de importación
4. **Paso 1 — Seleccionar:**
   - Adjuntá el archivo CSV exportado
   - Completá la **fecha del snapshot** (la fecha a la que corresponde el estado de la cartera)
   - Opcionalmente ingresá el **CCL del día** (tipo de cambio ARS/USD) para habilitar los cálculos en dólares
   - Hacé click en **"Previsualizar"**

5. **Paso 2 — Revisar:**
   - El sistema parsea el CSV y muestra una tabla con todas las posiciones detectadas: ticker, cantidad, precio, valor y peso porcentual
   - Verificá que los datos sean correctos
   - Hacé click en **"Confirmar importación"** para guardar el snapshot

> El sistema impide importar dos snapshots para la misma fecha. Si ya existe uno para esa fecha, se muestra un error.

---

### 3. Consultar el dashboard

Una vez importado el snapshot, podés navegar las cuatro secciones del dashboard:

#### Dashboard (`/`)
- Valor total del portfolio en ARS
- Equivalente en USD (si se ingresó el CCL)
- Rendimiento vs el snapshot anterior
- Tipo de cambio CCL implícito
- Tabla de posiciones actuales ordenadas por valor
- Panel de distribución con barras de asignación por activo

#### Performance (`/performance`)
- Rendimiento total desde el primer snapshot
- CAGR (tasa anual compuesta)
- Máximo drawdown registrado
- Gráfico de línea con la evolución del portfolio a lo largo del tiempo
- Toggle ARS / USD para cambiar la unidad del gráfico
- Timeline de todos los snapshots con la variación porcentual entre cada uno

#### Snapshots (`/snapshots`)
- Lista cronológica de todos los snapshots importados
- Para cada snapshot: fecha, valor ARS, valor USD, CCL, cantidad de posiciones y variación vs el anterior
- Click en cualquier snapshot para ver su detalle completo

#### Snapshot detalle (`/snapshots/[id]`)
- Estado completo del portfolio en esa fecha específica
- KPIs de ese momento: valor ARS, USD, CCL, posiciones
- Tabla de posiciones con todos los datos
- Panel de distribución

#### Assets (`/assets`)
- Catálogo de CEDEARs con su ratio de conversión
- Permite agregar, editar y eliminar activos de referencia
- El ratio se usa para validar y enriquecer los cálculos en USD

---

## Reglas del sistema

| Regla | Descripción |
|---|---|
| Snapshots inmutables | Una vez importado, un snapshot no puede modificarse ni sobreescribirse |
| Una fecha, un snapshot | No pueden existir dos snapshots para la misma fecha |
| Datos históricos preservados | El historial nunca se modifica; los nuevos snapshots se agregan al final |
| Fuente única de datos | Todo el historial proviene de CSV exportados de Cocos Capital |

---

## Ciclo de vida del dato

```
Cocos Capital
     │
     │  Exportar CSV
     ▼
Archivo CSV local
     │
     │  Importar CSV en la plataforma
     ▼
PortfolioSnapshot (inmutable)
     │
     ├── Positions (posiciones del snapshot)
     │
     ▼
Dashboard / Performance / Snapshots
(lectura y visualización)
```

---

## Frecuencia sugerida

| Frecuencia | Acción |
|---|---|
| **Mensual** | Exportar e importar un snapshot nuevo para registrar el estado del mes |
| **Semestral** | Revisar la página de Performance para evaluar el crecimiento del portfolio |
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
