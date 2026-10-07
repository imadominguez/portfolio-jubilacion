# DESIGN.md — Sistema de diseño "Azure Tech"

Sistema de diseño de **Portfolio Jubilación**: dark-first, técnico y financiero, construido sobre
Tailwind v4 + shadcn/ui (`radix-nova`) con tokens semánticos en oklch.

> Este documento es la **fuente de verdad** de la capa visual. Todo color, radio, sombra o
> tipografía nueva debe salir de un token definido acá. No se permiten colores crudos de la
> paleta de Tailwind (`text-emerald-500`, `bg-amber-500/10`, etc.) en componentes de dominio.

---

## 1. Principios

1. **Dark-first.** El tema por defecto es oscuro. El claro debe existir con la misma jerarquía,
   no como un afterthought.
2. **Un solo acento eléctrico.** Azul eléctrico (`primary`) + cian (`accent`) como firma. Todo lo
   demás es superficie, texto o semántica.
3. **Semántica financiera explícita.** Verde = ganancia, rojo = pérdida, ámbar = atención. Siempre
   vía `success` / `destructive` / `warning`, nunca hardcodeado.
4. **Profundidad por capas, no por sombras pesadas.** La elevación se logra con superficies
   escalonadas + bordes + un glow sutil.
5. **Datos primero.** Números en `font-mono` con `tabular-nums`; la UI se aparta y deja hablar a
   los datos.
6. **Cero ruido.** Sin gradientes multicolor aleatorios. Gradientes y glows azulados, con
   intención.

---

## 2. Color

Todos los tokens viven en `app/globals.css` (`:root` = claro, `.dark` = oscuro) y se exponen a
Tailwind vía `@theme inline`.

### 2.1 Marca

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--primary` | `oklch(0.65 0.19 252)` | `oklch(0.55 0.20 255)` | Azul eléctrico: CTAs, links, foco, series 1 |
| `--primary-foreground` | `oklch(0.99 0.005 250)` | `oklch(1 0 0)` | Texto sobre primary |
| `--accent` | `oklch(0.72 0.14 205)` | `oklch(0.95 0.03 225)` | Cian: highlights, hovers, glows |
| `--accent-foreground` | `oklch(0.16 0.03 240)` | `oklch(0.32 0.10 255)` | Texto sobre accent |

### 2.2 Superficies (dark)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.145 0.020 260)` | Fondo de app (navy profundo) |
| `--card` | `oklch(0.190 0.024 260)` | Tarjetas, paneles |
| `--popover` | `oklch(0.220 0.028 260)` | Elevación 2: menús, popovers, dialogs |
| `--muted` | `oklch(0.235 0.022 260)` | Rellenos neutros, tracks de progreso |
| `--secondary` | `oklch(0.240 0.026 260)` | Botones secundarios |
| `--border` | `oklch(0.300 0.028 260)` | Bordes |
| `--input` | `oklch(0.320 0.028 260)` | Bordes de inputs |
| `--sidebar` | `oklch(0.165 0.022 262)` | Fondo del sidebar (más oscuro que background) |

### 2.3 Superficies (light)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.985 0.004 250)` | Fondo |
| `--card` | `oklch(1 0 0)` | Tarjetas |
| `--popover` | `oklch(1 0 0)` | Popovers |
| `--muted` | `oklch(0.965 0.006 250)` | Rellenos |
| `--secondary` | `oklch(0.960 0.008 250)` | Secundarios |
| `--border` / `--input` | `oklch(0.900 0.010 250)` | Bordes |
| `--sidebar` | `oklch(0.975 0.006 250)` | Sidebar |

### 2.4 Semántica

| Token | Dark | Light | Significado |
|---|---|---|---|
| `--success` | `oklch(0.72 0.16 158)` | `oklch(0.55 0.15 158)` | Ganancia, objetivo alcanzado |
| `--success-foreground` | `oklch(0.15 0.02 160)` | `oklch(1 0 0)` | Texto sobre success |
| `--destructive` | `oklch(0.64 0.21 25)` | `oklch(0.58 0.21 25)` | Pérdida, error, eliminar |
| `--destructive-foreground` | `oklch(0.99 0.005 250)` | `oklch(1 0 0)` | Texto sobre destructive |
| `--warning` | `oklch(0.80 0.15 82)` | `oklch(0.68 0.15 75)` | Atención, desbalance |
| `--warning-foreground` | `oklch(0.20 0.03 82)` | `oklch(0.22 0.03 80)` | Texto sobre warning |
| `--info` | `oklch(0.72 0.13 230)` | `oklch(0.55 0.14 232)` | Informativo, neutral+ |
| `--info-foreground` | `oklch(0.15 0.02 230)` | `oklch(1 0 0)` | Texto sobre info |

