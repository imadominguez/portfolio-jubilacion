---
name: inversion-cedears
description: >
  Skill sobre la estrategia de inversión personal en CEDEARs del usuario.
  Contiene la composición completa de su portafolio de jubilación, los pesos
  objetivo por posición, la lógica de cada sector, las reglas del DCA mensual
  y el contexto argentino relevante. Usar SIEMPRE que el usuario pregunte sobre
  su portafolio, sus CEDEARs, decisiones de compra/venta, rebalanceo, nuevas
  posiciones, dividendos, estrategia de inversión, o cualquier tema relacionado
  con su cartera personal. También usar cuando analice balances de empresas que
  tiene en cartera, compare acciones para agregar, o pida proyecciones de
  crecimiento de su inversión. No esperar a que el usuario diga "mi portafolio"
  explícitamente — cualquier pregunta sobre acciones individuales que figuren en
  la cartera debe consultar esta skill primero.
---

# Estrategia de Inversión Personal en CEDEARs

## Contexto del inversor

- **País**: Argentina (opera desde Olavarría, Buenos Aires)
- **Bróker**: Cocos Capital
- **Instrumento**: CEDEARs (Certificados de Depósito Argentinos — réplicas de acciones del exterior que cotizan en ARS pero siguen el precio en USD vía tipo de cambio CCL)
- **Aporte mensual**: $500.000 ARS/mes (≈ USD 337 al CCL ~$1.483, mayo 2026)
- **Estrategia**: DCA mensual (dollar-cost averaging — monto fijo todos los meses)
- **Horizonte**: 5 años (portafolio de jubilación)
- **Perfil**: Equilibrado — crecimiento + defensa + dividendos
- **Ventaja del CEDEAR**: Cobertura cambiaria natural. Cuando el ARS se devalúa, el valor en pesos sube automáticamente. El usuario lo considera una ventaja, no un riesgo.

---

## Portafolio objetivo — composición completa

### Sector Tecnología / IA — 30% ($150.000 ARS/mes)

| Ticker | Empresa   | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | --------- | ------------- | ------- | ------- | --------- |
| MSFT   | Microsoft | 12%           | $60.000 | ~$40    | ~0.8%     |
| GOOGL  | Alphabet  | 10%           | $50.000 | ~$34    | ~0.5%     |
| NVDA   | NVIDIA    | 8%            | $40.000 | ~$27    | —         |

**Tesis del sector**: Azure y Google Cloud crecen 40-63% anual. La IA es infraestructura, no moda. NVDA provee los chips que entrenan todos los modelos. MSFT tiene el ROIC más alto entre las grandes tecnológicas y actúa como ancla de baja volatilidad.

### Sector Consumo Defensivo — 22% ($110.000 ARS/mes)

| Ticker | Empresa          | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | ---------------- | ------------- | ------- | ------- | --------- |
| WMT    | Walmart          | 8%            | $40.000 | ~$27    | ~1.0%     |
| KO     | Coca-Cola        | 7%            | $35.000 | ~$24    | ~3.1%     |
| PG     | Procter & Gamble | 7%            | $35.000 | ~$24    | ~2.4%     |

**Tesis del sector**: Empresas con beta bajo (0.4–0.6) que caen mucho menos en correcciones de mercado. KO y PG son Dividend Kings con más de 50 años consecutivos aumentando dividendos. WMT combina defensa con crecimiento en e-commerce. Son el "colchón" del portafolio.

### Sector Salud / Farmacéuticas — 14% ($70.000 ARS/mes)

| Ticker | Empresa           | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | ----------------- | ------------- | ------- | ------- | --------- |
| JNJ    | Johnson & Johnson | 7%            | $35.000 | ~$24    | ~3.2%     |
| ABBV   | AbbVie            | 7%            | $35.000 | ~$24    | ~3.6%     |

**Tesis del sector**: Sector defensivo por excelencia — la demanda de salud no baja en recesiones. JNJ es Dividend King. ABBV tiene pipeline robusto post-Humira con Skyrizi como motor de crecimiento.

### Sector Consumo Discrecional — 12% ($60.000 ARS/mes)

| Ticker | Empresa    | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | ---------- | ------------- | ------- | ------- | --------- |
| MCD    | McDonald's | 7%            | $35.000 | ~$24    | ~2.3%     |
| AMZN   | Amazon     | 5%            | $25.000 | ~$17    | —         |

