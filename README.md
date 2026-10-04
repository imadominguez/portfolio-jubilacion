# Portfolio Jubilación

Dashboard privado para seguir un portafolio de largo plazo de **CEDEARs** operados en **Cocos Capital**: snapshots inmutables importados desde CSV, PPM y P&L, performance contra benchmarks e inflación, ganancia real en USD vs impacto del CCL, rebalanceo, plan DCA mensual, proyección de jubilación y un reporte mensual con IA.

Next.js 16 (App Router) · React 19 · Prisma 7 + PostgreSQL · Better Auth · shadcn/ui + Tailwind v4.

## Documentación

La documentación técnica y funcional completa está en [`docs/`](./docs/README.md):

- [Índice general](./docs/README.md)
- [Arquitectura](./docs/arquitectura.md) · [Modelo de datos](./docs/modelo-de-datos.md) · [Módulos y rutas](./docs/modulos.md)
- [Lógica financiera](./docs/logica-financiera.md) · [Server Actions](./docs/server-actions.md) · [API y exportación](./docs/api-y-exportacion.md)
- [Integraciones](./docs/integraciones.md) · [Componentes](./docs/componentes.md) · [Desarrollo](./docs/desarrollo.md)
- [Flujo de uso](./docs/flujo-de-uso.md) · [Datos del portfolio](./docs/datos-del-portfolio.md)
- [Decisiones de arquitectura (ADRs)](./docs/adr/README.md): por qué el sistema es como es

## Roles de usuario

La app usa Better Auth más Prisma: cada fila en la tabla **`user`** tiene **`role`** de tipo **`UserRole`** (`USER` o **`ADMIN`**). Por defecto los registros nuevos son **`USER`**. El **registro público está cerrado** (la app es privada): para crear usuarios usá `scripts/seed-admin.mjs` o habilitá el alta con `ALLOW_PUBLIC_SIGNUP=true`.

- **Usuario `USER`:** acceso a todo el contenido habitual de portafolio; **no** ve la sección «Configuración» del sidebar y no puede entrar por URL directa a `/assets`, `/strategy`, `/settings` ni `/portfolio` (`proxy.ts` redirecciona a `/`).
- **Usuario `ADMIN`:** ve configuración — assets, estrategia, preferencias de app y reporte mensual.

Para dar rol administrador en producción/desarrollo, actualizá el registro manualmente:

- Prisma Studio: `pnpm prisma studio`, editar `role` → `ADMIN`, o
- SQL: `UPDATE "user" SET role = 'ADMIN' WHERE email = 'tu-email@ejemplo.com';`

No uses variables de entorno con listas de emails para admins: la política debe vivir en la base de datos.

## Puesta en marcha

```bash
pnpm install
# crear .env con DATABASE_URL (y ANTHROPIC_API_KEY para el reporte con IA)
pnpm prisma generate
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev                 # http://localhost:3000
```

Antes de commitear: `pnpm lint && pnpm test && pnpm build` (lo mismo que corre el CI).

Variables de entorno, scripts, migraciones y deuda técnica conocida: [docs/desarrollo.md](./docs/desarrollo.md).
