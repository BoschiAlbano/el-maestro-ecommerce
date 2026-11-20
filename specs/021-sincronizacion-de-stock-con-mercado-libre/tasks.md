# Tareas 021 — Sincronización de stock con Mercado Libre

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (pantalla de Mercado Libre o revisión manual); el resto se hace en el código.

## Preparación

- [x] **T-001** **(D)** Prueba técnica (plan, sección 0) con la publicación de prueba.
  - Hecho cuando: cada punto tiene resultado en `prueba-tecnica.md` y el plan lo tiene en cuenta.
  - Hecha el 2026-11-19. La cantidad va por `PUT /items/{id}`; Mercado Libre pausa y reactiva sola según el stock, salvo una pausa del vendedor. Se corrigió de paso el estado «pausada por el vendedor y sin stock» de la spec 020.

## Base de datos

- [x] **T-002** Migración: `quantityPendingSince`, `lastKnownQuantity` y `lastQuantitySyncAt` en `ml_listings`, con su índice. Copia de las tablas antes de aplicarla.
  - Hecho cuando: aplica en la base de la nube, el esquema y la base quedan sin diferencias, y el usuario reinició `pnpm dev`.
  - Hecho el 2026-11-19: `prisma/migrations/20261119210000_add_ml_listing_quantity`, aplicada en la base de la nube y sin diferencias con el esquema, con copia previa de las tablas en JSON. El usuario reinició `pnpm dev`.

## Lógica (con pruebas)

- [x] **T-003** `publishableQuantity` sin reserva, y `reconcile` con la cantidad y el modo (`notification` o `control`).
  - Hecho cuando: Vitest cubre la tabla del plan, sección 3.3, en los dos modos.
  - Hecho el 2026-11-19: `publishableQuantity(stock)` sin reserva, y `reconcile` con `pushQuantity` y el modo. 9 pruebas nuevas de cantidad.
- [x] **T-004** `registerStockMovement` marca `quantityPendingSince` en la publicación vigente del producto, en la misma transacción.
  - Hecho cuando: `stock.test.ts` verifica la marca.
  - Hecho el 2026-11-19: `registerStockMovement` hace el `updateMany` por `linkedProductId`; prueba nueva en `stock.test.ts`.
- [x] **T-005** `pushPendingListings` envía la cantidad (de a 5 en paralelo) y guarda lo enviado; `scheduleListingPush` en las acciones que mueven stock: venta, anulación, entrega de pedido, ingreso, ajuste, merma, conteo y alta de producto.
  - Hecho cuando: una venta de un producto vinculado cambia la cantidad en Mercado Libre sin demorar la venta.
  - Hecho el 2026-11-19: `pushOne` y `pushPendingListings` (de a 5) con la cantidad leída en el momento del envío; `scheduleListingPush` en venta, anulación, entrega de pedido, ingreso, ajuste y merma, y conteo. El alta de producto marca pero no agenda: un producto nuevo no tiene publicación. En la ficha y el ingreso reemplaza al envío del precio de la 020.
- [x] **T-006** `syncAllListings` (control completo), en la pasada diaria después de procesar los avisos, en `syncListingsNow` y al reconectar la cuenta.
  - Hecho cuando: una cantidad cambiada a mano en Mercado Libre se corrige con «Sincronizar ahora» y el resumen dice cuántas se revisaron y corrigieron.
  - Hecho el 2026-11-19: `syncAllListings` reemplaza a `rereadLinkedListings`; en `runMaintenance` va después de procesar los avisos; `syncListingsNow` reemplaza a `retryPendingSync`; el retorno de la autorización lo agenda con `after`. Al vincular (020) se guarda la cantidad publicada.
- [x] **T-007** Aviso de pendientes en la campanita (más de 2 minutos), para quien tiene «ver» en Mercado Libre.
  - Hecho cuando: Vitest cubre marcas recientes, viejas y sin permiso.
  - Hecho el 2026-11-19: `src/lib/mercadolibre/alerts.ts` (puro, 3 pruebas) y `loadMercadoLibreAlerts` en `notifications-data.ts`. La campanita ya mostraba cualquier aviso calculado.

## Pantalla

- [x] **T-008** `/publicaciones`: columna «En Mercado Libre», marca de cantidad pendiente, y «Sincronizar ahora» en lugar de «Reintentar envíos».
  - Hecho cuando: se ve la cantidad publicada de cada producto y el botón devuelve el resumen.
  - Hecho el 2026-11-19: columna «En Mercado Libre» (en rojo si no coincide y no hay nada pendiente), «Pendiente de enviar» y `SyncNowButton` visible siempre para quien tiene «editar».

## Documentación

- [x] **T-009** Notas en las specs 005 (cada movimiento avisa a Mercado Libre) y 020 (el botón cambió), y la guía para el dueño.
  - Hecho cuando: cada documento tiene su nota con fecha.
  - Hecho el 2026-11-19: notas en las specs 005 y 020 (spec y plan), y sección «Stock» en `docs/guia-mercado-libre.md`, con la advertencia de no vender por Mercado Libre hasta la 022.

## Verificación final

- [x] **T-010** **(D)** Verificación manual con la publicación de prueba, siguiendo el plan, sección 6.
  - Parte automática hecha el 2026-11-19, con la publicación del cable y el producto del usuario (ajustes que suman cero, borrados después): 11 verificaciones bien (ajuste +2 y −2 llegan a Mercado Libre, la pausa del dueño se mantiene, subida a mano corregida por el aviso, bajada a mano esperada hasta «Sincronizar ahora», control sin diferencias, aviso de pendientes con marca reciente y vieja). Todo quedó como estaba. **Falta la revisión del usuario** (venta, anulación, ingreso, conteo, entrega de pedido, y una publicación activa que llega a 0 y vuelve).
  - Hecha el 2026-11-19: el usuario reinició `pnpm dev` y probó venta, anulación, ingreso, conteo y entrega de pedido con el cable, incluida la pausa por falta de stock y su vuelta.
- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas"). — Cada criterio dice cómo se probó. Sin probar de verdad: un corte de Mercado Libre.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`). — 2026-11-19: 616 pruebas pasando, sin errores de tipos ni de linter, build de producción correcto.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-19)».
