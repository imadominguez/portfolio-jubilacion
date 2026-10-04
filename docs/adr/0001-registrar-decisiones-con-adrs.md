# ADR-0001: Registrar las decisiones de arquitectura con ADRs

- **Estado:** Aceptado
- **Fecha:** 2026-10-04

## Contexto

La documentación de `docs/` describe con detalle *qué* hace la app y *cómo* (módulos, modelo, fórmulas, integraciones). Lo que no queda escrito es **por qué** el sistema es así: por qué los snapshots no se editan, por qué hay un cliente de Yahoo propio o por qué el plan DCA no usa la IA. Esa información vive en la cabeza del autor, en comentarios sueltos y en `.cursor/rules.md`, mezclada con convenciones de estilo.

El proyecto además se desarrolla en buena parte con agentes de IA (Cursor, Claude Code), que leen la documentación para decidir. Sin el *por qué*, un agente (o una persona) puede "simplificar" algo que era deliberado: recalcular un snapshot, llamar a Yahoo en cada render o leer datos sin filtrar por usuario.

## Decisión

Registramos las decisiones de arquitectura como ADRs en `docs/adr/`, en formato MADR simplificado (Contexto, Decisión, Alternativas, Consecuencias), numerados y en español. Las decisiones ya implementadas se documentan retrospectivamente (ADRs 0002–0016).

## Alternativas

- **Solo `.cursor/rules.md`**: ya existe y funciona como reglas para agentes, pero mezcla convenciones de estilo con decisiones y no guarda contexto ni alternativas. Sigue existiendo y puede referenciar ADRs.
- **Un documento único de "decisiones"**: más simple, pero crece sin estructura y no permite marcar una decisión como reemplazada sin reescribir historia.
- **No documentar**: el costo aparece la primera vez que alguien deshace una decisión deliberada.

## Consecuencias

**Positivas**

- Las reglas que parecen arbitrarias (inmutabilidad, refresco manual, aislamiento) tienen una justificación a mano.
- Cambiar una decisión pasa a ser explícito: ADR nuevo y el viejo queda como *Reemplazado*.

**Negativas / costos**

- Un archivo más por decisión relevante. Si no se mantiene, queda desactualizado como cualquier doc.

**Reglas para el código**

- Un PR que contradice un ADR aceptado tiene que traer un ADR nuevo que lo reemplace.

## Referencias

- [`README.md`](./README.md) de esta carpeta (proceso e índice).
- `.cursor/rules.md`, `CLAUDE.md`.
