<!-- Managed with super-ux (ux-contract v4). The design map: every screen and
state with its Figma frame, wireframe, code coverage, and resources. Update in
the same change as any interface change; when Figma is enabled, update the
frame too. -->

# Mapa de pantallas — Portfolio Jubilación

> Reconstruido en modo Reverse (2026-10-04). Sin Figma: la columna queda vacía y
> se registra como gap de diseño, no como bloqueo.

## Index

| ID | Pantalla | Usado por | Figma | Status | Coverage |
|----|----------|-----------|-------|--------|----------|
| SCR-01 | Login | FLW-01 | — | built | app/(auth)/login/login-form.tsx |
| SCR-02 | Registro | FLW-01 | — | built | app/(auth)/register/register-form.tsx |
| SCR-03 | Dashboard | FLW-01, 02, 03, 06 | — | built | app/(app)/(dashboard)/page.tsx |
| SCR-04 | Wizard de bienvenida | FLW-02 | — | built | components/setup/welcome-wizard.tsx |
| SCR-05 | Importar snapshot (sheet) | FLW-02, 03 | — | built | components/snapshots/import-csv-sheet.tsx |
| SCR-06 | Snapshots (lista) | FLW-03 | — | built | app/(app)/snapshots/page.tsx |
| SCR-07 | Snapshot detalle | FLW-03 | — | built | app/(app)/snapshots/[id]/page.tsx |
| SCR-08 | Rebalanceo | FLW-02, 06 | — | built | app/(app)/rebalance/page.tsx |
| SCR-09 | Plan DCA | FLW-06 | — | built | app/(app)/plan/page.tsx |
| SCR-10 | Ganancia real | FLW-02, 05 | — | built | app/(app)/real-gains/page.tsx |
| SCR-11 | Análisis (concentración) | FLW-06 | — | built | app/(app)/analysis/page.tsx |
| SCR-12 | Assets (admin) | FLW-02, 08 | — | built | app/(app)/assets/page.tsx |
| SCR-13 | Performance | FLW-03 | — | built | app/(app)/performance/page.tsx |
| SCR-14 | Historial CCL | FLW-05 | — | built | app/(app)/ccl/page.tsx |
| SCR-15 | Transacciones (+ dialog import) | FLW-02, 04 | — | built | app/(app)/transactions/page.tsx |
| SCR-16 | Centro de Datos | FLW-02, 03, 04, 05 | — | built | app/(app)/datos/page.tsx |
| SCR-17 | Jubilación | FLW-06 | — | built | app/(app)/retirement/page.tsx |
| SCR-18 | Guía Cocos | FLW-02, 03 | — | built | app/(app)/guia/page.tsx |
| SCR-19 | Reporte mensual IA (admin) | FLW-07 | — | built | app/(app)/portfolio/page.tsx |
| SCR-20 | Estrategia (admin) | FLW-08 | — | built | app/(app)/strategy/page.tsx |
| SCR-21 | Configuración / hitos (admin) | FLW-08 | — | built | app/(app)/settings/page.tsx |

## Design system
- **Style pack:** none — tokens propios del proyecto (ver `DESIGN.md`)
- **Figma library:** none
- **Tokens in code:** `app/globals.css` (Tailwind v4 + variables shadcn)
- **Component source:** `components/ui/` (shadcn), `components/<dominio>/`
- **Assets:** `public/` (la Guía Cocos usa esquemas dibujados en `components/guide/cocos-mockup.tsx`, sin capturas)

## Web surfaces
- **Web surfaces:** no

## Screens (sólo estados relevantes al recorrido)

> Actualizado 2026-10-04 tras aplicar [plans/2026-10-04-recorrido.md](plans/2026-10-04-recorrido.md).

### SCR-01: Login
- **States:** idle · loading ("Ingresando...") · error inline · success → ruta `next` (sólo rutas internas) o `/`
- **Elements:** email, contraseña, **Ingresar** (primaria), "Registrate" sólo si el signup está abierto.

### SCR-03: Dashboard
- **Purpose:** ver el valor actual y si voy bien
- **Primary action:** Importar CSV (header). Se repite al pie ("Actualizar portfolio") a propósito: es una página larga y el header queda fuera de vista al terminar de leerla.
- **States:**
  | State | Trigger | Behavior |
  |-------|---------|----------|
  | loading | navegación | `loading.tsx` skeleton |
  | empty — first use | sin snapshot | SetupPanel (wizard) + EmptyDashboard con CTA y link a Guía |
  | success | ≥1 snapshot | hero, KPIs, gráfico, herramientas, performers (si hay previo), checklist si falta algo, tabla, hitos, bloque "Actualizar" |
  | partial | sin CCL / sin PPM | KPIs muestran "—" |
  | error | excepción | `(app)/error.tsx` |

### SCR-04: Wizard de bienvenida
- **States:** 7 pantallas (bienvenida, snapshot, assets, movimientos, históricos, objetivos, fin); cada paso con "completo / pendiente"; para USER el paso assets muestra la descripción informativa y no tiene botón.
- **Acciones:** Anterior · No mostrar más · Más tarde (posterga por la sesión del navegador; cerrar con X/Escape hace lo mismo) · Siguiente / Finalizar.

### SCR-05: Importar snapshot
- **States:** select · verificando fecha/CCL ("Verificando fecha...") · fecha duplicada (inline en el campo, Previsualizar deshabilitado) · preview · preview bloqueado (USD sin CCL) · error · done
- **done:** total ARS importado, N posiciones, "Siguiente paso" con CTA primaria (o "Ver dashboard"), "Importar otro snapshot", "Cerrar".

### SCR-06: Snapshots
- **States:** empty (texto que apunta al botón del header) · success (lista)
- **Elements:** un único "Importar CSV" (header). En mobile cada fila muestra valor ARS/USD.

### SCR-07: Snapshot detalle
- **Elements:** Volver a snapshots · Exportar (header) · **Eliminar snapshot** (secundaria, destructiva).
- **States extra:** confirmación (fecha + N posiciones, "Conservar snapshot" / "Eliminar snapshot") · eliminando · error dentro del diálogo · éxito → `/snapshots` + toast.
- **Coverage:** `components/snapshots/delete-snapshot-button.tsx`

### SCR-08: Rebalanceo
- **Borrar objetivo:** se oculta al instante (total recalculado), toast con "Deshacer" 8 s, después se borra en el servidor; si falla, reaparece con error.

### SCR-12: Assets
- **Status nota:** admin-only. Ya no hay CTAs hacia acá para rol USER (checklist, wizard, Análisis, Ganancia Real).

### SCR-13: Performance
- **Header:** sin acción. El empty state tiene "Importar CSV" en el cuerpo.

### SCR-14: Historial CCL
- **Header:** "Actualizar CCL" (con datos). Empty state: "Actualizar CCL" en el cuerpo.

### SCR-15: Transacciones
- **Import de movimientos:** errores de lectura como alerta inline persistente bajo el botón (cerrable); errores al guardar dentro del diálogo, conservando la selección.

### SCR-16: Centro de Datos
- Checklist con el mismo comportamiento que el dashboard (abre el sheet de snapshot), sin wizard.
- Sección 3 bloqueada: CTA a lo que falta (importar snapshot o movimientos).
- "Hitos" sólo visible para ADMIN.

### SCR-20: Estrategia
- Restaurar versión actualiza el editor con el contenido restaurado; sin "Recargá".

### SCR-21: Configuración / hitos
- **Borrar hito:** se oculta al instante, toast con "Deshacer" 8 s, después se borra en el servidor (conserva `reachedAt` si se deshace).
