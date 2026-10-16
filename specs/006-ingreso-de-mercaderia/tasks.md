# Tareas 006 — Ingreso de mercadería

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `StockEntry`, `StockEntryItem`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/app/(app)/ingresos/actions.ts` (`createStockEntry`).
  - Hecho cuando: valida los ítems, exige "crear" + "cambiar precios", y en una sola transacción crea el ingreso, sus ítems, los movimientos de stock y actualiza el precio de compra (con su entrada en el historial) solo cuando cambió.
- [x] **T-003** Pantalla `/ingresos/nuevo`: armar la lista de ítems y confirmar.
  - Hecho cuando: se puede agregar/quitar ítems (producto, cantidad, precio), poner un proveedor opcional, y confirmar; sin el permiso especial "cambiar precios" la acción se rechaza. — `createStockEntry` se llama directo desde el cliente (no `FormData`), mismo criterio que `confirmImport`/`confirmCount`. Probado a mano en el navegador: encontró y corrigió dos bugs reales (el `<Select>` de producto pasaba de no controlado a controlado, y le faltaba el prop `items` de Base UI — este segundo resultó estar en TODA la app desde la spec 002; ver plan.md, sección 7, para el detalle completo y la lista de pantallas corregidas).
- [x] **T-004** Pantallas `/ingresos` (historial) y `/ingresos/[id]` (detalle).
  - Hecho cuando: se ve la lista de ingresos y el detalle de ítems de cada uno.
- [x] **T-005** Navegación: agregar "Ingresos" (reemplaza la entrada que falte o se agrega si no existe), visible según permiso.
  - Hecho cuando: un usuario con permiso "ver" en Ingreso de mercadería ve la entrada; uno sin permiso, no. — No había placeholder deshabilitado para este módulo (a diferencia de "Stock"); se agregó como entrada nueva.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano una vez en el navegador (alta de un ingreso con un ítem: stock, precio de compra e historial quedaron correctos). Falta tu revisión con un caso más completo (varios ítems, proveedor, permisos).
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 43 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [ ] Los criterios de aceptación de las specs 004 y 005 siguen cumpliéndose. — No debería haber impacto directo, pero el arreglo del `<Select>` (sección 7 del plan) tocó archivos de las specs 002-004; se corrió `pnpm test` y se probó a mano la pantalla de edición de producto y de usuario después del cambio, pero queda para tu revisión.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Se deja en "En desarrollo" hasta que confirmes la revisión manual.
