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

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: venta con 2 ítems y pago repartido (efectivo + transferencia), ticket generado, stock descontado (incluido el caso de quedar negativo), movimientos de caja correctos, reimpresión registrada, y anulación revirtiendo stock y caja (dos movimientos de "Devolución" con mismo monto/medio/referencia que el cobro). Falta tu revisión de los casos de permisos (rol sin "anular ventas"/"reimprimir tickets") y de pagos que no suman el total.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 58 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [ ] Los criterios de aceptación de las specs 005 y 007 siguen cumpliéndose. — El `saleId` agregado a `StockMovement`/`CashMovement` y el `print:hidden` agregado a `AppShell` tocan código de esas specs; probado a mano que `/inventario` y `/caja` siguen funcionando bien, pero queda para tu revisión.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Se deja en "En desarrollo" hasta que confirmes la revisión manual.
