# UX Plan — Recorrido completo — 2026-10-04

Origen: [audits/2026-10-04-recorrido.md](../audits/2026-10-04-recorrido.md). Propuestas
P-01..P-05 aprobadas el 2026-10-04. Decisiones: D1 = sí, los `USER` son un caso real
(el checklist respeta el rol); D2 = sí, un snapshot se puede eliminar y reimportar
(ya permitido por ADR-0004, faltaba la UI).

## Target interface

### Screen: Checklist / Wizard (FLW-02, SCR-04, SCR-16)
- Para rol USER el paso Assets es informativo ("lo mantiene el administrador"), no
  requerido, sin CTA y fuera del conteo. Para ADMIN no cambia.
- "Más tarde" cierra el wizard por la sesión del navegador; "Omitir" pasa a
  "No mostrar más". Bienvenida sin cantidad fija de tipos de datos.
- En `/datos` el ítem "Importar snapshot" abre el sheet (como en el dashboard).

### Screen: Importar snapshot (FLW-03, SCR-05)
- La fecha duplicada se avisa al elegirla (paso 1) y bloquea "Previsualizar".
- El autocompletado de CCL tiene su propio indicador (no "Analizando…").
- `done` muestra total y posiciones, y como acción primaria el siguiente paso
  pendiente del checklist (o "Ver dashboard").

### Screen: Snapshot detalle (SCR-07)
- "Eliminar snapshot" con AlertDialog que nombra fecha y cantidad de posiciones.

### Screens: Login (SCR-01), Transacciones (SCR-15), Configuración (SCR-21), Rebalanceo (SCR-08), Estrategia (SCR-20)
- "Registrate" sólo si el signup está abierto. El login vuelve a la ruta pedida.
- Errores de import de movimientos inline y persistentes.
- Borrar hito / objetivo: toast con "Deshacer".
- Restaurar estrategia refresca la vista sola.

### Screens: Performance, CCL, Snapshots, Análisis, Centro de Datos
- Header de CCL: "Actualizar CCL" en lugar de "Importar CSV"; Performance sin
  acción de import en el header con datos.
- Snapshots: un solo botón de import; valor visible en mobile.
- Links a rutas admin ocultos para USER (Análisis, `/datos` → Hitos).
- `/datos` sección 3 bloqueada: CTA a lo que falta.

## Changes

| Op | Archivo | Traza |
|----|---------|-------|
| MODIFY | lib/setup-status.ts (+ test) | F-01 / P-01 |
| MODIFY | app/actions/setup.ts | F-01 / P-01 |
| MODIFY | components/setup/setup-checklist.tsx, welcome-wizard.tsx, setup-panel.tsx | F-01, F-02, F-13, F-14 / P-01, P-02 |
| MODIFY | app/(app)/datos/page.tsx | F-01, F-12, F-14 |
| MODIFY | app/(app)/analysis/page.tsx | F-01 |
| MODIFY | app/actions/snapshots.ts | F-04, F-05 / P-03, P-04 |
| MODIFY | components/snapshots/import-csv-sheet.tsx | F-04, F-05, F-16 |
| CREATE | components/snapshots/delete-snapshot-button.tsx | F-03 / P-04 |
| MODIFY | app/(app)/snapshots/[id]/page.tsx, snapshots/page.tsx | F-03, F-15, F-17 |
| MODIFY | proxy.ts, app/(auth)/login/* | F-07, F-08 / P-05 |
| MODIFY | components/transactions/import-movements-button.tsx | F-06 / P-05 |
| MODIFY | components/settings/milestones-client.tsx, components/rebalance/rebalance-client.tsx | F-10 / P-05 |
| MODIFY | components/strategy/strategy-editor.tsx | F-11 / P-05 |
| MODIFY | app/(app)/ccl/page.tsx, performance/page.tsx | F-09 |

## Execution order
1. P-01 (lógica pura + test) → 2. P-02 → 3. P-03/P-04 → 4. P-05 → 5. F-09/F-15/F-17 → lint, test, build → actualizar flows.md/screens.md.

## Definition of done
Todas las filas aplicadas, `npm run lint`, `npm test` y `npm run build` en verde,
`flows.md`/`screens.md` actualizados en el mismo cambio, audit re-ejecutada sobre los findings.
