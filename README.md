This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Roles de usuario

La app usa Better Auth más Prisma: cada fila en la tabla **`user`** tiene **`role`** de tipo **`UserRole`** (`USER` o **`ADMIN`**). Por defecto los registros nuevos son **`USER`**.

- **Usuario `USER`:** acceso a todo el contenido habitual de portafolio; **no** ve la sección «Configuración» del sidebar y no puede entrar por URL directa a `/assets`, `/strategy`, `/settings` ni `/portfolio` (middleware redirecciona a `/`).
- **Usuario `ADMIN`:** ve configuración — assets, estrategia, preferencias de app y reporte mensual.

Para dar rol administrador en producción/desarrollo, actualizá el registro manualmente:

- Prisma Studio: `npx prisma studio`, editar `role` → `ADMIN`, o
- SQL: `UPDATE "user" SET role = 'ADMIN' WHERE email = 'tu-email@ejemplo.com';`

No uses variables de entorno con listas de emails para admins: la política debe vivir en la base de datos.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
