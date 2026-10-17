# Tareas 009 — Pedidos por encargo

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `OrderStatus`, `Order`, `OrderItem`, y `orderId`/`depositApplied` en `Sale`, `orderId` en `CashMovement`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/lib/order.ts` (`computeDepositApplication`, `computeCommittedQuantities`) con pruebas unitarias.
  - Hecho cuando: los tests cubren seña que cubre todo/parte/nada, y que lo comprometido ignora líneas ya completas. — 7 tests.
- [x] **T-003** `src/app/(app)/pedidos/actions.ts`: `createOrder`, `addOrderItem`, `removeOrderItem`, `payDeposit`.
  - Hecho cuando: se puede crear un pedido sin seña, agregar/quitar ítems mientras está pendiente, y cobrar una seña (una sola vez, exige caja abierta).
- [x] **T-004** `deliverOrderItems`, `cancelOrder`.
  - Hecho cuando: entregar genera la venta/ticket, descuenta stock, aplica la seña disponible y solo cobra el resto; el pedido se cierra solo sin nada pendiente. Cancelar devuelve la seña si queda algo (exige caja abierta solo en ese caso) y siempre pide motivo. — Se extendió `registerCashMovement` (specs 007) con un `orderId` opcional, mismo criterio que el `saleId` de la spec 008.
- [x] **T-005** Pantallas `/pedidos` (historial) y `/pedidos/nuevo` (alta).
  - Hecho cuando: se ve la lista de pedidos y se puede crear uno con cliente y productos, con o sin stock.
- [x] **T-006** Pantalla `/pedidos/[id]`: ítems, seña, entregar, cancelar.
  - Hecho cuando: se pueden agregar/quitar ítems, cobrar la seña, entregar parte o todo (con el cobro del resto si corresponde), y cancelar con motivo — todo gateado por sus permisos.
- [x] **T-007** Ticket con seña aplicada/saldo (spec 008) y columna "Comprometido" en `/inventario` (spec 005).
  - Hecho cuando: el ticket de una entrega muestra la seña aplicada y el saldo cuando corresponde, y `/inventario` muestra cuánto está comprometido por producto.
- [x] **T-008** Navegación: activar "Pedidos", visible según permiso.
  - Hecho cuando: un usuario con permiso "ver" en Pedidos ve la entrada; uno sin permiso, no. — `pnpm build`, `pnpm lint`, `tsc --noEmit` y los 65 tests unitarios pasan sin errores.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas"). — Probado a mano en el navegador: pedido con seña parcial aplicada en dos entregas (cierre automático al completarse), pedido sin seña entregado normal, cancelación con devolución de seña (egreso de caja) y cancelación sin seña (sin ningún movimiento), columna "Comprometido" en `/inventario`, y el ticket mostrando seña aplicada/saldo.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de las specs 005, 007 y 008 siguen cumpliéndose. — Caja, inventario y tickets de venta comunes se probaron de nuevo en el mismo recorrido sin regresiones.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
