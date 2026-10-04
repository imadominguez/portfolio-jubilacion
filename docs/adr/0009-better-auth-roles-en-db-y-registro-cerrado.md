# ADR-0009: Better Auth con roles en DB, proxy y registro cerrado

- **Estado:** Aceptado
- **Fecha:** 2026-04-25; roles el 2026-05-22; registro cerrado y `proxy.ts` el 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0008

## Contexto

La app es privada: maneja datos financieros personales y no está pensada para el público. Aun así necesita autenticación (se despliega en una URL pública) y distinguir quién puede tocar la configuración global (catálogo de assets, estrategia del análisis IA, reporte mensual con costo por llamada).

La autenticación tuvo idas y vueltas: en marzo de 2026 se agregó Better Auth con Google sign-in; en abril se eliminó y semanas después se volvió a agregar con email + contraseña. En mayo se sumaron los roles y en septiembre se cerró el registro público.

## Decisión

- **Better Auth** con email + contraseña, sesiones en cookie y adapter de Prisma sobre la misma base.
- **Rol en la base de datos:** enum `UserRole` (`USER` por defecto, `ADMIN`) en la tabla `user`, expuesto en la sesión con `additionalFields` e **`input: false`**, para que el cliente no pueda enviarlo al registrarse. Se promueve a admin solo desde la DB (SQL, Prisma Studio, seed con `SEED_ADMIN_EMAIL`), nunca con listas de emails en variables de entorno.
- **Registro cerrado por defecto:** `disableSignUp` salvo `ALLOW_PUBLIC_SIGNUP=true`; `/register` redirige a `/login`. Los usuarios se crean por script/seed.
- **Protección de rutas en `proxy.ts`** (el reemplazo de `middleware.ts` en Next 16, siempre en runtime Node.js, necesario para Prisma): sin sesión → `/login`; rutas de `ADMIN_PATH_PREFIXES` sin rol ADMIN → `/`.
- **Defensa en profundidad:** el sidebar oculta el grupo de configuración a no-admins, y las actions sobre datos administrados (`assets.ts`, `strategy.ts`) y `POST /api/analyze-portfolio` revalidan el rol (`requireAdmin()` en `lib/auth-session.ts`).

## Alternativas

- **OAuth (Google) únicamente:** se probó primero; para una app privada con pocos usuarios agrega configuración de proveedor sin un beneficio claro.
- **NextAuth/Auth.js:** alternativa equivalente; Better Auth tiene una API más directa para campos adicionales tipados y un adapter de Prisma simple.
- **Lista de admins por variable de entorno:** más simple, pero la política queda fuera de la base y cambia con cada deploy. Se descartó explícitamente (ver README).
- **Registro abierto:** innecesario para una app privada; amplía la superficie de ataque.

## Consecuencias

**Positivas**

- No hay escalada de privilegios desde el front (`input: false`).
- El rol se gestiona con las mismas herramientas que el resto de los datos.

**Negativas / costos**

- El proxy protege **páginas**, no Server Actions: una action invocada desde otra página pasa el proxy con solo tener sesión. **Toda action sobre datos administrados debe chequear el rol por su cuenta.** (Hasta el 2026-10-04 `strategy.ts` no lo hacía y un `USER` podía cambiar la estrategia global.)
- Dos listas que mantener sincronizadas: `ADMIN_PATH_PREFIXES` (proxy) y `NAV_CONFIG` (sidebar).
- `scripts/seed-admin.mjs` usa una contraseña hardcodeada.

**Reglas para el código**

- Página admin nueva → sumarla a `ADMIN_PATH_PREFIXES` **y** a `NAV_CONFIG`.
- Action admin nueva → `requireAdmin()` de `lib/auth-session.ts`.
- Usar `isAdminRole()` (`lib/user-role.ts`); no comparar strings de rol sueltos.

## Referencias

- `lib/auth.ts`, `lib/auth-session.ts`, `lib/user-role.ts`, `proxy.ts`, `components/layout/app-sidebar.tsx`.
- Commits `36a02c4`, `c8af2c0`, `434b654`, `b9dd270`, `ae0e40f`.
- [`arquitectura.md`](../arquitectura.md#autenticación-y-autorización), README raíz (Roles de usuario).