**Aliases de finanzas:** `--positive` = `--success`, `--negative` = `--destructive`. Se exponen
como `text-positive` / `text-negative` para leer intención en el código (P&L, rendimiento, Δ%).

### 2.5 Paleta de charts

Series distinguibles entre sí, siempre dentro de la familia azul/cian con acentos.

| Token | Dark | Light | Serie |
|---|---|---|---|
| `--chart-1` | `oklch(0.65 0.19 252)` | `oklch(0.55 0.20 255)` | Azul (marca) |
| `--chart-2` | `oklch(0.75 0.14 205)` | `oklch(0.62 0.13 205)` | Cian |
| `--chart-3` | `oklch(0.72 0.16 158)` | `oklch(0.58 0.15 158)` | Esmeralda |
| `--chart-4` | `oklch(0.68 0.18 295)` | `oklch(0.55 0.20 295)` | Violeta |
| `--chart-5` | `oklch(0.80 0.15 82)` | `oklch(0.70 0.15 75)` | Ámbar |

### 2.6 Reglas de uso

- **Ganancia/pérdida:** `text-success` / `text-destructive`. Fondos: `bg-success/10`.
- **Atención:** `text-warning` / `bg-warning/10`.
- **Informativo:** `text-info` / `bg-info/10`.
- **Acentos de categoría** (iconos de herramientas, sectores): usar `primary`, `chart-4`
  (violeta), `chart-2` (cian) — nunca hex sueltos.
- **Texto secundario:** `text-muted-foreground`. Nunca `text-slate-400`.
- **Nunca** usar `emerald`, `green`, `amber`, `red`, `blue`, `violet`, `slate` de Tailwind en
  componentes; siempre los tokens anteriores.

---

## 3. Tipografía

| Rol | Token | Familia | Notas |
|---|---|---|---|
| UI / body | `--font-sans` | **Plus Jakarta Sans** | Cargada en `app/layout.tsx` |
| Datos / números | `--font-mono` | **JetBrains Mono** | Pesos 400/500/600 |

> El `--font-sans` de `globals.css` **debe** declarar `Plus Jakarta Sans` (no `Inter`). Next/font
> inyecta la variable en `<body>`.

### Escala

| Rol | Clases |
|---|---|
| Hero / valor total | `text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight` |
| Título de página | `text-base font-semibold` |
| KPI / métrica | `text-xl font-bold` |
| Body | `text-sm` |
| Meta / descripción | `text-xs text-muted-foreground` |
| Label de sección | `text-[10px]–[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground` |

Los números siempre llevan `font-mono tabular-nums`.

---

## 4. Radios, sombras y efectos

- **Radio base:** `--radius: 0.75rem` (12px). Derivados: `sm = radius - 4px`, `md = radius - 2px`,
  `lg = radius`, `xl = radius + 4px`, `2xl/3xl/4xl` escalados.
- **Sombras:** tintadas de azul (`oklch(0.12 0.05 260 / α)`), escala `--shadow-2xs … 2xl`, más
  sutiles que las legacy. En dark casi no se usan; la elevación la dan las superficies.
- **Utilidades de ambiente** (definidas en `globals.css`):
  - `.glass` — superficie translúcida + `backdrop-blur` + borde suave.
  - `.glow-primary` — halo azul (`box-shadow`) para elementos activos/foco.
  - `.text-gradient` — gradiente azul→cian para títulos hero.
  - `.grid-bg` — grilla técnica sutil de fondo.
  - `.noise-bg` — textura de grano sutil.

---

## 5. Movimiento

