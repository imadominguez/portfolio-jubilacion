# ADR-0010: Sin caché de datos de Next; revalidación centralizada por dominio

- **Estado:** Aceptado
- **Fecha:** 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0002

## Contexto

Las páginas de `(app)` leen la sesión, así que son dinámicas: se renderizan en cada request contra Prisma. Next ofrece además caché de datos (`unstable_cache`, `"use cache"`) y `revalidatePath`/`revalidateTag` para invalidarla.

Antes de esta decisión, cada action llamaba a `revalidatePath` con una lista armada a mano. Con ~15 pantallas que comparten datos (un snapshot nuevo afecta al dashboard, performance, CCL, análisis, rebalanceo, jubilación, hitos, ganancia real y el centro de datos), las listas quedaban incompletas y era fácil olvidar una ruta al agregar una pantalla.

## Decisión

- **No usamos caché de datos de Next.** Todas las lecturas van a Prisma en cada render. Con un solo usuario activo y consultas chicas, la latencia es aceptable y se evita servir datos financieros viejos.
- **Igual revalidamos explícitamente** después de cada mutación, mediante helpers por dominio en `lib/revalidate.ts` (`revalidatePortfolioData`, `revalidateTrades`, `revalidateCcl`, `revalidateSetup`…). Cada helper conoce qué rutas consumen ese dato.
- `getSession()` se envuelve en `React.cache()` para deduplicar la lectura de sesión dentro de un mismo request (el dashboard dispara ~10 lecturas en paralelo).

## Alternativas

- **Caché de datos con tags (`revalidateTag`):** menos consultas a la base, pero cada lectura necesita su tag y su clave por usuario; un error sirve datos de otro usuario o datos viejos. No se justifica con el volumen actual.
- **`revalidatePath` suelto en cada action:** la situación anterior; se desincroniza.
- **No revalidar nada** (confiando en que las páginas son dinámicas): funciona hoy, pero rompe en silencio el día que se agregue caché o una página estática.

## Consecuencias

**Positivas**

- Una sola lista de dependencias por dominio, fácil de auditar.
- Si en el futuro se agrega caché, el contrato de invalidación ya está en su lugar.

**Negativas / costos**

- Cada render pega a la base; no escala a muchos usuarios concurrentes sin agregar caché.
- Hay que acordarse de sumar una ruta nueva al helper del dominio que corresponda.

**Reglas para el código**

- Después de una mutación, llamar al helper de dominio de `lib/revalidate.ts`, no a `revalidatePath` suelto.
- Ruta nueva que muestra datos existentes → agregarla a `PATHS` y a los helpers relevantes.
- No introducir `unstable_cache`/`"use cache"` sin un ADR nuevo que defina claves por usuario.

## Referencias

- `lib/revalidate.ts` (comentario de cabecera), `lib/auth-session.ts`.
- Commits `55bae84`, `55ae462`.
- [`server-actions.md`](../server-actions.md#revalidación-librevalidatets).
