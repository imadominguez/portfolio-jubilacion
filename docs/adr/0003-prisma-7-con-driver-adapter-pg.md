# ADR-0003: Prisma 7 + PostgreSQL con driver adapter `pg`

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (registrado retrospectivamente el 2026-10-04)

## Contexto

El dominio es relacional (snapshots → posiciones, usuario → transacciones ↔ movimientos) y los valores financieros requieren precisión decimal (ADR-0005). La app se despliega en Vercel con una base PostgreSQL administrada (Neon/Supabase), que exige SSL y donde el filesystem es efímero.

## Decisión

- **PostgreSQL** como única base y **Prisma 7** como ORM.
- Conexión con el **driver adapter** `@prisma/adapter-pg` (driver `pg` nativo) en lugar del query engine binario, con `ssl: { rejectUnauthorized: false }`.
- Cliente generado en `app/generated/prisma` (`provider = "prisma-client"`, `output` explícito), versionado y nunca editado a mano.
- Configuración en `prisma.config.ts` (URL desde `env("DATABASE_URL")`, ruta de migraciones y seed).
- Un único `PrismaClient` singleton en `lib/db.ts`, guardado en `globalThis` fuera de producción para sobrevivir al hot reload.
- Sin SQL crudo en el código de la app.

## Alternativas

- **Drizzle / Kysely:** más livianos, pero Prisma ya da migraciones, Studio para editar datos (el camino documentado para promover admins) y un adapter oficial para Better Auth.
- **Query engine binario de Prisma:** más pesado en serverless y con problemas de compatibilidad de binarios por plataforma; el adapter `pg` es el camino de Prisma 7.
- **SQLite:** no sirve con filesystem efímero en Vercel.

## Consecuencias

**Positivas**

- Tipos generados para todo el modelo, migraciones versionadas en `prisma/migrations/`.
- Better Auth usa el mismo cliente (`prismaAdapter(db)`).

**Negativas / costos**

- Hay que correr `npx prisma generate` después de clonar o cambiar el schema (el CI lo hace antes de lint/test/build).
- `rejectUnauthorized: false` acepta cualquier certificado del servidor de base de datos.
- Hubo drift entre la base de desarrollo y las migraciones (columnas aplicadas a mano). Se reconcilió de forma no destructiva; **`prisma migrate reset` está prohibido** porque borra datos reales.

**Reglas para el código**

- Importar siempre `db` desde `lib/db.ts`; no crear otros `PrismaClient` en la app (el seed y los scripts son la excepción).
- Cambios de schema: `npx prisma migrate dev --name <x>`. Ante drift, `prisma migrate diff` + `db execute` + `migrate resolve --applied`.

## Referencias

- `lib/db.ts`, `prisma.config.ts`, `prisma/schema.prisma`.
- [`desarrollo.md`](../desarrollo.md#historial-de-migraciones), [`modelo-de-datos.md`](../modelo-de-datos.md).