| Utilidad | Duración / curva | Uso |
|---|---|---|
| `.animate-fade-up` | 0.4s `cubic-bezier(0.16,1,0.3,1)` | Entrada de secciones (con `animationDelay` escalonado) |
| `.animate-fade-in` | 0.25s ease | Apariciones simples |
| `.animate-tour-card-in` | 0.4s | Card del tour |
| `.animate-guide-stagger` | 0.55s | Stagger de la guía |

- Transiciones de hover/estado: `duration-150` o `duration-200`.
- Respetar `prefers-reduced-motion` (las animaciones son decorativas y cortas).

---

## 6. Componentes

### 6.1 Hero (DashboardHero)
Tarjeta oscura con gradiente azul profundo (`from-primary/25` → transparente), glow cian en la
esquina, valor en `text-gradient`, badge de ganancia con `bg-success/20` / `bg-destructive/20`.
Prohibido oklch crudo.

### 6.2 Sidebar / AppSidebar
- Fondo `bg-sidebar`.
- Item activo: `.sidebar-active-item` reconstruido con tokens (`--primary/15`, borde
  `--primary/30`, texto `--sidebar-foreground`, acento `--accent`), con glow azul sutil.
- Item inactivo: `text-sidebar-foreground/60`, hover `bg-sidebar-accent/50`.
- Logo "PJ": cuadrado `bg-primary` + `ring-primary/35`.

### 6.3 SiteHeader
Sticky, `bg-background/80 backdrop-blur-xl`, borde inferior `border-border`.

### 6.4 KPI / métricas
`rounded-xl border border-border bg-card shadow-sm px-5 py-4`; valor en `font-mono` con color
según semántica; punto de estado `bg-success` / `bg-warning` / `bg-destructive` /
`bg-muted-foreground/40`.

### 6.5 Badges y pills
- Base: `shadcn badge` con tokens.
- Interpretativos: `bg-{success|warning|destructive|info}/10 text-{...}`.
- Nunca `bg-emerald-100 text-emerald-800`.

### 6.6 Charts (Recharts)
- Colores desde `var(--color-chart-N)`; prohibidos hex.
- Tooltip: `bg-card`, `border-border`, `rounded-lg`, texto `font-mono text-xs`.
- Grillas/ejes: `text-muted-foreground`, `border-border/50`.

### 6.7 Estados vacíos / loading
Skeletons sobre `bg-card/50 border-border/40`; el loading del dashboard usa el mismo `SiteHeader`
y define `noise-bg`.

### 6.8 Auth
Fondo `background` con `.grid-bg` sutil, card `glass`, logo en `bg-primary/10 ring-primary/20`,
título con `text-gradient`.

### 6.9 PDF export
Acento azul `#1d4ed8` sobre fondo claro, consistente con `--primary` light.

---

## 7. Accesibilidad

- Contraste mínimo AA: texto `foreground` sobre `background`/`card`; `muted-foreground` solo para
  texto secundario.
- Estados nunca solo por color: acompañar con icono o texto.
- Foco visible: `ring-3 ring-ring/50` (ya en primitives).
- No depender del glow para transmitir información.

---

## 8. Checklist de migración

- [x] `globals.css`: paleta azulada light/dark + `success`/`warning`/`info`/`positive`/`negative`,
      charts, sombras, radios, utilidades, `--font-sans`.
- [x] `dashboard-hero.tsx`: sin `oklch(...75)` ni hex; tokens + glow.
- [x] `.sidebar-active-item`: reconstruido con tokens.
- [x] `app-sidebar.tsx`, `site-header.tsx`: tokens y glow.
- [x] Migrar componentes de dominio: `emerald/green → success`, `amber/orange → warning`,
      `red/rose → destructive`, `blue/sky → primary|info`, `violet → chart-4`.
- [x] `concentration-charts.tsx` y charts: solo `--color-chart-*`.
- [x] `export/portfolio-pdf.tsx` + HTML `/api/export/snapshot`: acento azul.
- [x] Auth (`login`, `register`) rediseñados.
- [x] `app/(app)/(dashboard)/loading.tsx` (antes `app/(app)/loading.tsx`): unificado con `SiteHeader` y `noise-bg` definido.
- [x] Accesibilidad: `color-scheme` por tema, `::selection`, `prefers-reduced-motion`.
- [x] `pnpm build` OK. `pnpm lint` sin errores nuevos (los restantes son preexistentes).
