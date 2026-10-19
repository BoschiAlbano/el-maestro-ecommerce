# Tareas 008 — Ventas de mostrador y ticket

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `Sale`, `SaleItem`, `TicketReprint`, y `saleId` en `StockMovement`/`CashMovement`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/lib/sale.ts` (`computeSaleTotal`, `validatePayments`) con pruebas unitarias.
  - Hecho cuando: los tests cubren que el total suma y redondea bien, y que los pagos solo se aceptan si suman exacto. — 8 tests.
- [x] **T-003** `src/app/(app)/ventas/actions.ts`: `searchProducts`, `confirmSale`.
  - Hecho cuando: no se puede confirmar sin caja abierta, ni si los pagos no suman el total; al confirmar, baja el stock y queda un movimiento de caja por cada pago, todo en una transacción. — Se extendieron `registerStockMovement`/`registerCashMovement` (specs 005/007) con un `saleId` opcional, primer consumidor real de lo que esas specs dejaron pendiente.
- [x] **T-004** `reprintTicket`, `voidSale`.
  - Hecho cuando: reimprimir exige el permiso especial y deja registro; anular exige el permiso especial, rechaza una venta ya anulada, y revierte stock y caja automáticamente en el turno abierto actual.
- [x] **T-005** Pantalla `/ventas`: buscar, carrito, cobrar, confirmar.
  - Hecho cuando: se puede buscar por nombre o código, armar el carrito, repartir el cobro en efectivo/transferencia, y confirmar solo si la suma coincide con el total.
- [x] **T-006** Pantalla `/ventas/[id]/ticket`: ticket de 58 mm imprimible.
  - Hecho cuando: muestra razón social, número, fecha, empleado, ítems, totales y la leyenda fija; se llega ahí solo al confirmar una venta. — Encontrado y corregido un bug transversal: `AppShell` no ocultaba la navegación al imprimir (afectaba también a etiquetas y al resumen de caja, no solo acá — ver plan.md, sección 7).
- [x] **T-007** Pantallas `/ventas/historial` y `/ventas/historial/[id]`, con "Reimprimir" y "Anular".
  - Hecho cuando: se ve el historial y el detalle de una venta (ítems, pagos, reimpresiones); los botones están gateados por sus permisos especiales.
- [x] **T-008** Navegación: activar "Ventas", visible según permiso.
  - Hecho cuando: un usuario con permiso "crear" o "ver" en Ventas ve la entrada; uno sin permiso, no. — Gateado por "crear" (la pantalla principal es el punto de venta, no un listado — mismo criterio que `/productos/nuevo`); el historial tiene su propio link interno para quien solo tiene "ver". El rol de ejemplo "Cajero" (spec 002) ya tenía `ver`+`crear` en Ventas, `reimprimirTickets: true` y `anularVentas: false` cargados desde antes, anticipando esta spec correctamente.
- [x] **T-009** Rediseño de `/ventas`, `/ventas/historial` y `/ventas/historial/[id]` (2026-10-19, RF-9 a RF-13): pantalla de venta en dos zonas, modal de cobro con vuelto, stock informativo y código exacto en la búsqueda, historial en pestañas y detalle con tarjetas y anulación en modal.
  - Hecho cuando: se puede vender (uno y dos medios de pago, con y sin vuelto), el total y el stock mostrados son correctos, y el historial y el detalle muestran lo indicado en RF-13. — `computeChange` y `computePaymentStatus` con tests.
- [x] **T-010** El ticket como ventana modal (2026-10-19, RF-14): `getTicketData`, `TicketDialog`, `confirmSale` y `deliverOrderItems` devuelven el `saleId` en vez de redirigir, "Reimprimir" y "Ver ticket" abren el modal, y se elimina `/ventas/[id]/ticket`.
  - Hecho cuando: el ticket aparece en un modal tras vender, entregar un pedido, reimprimir y "Ver ticket", y al imprimir sale solo el ticket.
- [x] **T-011** Historial de ventas por período (2026-10-19, RF-15): selector Caja actual / Hoy / Últimos 7 días / Todas, con la caja actual por defecto.
  - Hecho cuando: el historial abre en la caja actual, el selector cambia el listado, las filas de otros turnos indican su caja, y sin caja abierta abre en Hoy. — `parseSalesPeriod` y `salesPeriodRange` con tests.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: venta con 2 ítems y pago repartido (efectivo + transferencia), ticket generado, stock descontado (incluido el caso de quedar negativo), movimientos de caja correctos, reimpresión registrada, y anulación revirtiendo stock y caja (dos movimientos de "Devolución" con mismo monto/medio/referencia que el cobro). Revisado y confirmado por el cliente (2026-10-17), incluidos los casos de permisos y de pagos que no suman el total.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 58 tests).
- [ ] Verificación manual del rediseño de ventas (T-009) por el cliente.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de las specs 005 y 007 siguen cumpliéndose. — El `saleId` agregado a `StockMovement`/`CashMovement` y el `print:hidden` agregado a `AppShell` tocan código de esas specs; confirmado que `/inventario` y `/caja` siguen funcionando bien.
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — Pasada a "Verificada".
