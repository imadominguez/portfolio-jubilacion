# ADR-0014: Estado de onboarding derivado de los datos

- **Estado:** Aceptado
- **Fecha:** 2026-09-28 (registrado retrospectivamente el 2026-10-04)

## Contexto

Para que la app sea útil hay que cargar datos en cierto orden: un snapshot, completar los assets detectados (ratio y subyacente), importar movimientos, bajar históricos de CCL y precios, definir objetivos. Un usuario nuevo no sabe ese orden.

El primer intento (mayo de 2026) fue un tour guiado con `nextstepjs` cuyo estado vivía en `localStorage`. Un tour explica la UI, pero no sabe si el paso se cumplió de verdad, y el estado en `localStorage` se pierde al cambiar de navegador.

## Decisión

- El onboarding principal es un **wizard + checklist accionable** ("Puesta en marcha"), en el dashboard y en `/datos`.
- **La completitud de cada paso no se guarda: se deriva de los datos reales** (¿hay snapshot? ¿assets con ratio? ¿transacciones? ¿CCL e históricos? ¿objetivos?). La derivación es una función pura, `lib/setup-status.ts`, alimentada por `getSetupStatus()` (`app/actions/setup.ts`).
- En la base (`UserSetup`, 1:1 con el usuario) solo vive la **metadata de presentación**: si el wizard se completó u omitió y el último paso, para reanudar.
- El tour de `nextstepjs` queda como ayuda contextual opcional (desde la Guía): ya no se auto-inicia.

## Alternativas

- **Guardar un flag por paso completado:** se desincroniza en cuanto el usuario borra datos o los carga por otro camino.
- **Solo el tour con `localStorage`:** no verifica nada y no sobrevive a otro dispositivo.

## Consecuencias

**Positivas**

- El checklist nunca miente: si borrás el único snapshot, el paso vuelve a pendiente.
- La lógica de derivación es pura y testeada (`lib/setup-status.test.ts`).

**Negativas / costos**

- Calcular el estado cuesta varias consultas (counts) en cada render del dashboard y de `/datos`.

**Reglas para el código**

- Un paso nuevo se agrega en `lib/setup-status.ts` (derivación + test) y su dato de entrada en `getSetupStatus()`; no se agrega un campo "completado" en `UserSetup`.
- Las mutaciones que afectan pasos llaman a `revalidateSetup()` o al helper de su dominio (que ya incluye `/datos`).

## Referencias

- `lib/setup-status.ts` (comentario de cabecera), `app/actions/setup.ts`, `components/setup/*`, migración `20260921120000_add_user_setup`.
- Commits `0201e4b` (tour), `796d161` (puesta en marcha).
