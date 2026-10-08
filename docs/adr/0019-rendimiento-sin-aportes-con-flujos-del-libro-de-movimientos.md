# ADR-0019: Rendimiento sin aportes, con los flujos del libro de movimientos

- **Estado:** Aceptado
- **Fecha:** 2026-10-08
- **Relacionados:** ADR-0004, ADR-0012, ADR-0015, ADR-0016

## Contexto

Todas las métricas de rendimiento comparaban valores de snapshots: CAGR, rendimiento del año, variación contra el snapshot anterior, CAGR histórico en USD de Jubilación, drawdown y los gráficos normalizados contra benchmarks e inflación. El portfolio crece por dos motivos, el mercado y los aportes, y comparar valores mezcla los dos. Con aportes mensuales (unos 1,35 M ARS por mes, depositados y estacionados en el FCI COCORMA), la app mostraba un CAGR de +241,7 % donde el rendimiento real de las inversiones ronda el 47–49 % anual. Ese número además alimentaba la proyección de Jubilación (con tope de 30 %) y sobreestimaba el capital futuro.

El libro de movimientos (ADR-0012) ya tiene cada compra, venta, suscripción y rescate del FCI y cada dividendo, con fecha y monto.

## Decisión

Medimos el rendimiento **descontando los flujos que entran y salen de las tenencias**, con los movimientos importados de Cocos. La lógica es pura y está en `lib/flow-returns.ts` (con tests); `getHoldingsFlows()` (`lib/portfolio-data.ts`) arma los flujos del usuario.

- **Qué se mide:** las tenencias, o sea todo lo que figura en el snapshot (CEDEARs, bonos y el FCI). El efectivo de la cuenta no está en el snapshot, así que queda afuera.
- **Flujos:** `TRADE_BUY`, `TRADE_SELL`, `FCI_SUBSCRIPTION`, `FCI_REDEMPTION`, `DIVIDEND`, `DIVIDEND_IN_KIND` y `OTHER` con instrumento (bonos para dólar MEP). `PAYMENT`, `RECEIPT` y `CONVERSION` mueven efectivo y se excluyen. Los flujos en USD se pasan a ARS con el CCL de su fecha (nunca el de hoy, ADR-0004); la versión en USD divide cada flujo en ARS por el CCL de su fecha.
- **Por período** (entre snapshots consecutivos): Dietz modificado, con los flujos de `(inicio, fin]` ponderados por el tiempo que estuvieron invertidos.
- **Acumulado:** TWR, encadenando los períodos en un índice base 100. Lo usan el rendimiento del año, el drawdown y los gráficos contra benchmarks e inflación.
- **Anual:** TIR (XIRR por bisección) con el primer valor como aporte, los flujos intermedios y el último valor como retiro. Es el KPI "TIR anual" de `/performance` (y la base de "TIR real") y, en USD, la tasa histórica de Jubilación.
- **Ganancia en pesos:** `V_fin − V_inicio − aportes netos del período`.
- **Cobertura:** si el último movimiento importado es anterior al último snapshot (o no hay movimientos), `/performance` avisa: sin esos movimientos, una venta o un rescate del FCI se lee como pérdida.

## Alternativas

- **Solo TWR:** es lo que publica un fondo y no depende de cuándo aportó el inversor. Lo usamos para los períodos y los gráficos, pero la tasa anual del inversor es la TIR: la de Jubilación tiene que reflejar el resultado de su propio calendario de aportes.
- **Medir la cuenta entera (con depósitos y pagos como flujos):** los `PAYMENT` son gastos pagados con rescates del FCI y el efectivo no figura en el snapshot; el borde quedaría inconsistente.
- **Pedir los aportes a mano:** duplica un dato que ya está en el libro de movimientos.
- **Seguir con el CAGR por valor y aclararlo en la UI:** el número seguiría siendo engañoso y alimentando la proyección de Jubilación.

## Consecuencias

**Positivas**

- Las métricas responden "cuánto rindió lo invertido", que es lo que se quiere comparar contra benchmarks e inflación.
- Validado con los datos reales: TWR +100,6 % (48,8 % anual) y TIR 47,3 % anual, frente al +241,7 % del CAGR por valor.

**Negativas / costos**

- Las métricas dependen de que los movimientos estén importados hasta la fecha del último snapshot; si faltan, el período queda mal medido (de ahí el aviso).
- Dietz modificado aproxima el rendimiento dentro del período; con snapshots mensuales el error es chico.
- Un período sin base positiva (`V_inicio + aportes ponderados ≤ 0`) corta la cadena del índice: desde ahí el TWR es "—".

**Reglas para el código**

- Toda métrica de rendimiento nueva usa `lib/flow-returns.ts`; `pctChange` / `cagrPct` quedan para precios y variaciones que no tienen aportes (señales del reporte, CCL).
- Si se agrega una categoría al libro de movimientos, decidir si cruza el borde de las tenencias y actualizar `HOLDINGS_FLOW_CATEGORIES` y sus tests.
- `getHoldingsFlows` invalida con `userTags.trades` (movimientos) y `marketTags.ccl`; si cambia dónde se escriben los movimientos, mantener esos tags.

## Referencias

- `lib/flow-returns.ts`, `lib/flow-returns.test.ts`, `lib/portfolio-data.ts` (`getHoldingsFlows`).
- `app/(app)/performance/page.tsx`, `app/(app)/(dashboard)/page.tsx`, `app/(app)/retirement/page.tsx`, `app/(app)/snapshots/page.tsx`.
- [logica-financiera.md](../logica-financiera.md#performance-histórica-appappperformancepagetsx).
