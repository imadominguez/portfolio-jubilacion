# Architecture Decision Records (ADR)

Un ADR registra **una decisión de arquitectura**: el contexto que la motivó, qué se decidió, qué alternativas había y qué consecuencias trae. El resto de `docs/` explica *qué* hace el sistema y *cómo*; los ADRs explican **por qué es así**.

## Cuándo escribir uno

Escribí un ADR cuando un cambio:

- elige entre alternativas razonables (una librería, un patrón, dónde vive un dato), o
- establece una regla que el resto del código tiene que respetar (inmutabilidad, aislamiento por usuario…), o
- **contradice o reemplaza** una decisión ya registrada.

No hace falta para cambios que se deducen del código o de una convención existente.

## Cómo

1. Copiá [`template.md`](./template.md) como `NNNN-titulo-en-kebab-case.md` con el siguiente número libre.
2. Completalo con estado **Propuesto**; pasalo a **Aceptado** cuando se mergea el cambio.
3. Los ADRs aceptados **no se reescriben**. Si una decisión cambia, se crea un ADR nuevo y el viejo pasa a **Reemplazado por ADR-XXXX** (se edita solo esa línea).
4. Agregá la fila al índice de abajo.

Estados posibles: `Propuesto` · `Aceptado` · `Rechazado` · `Obsoleto` · `Reemplazado por ADR-XXXX`.

## Nota sobre los ADRs 0001–0016

Se escribieron **retrospectivamente** el 2026-10-04 para documentar decisiones ya implementadas. El contexto y las consecuencias salen del código, de sus comentarios, de `.cursor/rules.md` y del historial de git. Las **alternativas** son las opciones razonables en cada caso: no consta que se hayan evaluado formalmente en su momento. Si recordás un motivo distinto, corregí el ADR (por ser retrospectivos, esta vez está bien editarlos).

## Índice

| # | Decisión | Estado |
|---|---|---|
| [0001](./0001-registrar-decisiones-con-adrs.md) | Registrar las decisiones de arquitectura con ADRs | Aceptado |
| [0002](./0002-rsc-y-server-actions-api-routes-solo-para-binarios-e-ia.md) | RSC para lecturas, Server Actions para mutaciones; API routes solo para binarios e IA | Aceptado |
| [0003](./0003-prisma-7-con-driver-adapter-pg.md) | Prisma 7 + PostgreSQL con driver adapter `pg` | Aceptado |
| [0004](./0004-snapshots-inmutables-con-ccl-congelado.md) | Snapshots inmutables con el CCL congelado | Aceptado |
| [0005](./0005-decimal-para-valores-monetarios.md) | `Decimal` para valores monetarios y conversión explícita a `number` | Aceptado |
| [0006](./0006-datos-externos-cacheados-en-db-con-refresco-manual.md) | Datos externos cacheados en DB con refresco manual | Aceptado |
| [0007](./0007-cliente-propio-de-yahoo-finance.md) | Cliente propio de Yahoo Finance en lugar de `yahoo-finance2` | Aceptado |
| [0008](./0008-aislamiento-por-usuario-y-datos-de-mercado-globales.md) | Aislamiento por `userId`; datos de mercado globales | Aceptado |
| [0009](./0009-better-auth-roles-en-db-y-registro-cerrado.md) | Better Auth con roles en DB, proxy y registro cerrado | Aceptado |
| [0010](./0010-sin-cache-de-datos-de-next-y-revalidacion-por-dominio.md) | Sin caché de datos de Next; revalidación centralizada por dominio | Reemplazado por 0017 |
| [0011](./0011-analisis-mensual-con-claude-y-estrategia-versionada.md) | Análisis mensual con Claude y estrategia versionada como system prompt | Reemplazado por 0018 |
| [0012](./0012-libro-de-movimientos-como-fuente-de-verdad.md) | Libro de movimientos de Cocos como fuente de verdad de la importación | Aceptado |
| [0013](./0013-plan-dca-determinista-sin-ia.md) | Plan DCA determinista, sin IA | Aceptado |
| [0014](./0014-estado-de-onboarding-derivado-de-los-datos.md) | Estado de onboarding derivado de los datos | Aceptado |
| [0015](./0015-inflacion-como-indice-acumulado-en-benchmarkpoint.md) | Inflación (IPC) como índice acumulado en `BenchmarkPoint` | Aceptado |
| [0016](./0016-logica-pura-en-lib-testeada-con-vitest.md) | Lógica pura en `lib/` testeada con Vitest | Aceptado |
| [0017](./0017-cache-components-partial-prerendering-y-prefetching.md) | Cache Components, Partial Prerendering y Partial Prefetching | Aceptado (adopción completa) |
| [0018](./0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md) | Reporte de oportunidades por acción con datos preparados por la app | Aceptado |
