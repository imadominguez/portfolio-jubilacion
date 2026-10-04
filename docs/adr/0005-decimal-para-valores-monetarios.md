# ADR-0005: `Decimal` para valores monetarios y conversión explícita a `number`

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0004

## Contexto

La app guarda precios en ARS con muchos dígitos (un CEDEAR puede valer decenas de miles de pesos y una cartera, millones), cantidades fraccionarias (FCI con 8 decimales), ratios CEDEAR y tipos de cambio. Los `float` de punto flotante acumulan errores de redondeo al sumar y multiplicar, y una base que guarda dinero como `double` propaga esos errores a todos los cálculos históricos.

Por otro lado, Prisma devuelve las columnas `Decimal` como objetos `Prisma.Decimal`, que no son serializables como props de un Client Component y no se pueden usar directamente en operaciones aritméticas ni en Recharts.

## Decisión

- Todos los valores financieros se guardan como `Decimal` con precisión explícita por tipo de dato: montos `Decimal(18,2)`, precios `Decimal(18,4)`, cantidades `Decimal(18,8)`, CCL `Decimal(10,4)`, porcentajes como fracción `Decimal(8,6)`.
- En la frontera de la capa de datos (helpers `lib/*-data.ts`, actions de lectura, API routes) se convierte **explícitamente** con `Number(value)` antes de exponer el valor al cliente o calcular.
- Los porcentajes se guardan como **fracción 0–1** y se exponen ×100.

## Alternativas

- **`Float`/`double precision` en la base:** más simple, pero con errores de redondeo persistidos.
- **Enteros en centavos:** exactos para montos, pero no sirven para precios con 4 decimales, cantidades fraccionarias ni tipos de cambio.
- **Aritmética con `Decimal` (decimal.js) en todo el código:** máxima precisión en los cálculos, pero mucho más verboso. Para un dashboard personal, calcular con `number` sobre valores leídos exactos es suficiente.

## Consecuencias

**Positivas**

- Lo persistido es exacto; los errores de redondeo no se acumulan entre importaciones.
- Los objetos que llegan al cliente son planos y serializables.

**Negativas / costos**

- Los cálculos en memoria se hacen con `number` (punto flotante): pueden tener errores mínimos de redondeo que solo afectan lo mostrado, nunca lo guardado.
- Olvidar el `Number(...)` produce errores de serialización o concatenaciones de strings.

**Reglas para el código**

- Columnas nuevas de dinero, precio, cantidad o tasa: `Decimal` con precisión explícita.
- Mapear siempre `Number(row.campo)` al salir de Prisma; nunca pasar un `Prisma.Decimal` a un Client Component.
- Mostrar con los formateadores de `lib/format.ts` (`es-AR`, `en-US` para USD).

## Referencias

- `prisma/schema.prisma`, `lib/format.ts`, `lib/number-parsing.ts`.
- `.cursor/rules.md` (Financial Data Rules).
