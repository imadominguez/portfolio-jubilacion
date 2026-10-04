# ADR-0002: RSC para lecturas, Server Actions para mutaciones; API routes solo para binarios e IA

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0010, ADR-0016

## Contexto

La app es un dashboard privado con muchas pantallas de solo lectura (KPIs, gráficos, tablas) y pocas mutaciones (importar un CSV, cargar una transacción, editar un objetivo). No hay clientes externos (mobile, terceros) que necesiten una API pública. Next.js App Router ofrece tres formas de mover datos: React Server Components, Server Actions y Route Handlers (`app/api/`).

## Decisión

- **Lecturas:** las páginas (`app/(app)/**/page.tsx`) son Server Components async que leen la base directamente (vía `lib/*-data.ts` o actions de lectura) y pasan los datos como props a componentes cliente. No hay fetch de datos desde el cliente ni store global de datos del servidor.
- **Mutaciones:** siempre por Server Actions en `app/actions/<dominio>.ts`, un archivo por dominio. Devuelven una unión discriminada `{ success: true, ... } | { success: false, error: string }` y nunca lanzan hacia el cliente.
- **API routes:** solo cuando la respuesta no es un render de React: binarios o archivos (PDF, CSV, HTML imprimible), el handler de Better Auth y el análisis con IA (`POST /api/analyze-portfolio`: recibe un PDF por `multipart/form-data`, puede tardar minutos y el cliente necesita cancelarlo con `AbortController`).

## Alternativas

- **API REST + fetch desde el cliente (SWR/React Query):** duplica tipos y validación, y agrega estados de carga del lado del cliente sin un consumidor externo que lo justifique.
- **Todo en Server Actions, incluido el análisis IA:** una action no puede devolver un binario como descarga, y el request largo y cancelable del análisis encaja mejor en un route handler.
- **tRPC u otra capa RPC:** las Server Actions ya dan RPC tipado sin otra dependencia.

## Consecuencias

**Positivas**

- Un solo lenguaje de tipos de punta a punta, sin capa HTTP propia que mantener.
- El patrón `{ success, error }` hace que el cliente maneje errores con un `toast` sin `try/catch`.

**Negativas / costos**

- Las Server Actions son endpoints públicos (POST a la URL de la página): **cada action tiene que verificar sesión, ownership y rol por su cuenta**. El proxy protege páginas, no actions (ver ADR-0009 y `requireAdmin()` en `lib/auth-session.ts`).
- Las páginas son dinámicas (leen la sesión), sin render estático.

**Reglas para el código**

- Una mutación nueva va en `app/actions/<dominio>.ts`, empieza con `requireAuth()`/`requireUserId()` y devuelve la unión discriminada.
- No crear un route handler para algo que una página o una action resuelven.
- `params` es async en Next 16: `const { id } = await params;`.

## Referencias

- `.cursor/rules.md` (Next.js Rules, Server Action Pattern).
- [`server-actions.md`](../server-actions.md), [`api-y-exportacion.md`](../api-y-exportacion.md).
