# ADR-0026: El sistema da de alta solo un activo cuando su propuesta pasa todos los controles

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Relacionados:** ADR-0024, ADR-0025 (reemplaza su punto "en esta etapa todo termina en revisión")

## Contexto

Con ADR-0025 cada ticker nuevo de un snapshot genera un pedido con una propuesta
y cada control explicado, pero todos esperan a un admin. En la práctica la gran
mayoría de los CEDEARs pasan los cuatro controles (listado de BYMA, bolsa de
EE.UU., subyacente en Yahoo y ratio confirmado por el precio del snapshot), y el
usuario igual se queda sin datos hasta que alguien aprueba.

## Decisión

Una propuesta que pasa todos los controles se da de alta sin intervención: el
`Asset` queda con `source = AUTO` y `reviewedAt = null`, el pedido en `DONE`, y
se bajan el precio y los históricos solo de ese subyacente. Lo que no pasa queda
en `NEEDS_REVIEW` y se avisa a los admins por mail.

- Un FCI o un instrumento que no es CEDEAR se da de alta con su tipo, ratio 1 y
  sin precio externo (no necesita controles de mercado).
- El mail se manda una vez por pedido: al quedar para revisar o al agotar los
  reintentos (5). Lleva tickers, nombres del CSV y motivos; nada del usuario.
- El cron diario reprocesa los pedidos `PENDING`, los `RUNNING` colgados y los
  `FAILED` con intentos disponibles.
- En Activos, un alta automática sin revisar muestra "Alta automática ·
  revisar"; marcarla o editarla la da por revisada.

## Alternativas

- **Mantener la aprobación manual de todo** (ADR-0025): seguro pero deja al
  usuario esperando en el caso normal.
- **Dar de alta también con controles pendientes**: un ratio sin confirmar puede
  multiplicar o dividir la valuación en USD de esa posición.

## Consecuencias

**Positivas**

- El caso normal se resuelve en segundos después del import, sin un admin.
- El admin solo mira lo dudoso, y le llega un mail cuando hay algo.

**Negativas / costos**

- Un error en dos fuentes a la vez (listado y precio) podría pasar; queda
  visible como alta automática sin revisar.
- Sector y país salen de Yahoo traducidos al castellano; la industria queda en
  inglés hasta que un admin la edite.

**Reglas para el código**

- Solo `requestOutcome(proposal) === "DONE"` crea un activo sin un admin.
- `shouldNotifyAdmin` decide los mails; un fallo pasajero no avisa.
- La respuesta del cron lleva conteos, no tickers.

## Referencias

- `lib/asset-resolution.ts` (`requestOutcome`, `shouldNotifyAdmin`),
  `lib/asset-requests-runner.ts`, `lib/asset-review-email.ts`,
  `app/api/cron/alerts/route.ts`.
- [Plan de alta automática de activos](../plan-alta-automatica-activos.md).
