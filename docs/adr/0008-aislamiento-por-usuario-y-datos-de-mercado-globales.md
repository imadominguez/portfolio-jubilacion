# ADR-0008: Aislamiento por `userId`; datos de mercado globales

- **Estado:** Aceptado
- **Fecha:** 2026-04-25, endurecido el 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0002, ADR-0009

## Contexto

La app nació single-user. Al agregar autenticación (abril de 2026) se sumó `userId` a los modelos de dominio, pero durante un tiempo varias lecturas y borrados seguían operando solo por `id`: cualquier usuario autenticado que conociera un id podía ver o borrar un snapshot, una transacción o un reporte ajeno, incluso por las rutas de exportación. Eso se corrigió en septiembre de 2026 (commit `55ae462`).

Al mismo tiempo, buena parte de los datos no pertenecen a nadie: el CCL de una fecha, el precio de AAPL o la serie del IPC son iguales para todos. Duplicarlos por usuario multiplicaría las descargas sin aportar nada.

## Decisión

- **Datos del portafolio, por usuario** (`userId` obligatorio en la práctica): `PortfolioSnapshot`, `Transaction`, `Movement`, `Dividend`, `TargetAllocation`, `MilestoneAlert`, `RetirementSettings`, `PortfolioReport`, `UserSetup`.
  - Toda lectura filtra con `where: { ..., userId }`.
  - Todo borrado usa `deleteMany({ where: { id, userId } })`, de modo que un id ajeno no borra nada y se informa como "no encontrado".
  - Las API routes responden `401` sin sesión y `404` para un id ajeno.
  - El helper es `requireUserId()` (`lib/auth-session.ts`).
- **Datos de mercado, globales** (sin `userId`): `ExchangeRate`, `MarketPriceCache`, `HistoricalPriceCache`, `BenchmarkPoint`.
- **Configuración global administrada:** `Asset` (catálogo de CEDEARs; escritura solo ADMIN) e `InvestmentStrategy` (system prompt del análisis IA; página solo ADMIN).
- Las restricciones únicas incluyen al usuario: `[userId, snapshotDate]`, `[userId, ticker]` en objetivos, `[userId, nroTicket]` en movimientos.

## Alternativas

- **Una base o schema por usuario:** aislamiento fuerte, pero excesivo para pocos usuarios y complica las migraciones.
- **Row Level Security de PostgreSQL:** garantiza el filtro en la base, pero Prisma no lo integra de forma nativa; habría que setear la sesión de Postgres en cada request.
- **Datos de mercado por usuario:** aislamiento uniforme, pero duplica descargas y almacenamiento sin beneficio.

## Consecuencias

**Positivas**

- Un usuario no puede leer ni borrar datos de otro, ni por la UI ni por las API routes.
- El CCL y los precios se descargan una vez y los aprovechan todos.

**Negativas / costos**

- El aislamiento depende de que **cada consulta** incluya el filtro: no hay red de seguridad en la base. Un `findUnique({ where: { id } })` nuevo reabre el agujero.
- Un usuario que refresca precios o CCL modifica datos que ven los demás (aceptable: son datos públicos de mercado).
- `userId` es opcional en el schema por compatibilidad con datos previos a la autenticación (`scripts/seed-admin.mjs` asocia los huérfanos).

**Reglas para el código**

- Al leer datos de usuario por id, usar `findFirst({ where: { id, userId } })`, no `findUnique({ where: { id } })`.
- Borrar con `deleteMany({ where: { id, userId } })` y verificar `count`.
- Un modelo nuevo de datos del portafolio lleva `userId` y entra en este ADR; un dato de mercado nuevo es global.

## Referencias

- `lib/auth-session.ts`, `app/actions/*`, `app/api/export/*`.
- Commits `5b140f3` (scope por usuario), `55ae462` (aislamiento de lecturas y borrados).
- [`server-actions.md`](../server-actions.md#matriz-de-autorización).
