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
- [x] **T-006** Precio de venta opcional por ítem, pedido por el cliente tras revisar la spec (2026-10-16).
  - Hecho cuando: cada ítem del ingreso puede traer además un precio de venta; si se carga, actualiza `Product.salePrice` y genera su fila de historial igual que el de compra; si no se carga, el precio de venta no cambia. El detalle del ingreso muestra el precio de venta siempre y el de compra solo con el permiso especial "ver costos y márgenes" (gap que no estaba, encontrado al tocar esta pantalla — ver plan.md, sección 7). — Probado a mano: ingreso con compra $120/venta $199 sobre un producto con $100/$150 previos; el historial de precio del producto quedó con las dos filas correctas.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md` relacionados con esta sesión (alta con varios campos, precio de venta opcional, historial, filtros) probados a mano en el navegador. Falta tu revisión de los casos de permisos (usuario sin "cambiar precios") y de datos inválidos.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 43 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [ ] Los criterios de aceptación de las specs 002, 004 y 005 siguen cumpliéndose. — Esta sesión además tocó el alta de producto (marca/rubro inline, stock inicial) y `/inventario` (filtros). Probado a mano: creación de marca y rubro nuevos desde el alta de producto, stock inicial reflejado en el historial de movimientos, y los filtros de inventario funcionando. Queda para tu revisión.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Se deja en "En desarrollo" hasta que confirmes la revisión manual.
