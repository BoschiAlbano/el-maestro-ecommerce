# Tareas 013 — Notificaciones

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: enum `NotificationType`, modelo `Notification`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/lib/notifications.ts` (`notifyPedidoNuevo`, `notifyDiferenciaCaja`), conectados en `createOrder` (spec 009) y `confirmClose` (spec 007).
  - Hecho cuando: crear un pedido genera un aviso; cerrar una caja con diferencia distinta de cero genera un aviso; cerrar sin diferencia no genera nada.
- [x] **T-003** `src/lib/notifications-data.ts` (`loadNotificationsSummary`, `markNotificationRead`).
  - Hecho cuando: el resumen filtra por permiso de cada tipo, cuenta stock bajo como un solo ítem, y marcar como leído es seguro de repetir.
- [x] **T-004** Campanita en el header: `src/components/ui/popover.tsx`, `notifications-actions.ts`, `notifications-bell.tsx`, conectada en `app-shell.tsx`.
  - Hecho cuando: la campanita aparece en todas las pantallas con el contador correcto, se puede abrir y marcar avisos como leídos, el de stock bajo no se puede marcar, y se actualiza sola cada 60 segundos sin recargar.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: campanita con el contador correcto (stock bajo cuenta 1, sin importar cuántos productos), aviso de "pedido nuevo" al crear un pedido (marcado como leído y verificado que desaparece y baja el contador), aviso de "diferencia de caja" al cerrar con diferencia (motivo obligatorio, aviso con el monto correcto), y el aviso de stock bajo sin botón de leído, con link a `/lista-de-viaje`.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 89 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de las specs 005, 007 y 009 siguen cumpliéndose. — Probado en el mismo recorrido: crear pedido, abrir/cerrar caja, sin regresiones.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