**Tesis**: MCD es más un negocio de real estate que de hamburguesas — cobra royalties sobre miles de franquicias globales, muy predecible. AMZN aporta exposición a AWS (cloud #1) y e-commerce con márgenes crecientes.

### Sector Finanzas — 8% ($40.000 ARS/mes)

| Ticker | Empresa        | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | -------------- | ------------- | ------- | ------- | --------- |
| JPM    | JPMorgan Chase | 8%            | $40.000 | ~$27    | ~2.1%     |

**Tesis**: Banco más sólido de EEUU, diversificado en banca minorista, inversión y gestión de activos. Bien posicionado para entornos de tasas altas.

### Sector LatAm / Emergentes — 7% ($35.000 ARS/mes)

| Ticker | Empresa      | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | ------------ | ------------- | ------- | ------- | --------- |
| MELI   | MercadoLibre | 7%            | $35.000 | ~$24    | —         |

**Tesis**: Amazon + Mercado Pago de América Latina. El usuario tiene ventaja informacional como argentino que entiende el mercado LatAm. Expansión acelerada en Brasil y México.

### ETF Diversificador — 7% ($35.000 ARS/mes)

| Ticker | Instrumento | Peso objetivo | ARS/mes | USD/mes | Dividendo |
| ------ | ----------- | ------------- | ------- | ------- | --------- |
| SPY    | S&P 500 ETF | 7%            | $35.000 | ~$24    | ~1.3%     |

**Tesis**: Red de seguridad amplia. Ya incluye indirectamente todas las acciones de la cartera. Peso reducido desde el 20.9% original para no diluir el potencial de selección individual.

---

## Estado actual del portafolio (snapshot 2 mayo 2026)

**Valor total**: ARS $1.803.225 / USD $1.198,79 | CCL: $1.504,2

| Ticker  | Cantidad | PPM CEDEAR | Precio actual | Valor ARS | Asign. actual | Peso objetivo | Estado       |
| ------- | -------- | ---------- | ------------- | --------- | ------------- | ------------- | ------------ |
| SPY     | 7        | —          | $53.875       | $377.125  | 20.91%        | 7%            | ⚠️ sobrepon. |
| AMD     | 6        | $11.987    | $53.000       | $318.000  | 17.64%        | — (reducir)   | 🔴 sobrepon. |
| AAPL    | 13       | —          | $20.490       | $266.370  | 14.77%        | —             | 📋 revisar   |
| MELI    | 9        | —          | $22.450       | $202.050  | 11.20%        | 7%            | ⚠️ sobrepon. |
| GOOGL   | 20       | $3.558     | $9.875        | $197.500  | 10.95%        | 10%           | 🟡 infrapon. |
| CVX     | 8        | —          | $18.110       | $144.880  | 8.03%         | —             | 📋 revisar   |
| NVDA    | 11       | —          | $12.500       | $137.500  | 7.63%         | 8%            | 🟡 infrapon. |
| META    | 3        | —          | $38.360       | $115.080  | 6.38%         | —             | 📋 revisar   |
| BABA    | 2        | —          | $22.020       | $44.040   | 2.44%         | —             | 📋 revisar   |
| VALO    | 1        | —          | $634,5        | $634,5    | 0.04%         | —             | residual     |
| COCORMA | 4,2      | —          | —             | $45,8     | 0.00%         | —             | residual     |

**Posiciones ausentes del objetivo**: MSFT, WMT, KO, PG, JNJ, ABBV, MCD, JPM — prioridad de incorporación con los aportes mensuales.

---

## Reglas del DCA mensual

1. **Mismo día cada mes** — la consistencia es más importante que el timing perfecto.
2. **Antes de comprar, revisar pesos actuales** de cada posición.
3. **Capital nuevo va a posiciones infraponderadas** respecto al peso objetivo.
4. **No agregar capital a posiciones sobreponderadas** — dejar que se diluyan naturalmente con el crecimiento del portafolio.
5. **Posiciones sobreponderadas hoy** (no reciben aportes): AMD, SPY, MELI.
6. **Prioridad de incorporación** (posiciones ausentes primero): MSFT → WMT → KO → JNJ → PG → ABBV → JPM → MCD.
7. **Los dividendos se reinvierten** (estrategia DRIP) comprando más CEDEARs del mismo ticker o de los más infraponderados.
8. **Rebalanceo anual**: Una vez por año revisar si alguna posición se alejó >5 puntos del objetivo y corregir.

---

## Análisis de posiciones específicas (contexto)

### AMD — situación crítica

- **PPM CEDEAR**: $11.987 → precio actual $53.000 → **+342% de ganancia en CEDEAR**
- **En USD**: desde marzo 2025, +371% de ganancia
- **Decisión pendiente**: Tomar ganancias parciales (vender 3 de 6 CEDEARs) para llevar a ~8-9% del portafolio. El balance del 5/5/2026 era el catalizador clave — la acción ya cotizaba en máximos históricos con precio por encima del target promedio de analistas (~$275 vs precio ~$357).
- **Regla**: Los aportes mensuales NO van a AMD hasta que su peso caiga al objetivo.

### GOOGL — posición sólida para acumular

- **PPM CEDEAR**: $3.558 → precio actual $9.875 → **+177% de ganancia**
- **Balance Q1 2026 (29/4)**: EPS $5.11 vs estimado $2.62 — beat histórico. Google Cloud +63% YoY. La acción subió ~10% al día siguiente.
- **Decisión**: Mantener y acumular. Está infraponderada (10.95% vs objetivo 10%). Los balances confirmaron la tesis.

### SPY — reducir gradualmente

- **Peso actual**: 20.91% → **peso objetivo**: 7%
- **Estrategia**: No vender. Simplemente no asignar nuevos aportes. El SPY se diluye naturalmente a medida que el resto del portafolio crece.

### Posiciones fuera del objetivo (AAPL, CVX, BABA, META)

- **AAPL**: Alta calidad pero perfil de valor más que crecimiento. No forma parte del objetivo definido. No agregar; mantener mientras no haya motivo para rotar.
- **CVX**: Energía — sector no incluido en la estrategia. Evaluar rotación a largo plazo.
- **BABA**: China tech — riesgo regulatorio y geopolítico elevado. Posición pequeña (2.44%), evaluar.
- **META**: Buena empresa (3.000M+ usuarios, IA), actualmente con 6.38%. No está en el portafolio objetivo redefinido pero se puede mantener. Cayó ~9% post-balance del 29/4 por CapEx elevado — oportunidad de acumulación si el usuario quiere.

---

## Sobre los dividendos en CEDEARs

- Se acreditan en **USD MEP o cable** directamente en la cuenta de Cocos Capital.
- No hay que hacer ninguna acción manual — caen automáticamente.
- **Posiciones que pagan**: KO (~3.1%), ABBV (~3.6%), JNJ (~3.2%), PG (~2.4%), MCD (~2.3%), JPM (~2.1%), SPY (~1.3%), WMT (~1.0%), MSFT (~0.8%), GOOGL (~0.5%).
- **Estrategia recomendada**: Reinvertir los dividendos comprando más CEDEARs de las posiciones más infraponderadas ese mes (estrategia DRIP adaptada).

---

## Conceptos clave para recordar en las respuestas

- **CEDEAR**: No es la acción directa — es un certificado que la replica. El precio en ARS se mueve con el precio en USD × CCL.
- **CCL (Contado con Liqui)**: El tipo de cambio que usan los CEDEARs. Actualmente ~$1.483-1.504 (mayo 2026).
- **DCA**: Dollar-cost averaging. Comprar un monto fijo mensual sin importar el precio. Reduce el riesgo de entrar en un pico.
- **Dividend King**: Empresa con más de 50 años consecutivos aumentando dividendos (KO, PG, JNJ).
- **Beta bajo**: Medida de volatilidad relativa al mercado. Beta 0.5 significa que si el mercado cae 10%, la acción tiende a caer ~5%. Ideal para el componente defensivo.
- **DRIP**: Dividend Reinvestment Plan — reinvertir dividendos automáticamente en más acciones.

---

## Instrucciones de uso de esta skill

Cuando el usuario haga preguntas sobre su portafolio o inversiones:

1. **Consultar el estado actual** de la posición en la tabla del snapshot.
2. **Comparar con el peso objetivo** para determinar si está infra o sobreponderada.
3. **Aplicar las reglas del DCA** para recomendar si agregar o no capital ese mes.
4. **Considerar el contexto argentino**: tipo de cambio, impacto de la devaluación, cobro de dividendos en USD.
5. **Para análisis de balances**: buscar si la empresa está en cartera, cuál es su peso actual vs objetivo, y si el resultado del balance cambia la tesis de inversión.
6. **Siempre aclarar** que las recomendaciones son informativas y no constituyen asesoramiento financiero profesional.
