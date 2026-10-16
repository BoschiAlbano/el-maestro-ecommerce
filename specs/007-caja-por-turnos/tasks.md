# Tareas 007 — Caja por turnos

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: enums `PaymentMethod`/`CashMovementType`, modelos `CashShift`/`CashMovement`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/lib/cash.ts` (`registerCashMovement`) y `src/lib/cash-shift.ts` (`computeExpectedCash`) con pruebas unitarias.
  - Hecho cuando: los tests cubren que `computeExpectedCash` solo cuenta efectivo (ingresos suman, egresos restan, transferencia se ignora) y maneja una lista vacía. — 7 tests entre los dos módulos.
- [x] **T-003** `src/app/(app)/caja/actions.ts`: `openShift`, `registerMovement`.
  - Hecho cuando: no se puede abrir un turno si ya hay uno abierto; no se puede registrar un movimiento sin turno abierto; un movimiento por transferencia exige 4 dígitos de referencia.
- [x] **T-004** `previewClose`/`confirmClose` (cierre en dos pasos).
  - Hecho cuando: se previsualiza la diferencia sin guardar nada; al confirmar, si hay diferencia sin motivo se rechaza; si coincide, cierra directo; recalcula la diferencia dentro de la transacción de confirmación, no confía en la previsualización.
- [x] **T-005** Pantalla `/caja`: turno abierto (resumen + alta de movimiento) o abrir uno si no hay.
  - Hecho cuando: se puede abrir un turno, registrar movimientos (con el campo de referencia apareciendo solo para transferencia), y cerrar con el wizard de dos pasos. Gateado por los permisos de la spec.
- [x] **T-006** Pantallas `/caja/historial` y `/caja/historial/[id]` (con impresión).
  - Hecho cuando: se ve la lista de turnos cerrados con su diferencia, el detalle de movimientos de uno en particular, y se puede imprimir ese detalle.
- [x] **T-007** Navegación: activar "Caja" en la navegación, visible según permiso en Caja.
  - Hecho cuando: un usuario con permiso "ver" en Caja ve la entrada; uno sin permiso, no. — Ya existía el placeholder deshabilitado; solo se activó.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: apertura, un egreso en efectivo, un egreso por transferencia (con referencia), cierre con diferencia rechazado sin motivo y aceptado con motivo, historial y detalle con impresión. Falta tu revisión de los casos de permisos (rol sin "cerrar caja") y de abrir una segunda caja estando una abierta.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 50 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [ ] Los criterios de aceptación de las specs 002 y 003 siguen cumpliéndose.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Se deja en "En desarrollo" hasta que confirmes la revisión manual.

**Nota post-revisión (2026-10-16, pedido del cliente):** el campo de monto inicial tenía `required` en el formulario, así que el navegador bloqueaba el envío si se dejaba vacío (en vez de abrir con $0, como dice la spec — RF-1 no pide un monto obligatorio, solo "inicial"). El servidor ya aceptaba vacío como 0 (`z.coerce.number()` sobre un string vacío da 0), el problema era solo el `required` del lado del cliente. Se sacó ese atributo y se le agregó la aclaración "(vacío = $0)" a la etiqueta. Probado a mano: abrir sin tocar el campo deja la caja en $0.
