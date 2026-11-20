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

## Cambio 2026-11-20: pestañas y diseño (spec, sección 11; plan, sección 9)

- [x] **T-005** `notification-tabs.ts`: pestaña, ícono y urgencia por tipo, hora relativa y contadores por pestaña.
  - Hecho cuando: Vitest cubre cada tipo, los urgentes y los bordes de la hora relativa.
  - Hecha el 2026-11-20: `notification-tabs.test.ts`, 11 pruebas.
- [x] **T-006** Avisos calculados con pestaña, ícono y urgencia (facturación, publicaciones y órdenes de Mercado Libre).
  - Hecho cuando: las pruebas de esos avisos cubren los campos nuevos.
- [x] **T-007** Resumen y permisos: campos nuevos en cada aviso, `showTabs`, reconexión visible con Mercado Libre (con «Avisale al Dueño» sin Configuración) y «Marcar todas como leídas» por pestaña.
  - Hecho cuando: Vitest cubre el permiso de la reconexión; marcar todas en una pestaña no toca los avisos de la otra ni los calculados.
  - Hecha el 2026-11-20. La decisión de qué tipos marca cada pestaña y cómo se muestra la reconexión quedó pura (`typesToMarkRead`, `presentNotification`), con pruebas en `notification-types.test.ts`.
- [x] **T-008** Campanita: pestañas con contador, «Marcar todas como leídas», filas con ícono y hora, urgentes en rojo, calculados arriba con «Ahora», ventana más ancha con desplazamiento y mensajes de pestaña vacía.
  - Hecho cuando: tipos, linter y build pasan, y se ve bien en claro, oscuro y celular.
  - Hecha el 2026-11-20 en el código (tipos, linter, build y 714 pruebas). La revisión visual en claro, oscuro y celular queda para T-010: la pantalla pide iniciar sesión.
- [x] **T-009** Notas en las specs que agregaron avisos (019 a 024) y en la guía de Mercado Libre.
  - Hecho cuando: cada documento tiene su nota con fecha.
  - Hecha el 2026-11-20: specs 019 (también el permiso de la reconexión), 020, 021, 022, 023 y 024, y la sección «Avisos» de `docs/guia-mercado-libre.md`.
- [x] **T-010** **(D)** Verificación manual del cliente (plan, sección 9.6).
  - Hecha el 2026-11-20: el cliente revisó la campanita con avisos de las dos pestañas y confirmó que anda bien.
- [x] Se probaron los criterios de aceptación de la sección 11 de `spec.md`.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 714 pruebas).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado. — «Verificada; pestañas y diseño de la campanita verificados (2026-11-20)».
