# ADR-0017: Cache Components, Partial Prerendering y Partial Prefetching

- **Estado:** Aceptado (adopción incremental en curso)
- **Fecha:** 2026-10-04
- **Relacionados:** reemplaza a ADR-0010; ADR-0002, ADR-0006, ADR-0008, ADR-0009

## Contexto

Todas las páginas de `(app)` leen la sesión (directamente o a través de `lib/*-data.ts` y las actions con `requireUserId()`), y el layout de `(app)` la lee para decidir si el usuario es admin. En el modelo anterior eso volvía dinámica a toda la zona autenticada: cada navegación esperaba al servidor antes de mostrar nada, incluso el sidebar y los headers, que son iguales para todos. ADR-0010 había decidido no usar caché de datos de Next y revalidar rutas con `revalidatePath`.

Next.js 16 ofrece **Cache Components** (`cacheComponents: true`), que trae **Partial Prerendering (PPR)**: cada ruta produce un *static shell* (HTML + payload RSC) que se sirve al instante, y lo que depende del request o de datos sin cachear se streamea detrás de `<Suspense>`. Desde 16.3 se suma **Partial Prefetching** (`partialPrefetching: true`): el router prefetchea un *App Shell* por ruta (incluye datos de sesión, cacheado por sesión en el cliente), así las navegaciones también son instantáneas.

## Decisión

1. **Activamos Cache Components** (Next 16.3.8). PPR viene incluido; no hay flag aparte.
2. **Adopción incremental**, como recomienda la guía oficial y la skill `next-cache-components-adoption`:
   - Pre-paso: codemod `cache-components-instant-false` (marca cada page/layout con `export const instant = false` y un `// TODO: Cache Components adoption`), migración de configs incompatibles y build en verde. La app se comporta igual que antes.
   - Después, **una feature por PR**: se quita el opt-out, se resuelven las validaciones (en dev vía overlay o MCP `get_errors`) y se verifica que el shell estático se vea primero.
3. **Patrón de autenticación** (guía *Authentication with Cache Components*):
   - La sesión se lee **dentro de `<Suspense>`**, nunca en el top-level de un layout. El layout de `(app)` pasa a renderizar el chrome estático y streamear lo que depende del rol.
   - Lecturas de sesión con lifetime: `'use cache: private'` (cachea solo en el navegador, permite prefetch).
   - Datos derivados del usuario: el getter exportado resuelve el usuario y pasa **solo el `userId`** a una función interna (no exportada) con `'use cache'` + `cacheLife` + `cacheTag(\`<dominio>:${userId}\`)`.
4. **Datos de mercado globales** (CCL, precios, benchmarks, índices, catálogo de assets): `'use cache'` + `cacheLife` acorde a su frecuencia + `cacheTag('<dominio>')`. Las actions de refresco invalidan su tag.
5. **Invalidación por tags**: `lib/revalidate.ts` pasa de `revalidatePath` a `updateTag` por dominio (read-your-own-writes en Server Actions). En Route Handlers, `revalidateTag(tag, 'max')`.
6. **Partial Prefetching** se activa (`partialPrefetching: true`) cuando las rutas principales tengan su shell, siguiendo la skill `next-partial-prefetching-adoption`. `<Link prefetch={true}>` solo donde una ruta depende de `params`/`searchParams` y el costo de una invocación por link se justifica (p. ej. `/snapshots/[id]`).

## Alternativas

- **Mantener el modelo anterior (ADR-0010):** simple, pero toda navegación autenticada espera al servidor.
- **Adopción directa (todo en una PR):** más rápida, pero una PR enorme que toca todas las rutas a la vez y es difícil de revisar y de revertir.
- **`'use cache: remote'` / cache handler durable:** mejor hit rate en serverless, pero agrega infraestructura y latencia de red. Con pocos usuarios no se justifica todavía; se puede sumar por función si hace falta.
- **Cachear datos de usuario con `'use cache: private'` en lugar de `userId` + tags:** no permite invalidar desde el servidor con `updateTag`; queda para lecturas de sesión.

## Consecuencias

**Positivas**

- El chrome (sidebar, headers, skeletons) se sirve como shell estático: carga y navegación instantáneas.
- El caché queda explícito en el código (`'use cache'`, `cacheLife`, `cacheTag`) y se invalida por dominio.
- La validación en dev avisa cuando una ruta deja de ser instantánea.

**Negativas / costos**

- Más estructura: componentes async detrás de `<Suspense>` en lugar de un `await` al principio de la página.
- `'use cache'` guarda en memoria por instancia: en Vercel serverless el hit rate del servidor es bajo; el beneficio principal es el shell y el prefetch en el cliente.
- Las claves y tags del caché se guardan en texto plano.
- Con Cache Components, el estado de los componentes **se preserva entre navegaciones** (`<Activity>`): formularios y diálogos pueden necesitar reset explícito.
- Durante la adopción conviven rutas convertidas y rutas con `instant = false`.

**Reglas para el código**

- No leer `cookies()`, `headers()`, la sesión, `params` ni `searchParams` en el top-level de un layout o página: pasarlo a un componente dentro de `<Suspense>`.
- Nunca leer `cookies()`/`headers()` dentro de un `'use cache'` plano: resolver el usuario afuera y pasar el `userId`, o usar `'use cache: private'`.
- Claves y tags por `userId` (estable); nunca emails, tokens ni datos sensibles.
- Las funciones cacheadas que reciben `userId` no se exportan: el getter exportado resuelve el usuario de la sesión (evita leer datos de otro usuario pasando otro id).
- Todo `'use cache'` lleva su `cacheLife`; si se baja `stale` de 30 s, el contenido sale del prefetch.
- `new Date()`, `Date.now()`, `Math.random()` en el render: después de un dato de request, o con `connection()` dentro de `<Suspense>`.
- No usar `export const dynamic`, `revalidate`, `fetchCache`, `dynamicParams` ni `runtime` (no son compatibles).
- Al quitar un `instant = false`, borrar también su `TODO: Cache Components adoption`. Si se deja a propósito, reemplazar el TODO por el motivo.
- Cada función cacheada declara un tag por cada dominio que lee (`lib/cache-tags.ts`) y cada escritura invalida solo el suyo (`lib/revalidate.ts`), así ninguna lista de rutas queda desactualizada.
- Las lecturas sin datos de request (datos de mercado globales) llaman a `connection()` antes del `'use cache'`: si no, Next las ejecuta en `next build` contra la base (que en CI no existe) y congela el resultado en el shell del deploy.

## Referencias

- `next.config.ts`; guías en `node_modules/next/dist/docs/01-app/02-guides/`: `migrating-to-cache-components.md`, `authentication-with-cache-components.md`, `instant-navigation.md`, `adopting-partial-prefetching.md`.
- Skills oficiales: `next-cache-components-adoption`, `next-partial-prefetching-adoption`, `next-dev-loop` (repo `vercel/next.js`, carpeta `skills/`).
- MCP: `.mcp.json` (`next-devtools-mcp`).
