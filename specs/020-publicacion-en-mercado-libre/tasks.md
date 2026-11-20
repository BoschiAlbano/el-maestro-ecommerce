# Tareas 020 — Vincular y administrar publicaciones de Mercado Libre

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (pantalla de Mercado Libre o revisión manual); el resto se hace en el código.

## Preparación

- [x] **T-001** **(D)** Prueba técnica (plan, sección 0) con la publicación de prueba.
  - Hecho cuando: cada punto tiene resultado en `prueba-tecnica.md` y el plan lo tiene en cuenta.
  - Hecha el 2026-11-16. Cambió el plan en: búsqueda propia por SKU (la de Mercado Libre distingue mayúsculas y tarda), una sola función para los avisos `items` e `items_prices` que compara con lo guardado, y escrituras con `PUT /items/{id}`. Sin probar: finalizar (irreversible), variantes y catálogo (la cuenta no tiene).

## Base de datos

- [x] **T-002** Migración: `sku` y `skuKey` en `products`; `source` y `changedByUserId` opcional en `product_price_history`; tabla `ml_listings`; enums `PriceChangeSource` y `MlListingStatus`. Copia de la base con `pg_dump` antes de aplicarla (se desarrolla sobre la base de la nube).
  - Hecho cuando: aplica, el esquema y la base quedan sin diferencias, y la base rechaza un `skuKey` repetido y un segundo `linkedProductId` para el mismo producto.
  - Hecho el 2026-11-16: `prisma/migrations/20261116220000_add_ml_listings`, aplicada en la base de la nube y sin diferencias con el esquema. Sin `pg_dump` en la máquina ni Docker andando: la copia previa se hizo como JSON de todas las tablas (la base casi no tenía datos). Probado en una transacción deshecha: `skuKey` repetido rechazado, varios productos sin SKU aceptados, segunda publicación vigente del mismo producto rechazada, una finalizada del mismo producto aceptada, historial sin usuario con origen Mercado Libre aceptado. El usuario del historial mantiene `onDelete: Restrict`.
- [x] **T-003** Migraciones de enums: `MERCADO_LIBRE` en `ModuloNegocio`; `ML_LISTING_*` en `AuditAction`; `ML_PUBLICACION` en `NotificationType`.
  - Hecho cuando: aplican y el cliente de Prisma se regenera sin errores.
  - Hecho el 2026-11-16, en la misma migración que T-002 (igual que las specs 019 y 023). `ML_PUBLICACION` ya tiene su acceso en `notification-types.ts` (permiso "ver" en Mercado Libre) y su enlace a `/publicaciones`.

## Lógica pura (con pruebas)

- [x] **T-004** `sku.ts`: `normalizeSku`.
  - Hecho cuando: Vitest cubre los casos del plan, sección 6.
  - Hecho el 2026-11-16: `src/lib/mercadolibre/sku.ts` (`normalizeSku`, `normalizeOptionalSku`, `skuKeyOf`), 17 pruebas. Solo letras sin tilde: «CAÑO-1» se rechaza.
- [x] **T-005** `listing-status.ts` y `listing-read.ts`: estado del RF-12 con su motivo, y lectura de la publicación con `zod` (se puede vincular o no, y por qué).
  - Hecho cuando: Vitest cubre cada estado, un subestado desconocido, y publicaciones del modelo nuevo, con variantes, de Full, finalizada y sin SKU (con la forma real que dejó la prueba técnica).
  - Hecho el 2026-11-16: `listing-status.ts` (estado, motivo, si lo impuso Mercado Libre y si amerita aviso) y `listing-read.ts`, con la publicación real de la prueba técnica, recortada, en `__fixtures__/item-modelo-nuevo.json`. 24 pruebas. `inactive` y un estado desconocido se muestran como observada, con el estado en el motivo.
- [x] **T-006** `link-proposal.ts` y `link-preview.ts`.
  - Hecho cuando: Vitest cubre propuesta única por SKU, por código de barras y por código universal; varias coincidencias; dos publicaciones para el mismo producto; producto ya vinculado; resumen de cambios con producto sin SKU y con stock negativo.
  - Hecho el 2026-11-16: `link-proposal.ts` y `link-preview.ts` (con `publishableQuantity`, que usará la spec 021), 19 pruebas.
- [x] **T-007** `listing-reconcile.ts`.
  - Hecho cuando: Vitest cubre la tabla del plan, sección 3.5: cambio propio, precio de Mercado Libre, precio con envío pendiente, SKU tomado, SKU en conflicto, cambio de estado con y sin aviso, finalizada.
  - Hecho el 2026-11-16: `listing-reconcile.ts`, 15 pruebas. Decisiones que no estaban en el plan: si en Mercado Libre borran el SKU, el producto queda sin SKU; si solo cambian las mayúsculas, no es un cambio; una publicación finalizada no toma precio ni SKU.

## Servidor

- [x] **T-008** `listings-api.ts`: traer todas las publicaciones de la cuenta, varias por identificador, una, y `updateListing`.
  - Hecho cuando: un script contra la cuenta de desarrollo trae la publicación de prueba y le cambia el precio con centavos y de vuelta. Se anota si Mercado Libre acepta centavos (plan, riesgo 1).
  - Hecho el 2026-11-16: `listings-api.ts` (`searchListingIds`, `countListings`, `getListings` de a 20 con `include_attributes=all`, `getListing`, `updateListing`, `describeMlRejection`). Probado contra la cuenta de desarrollo: la consulta de varias trae el SKU, y **Mercado Libre acepta centavos** (777.777,50 quedó así) — el riesgo 1 del plan queda descartado, no hace falta redondear. La publicación quedó como estaba.
- [x] **T-009** Permisos: módulo «Mercado Libre» en la matriz de permisos, en la navegación y en las pruebas de permisos.
  - Hecho cuando: el Dueño ve el ítem; un rol sin el permiso no lo ve; `permissions.test.ts` pasa con el módulo nuevo.
  - Hecho el 2026-11-16: fila «Mercado Libre» en la matriz (guardar un rol ya recorre todos los módulos del enum), ítem «Mercado Libre» → `/publicaciones` en el grupo de catálogo, migas «Mercado Libre» y «Vincular publicaciones», y pruebas en `permissions.test.ts` y `breadcrumbs.test.ts`.
- [x] **T-010** SKU en la ficha del producto: `createProduct` y `updateProduct`, y el campo en `product-form.tsx`. Con publicación vigente, el SKU se envía a Mercado Libre antes de guardar.
  - Hecho cuando: un SKU repetido (con otras mayúsculas) se rechaza con el mensaje del plan, y con Mercado Libre caído el cambio de SKU no se guarda.
  - Hecho el 2026-11-16: campo SKU en `product-form.tsx` y en `createProduct`/`updateProduct`, con verificación previa y, por si dos personas guardan a la vez, el rechazo de la base traducido al mismo mensaje. Con publicación vigente, el SKU se envía a Mercado Libre antes de guardar; si falla, «No se guardó ningún cambio» con el motivo. **Decisión nueva:** con publicación vigente el SKU se puede cambiar pero no borrar (Mercado Libre quedaría con uno y el sistema sin ninguno).
- [x] **T-011** Historial de precios con origen: `source` al crear filas y la columna en `/productos/[id]`, que muestra «Mercado Libre» cuando no hay usuario.
  - Hecho cuando: las filas existentes se ven igual que antes.
  - Hecho el 2026-11-16: `source` con `USER` por defecto (las filas viejas no cambian) y «Mercado Libre» en la tabla cuando no hay usuario.
- [x] **T-012** `price-sync.ts`: `markPricePending` dentro de las transacciones de `updateProduct` y `createStockEntry`, `pushPendingListings` con `after`, y pausa pendiente al desactivar un producto (`setProductActive`).
  - Hecho cuando: cambiar el precio de un producto vinculado lo cambia en Mercado Libre; con Mercado Libre caído el precio cambia igual en el sistema y queda marcado como pendiente.
  - Hecho el 2026-11-16: `src/lib/mercadolibre/listings.ts` (`markPricePending`, `markPausePending`, `pushPendingListings`, que borra la marca solo si nadie volvió a marcar mientras se enviaba). Enganchado en `updateProduct`, `createStockEntry` y `setProductActive`, con `after`. Verificado con la publicación de prueba (ver T-021).
- [x] **T-013** `linkListings` y `unlinkListing`, con sus verificaciones y la auditoría.
  - Hecho cuando: vincular deja la publicación con el precio, la cantidad y el SKU del sistema y crea la fila; deshacer la borra sin tocar Mercado Libre.
  - Hecho el 2026-11-16: `src/app/(app)/publicaciones/actions.ts` (`linkListings`, `unlinkListing`, `searchProductsForLink`) y `src/lib/mercadolibre/listings-view.ts` (conexión, datos de las pantallas y propuestas). Vincular vuelve a leer la publicación y el producto antes de enviar.
- [x] **T-014** `pauseListing`, `activateListing` y `closeListing`.
  - Hecho cuando: pausar y reactivar se reflejan en Mercado Libre y en la fila, y quedan en la auditoría.
  - Hecho el 2026-11-16: `pauseListing`, `activateListing` y `closeListing`. El estado propio se guarda antes de aplicar la lectura, para que no genere un aviso en la campanita. Reactivar con el producto desactivado se rechaza. Finalizar libera el producto en la misma transacción.
- [x] **T-015** Función de avisos para `items` e `items_prices` en `handlers.ts`, aviso `ML_PUBLICACION` en la campanita, y los dos pasos nuevos en la pasada diaria (envíos pendientes y relectura de las publicaciones vigentes).
  - Hecho cuando: un cambio de precio hecho en la web de Mercado Libre cambia el precio de venta y queda en el historial con origen «Mercado Libre»; los avisos de cambios propios no cambian nada.
  - Hecho el 2026-11-16: `items` e `items_prices` en `handlers.ts` (con `itemIdFromResource`, probado), aviso `ML_PUBLICACION`, y en `runMaintenance` los envíos pendientes y la relectura de las publicaciones vigentes. **Hallazgo:** un `pnpm dev` que ya estaba corriendo antes de la migración falla con `TypeError` (el cliente de Prisma viejo queda en memoria): hay que reiniciarlo después de cada migración. Anotado en `docs/entorno-local.md`.
- [x] **T-016** Reinicio del sistema: `ml_listings` en las tablas que se vacían, el conteo y el texto del aviso. Nota en la spec 017.
  - Hecho cuando: `system-reset.test.ts` pasa con la tabla nueva.
  - Hecho el 2026-11-16: `ml_listings` en las tablas que se vacían, conteo de publicaciones vinculadas y aviso en el resumen previo. Nota en la spec 017.

## Pantallas

- [x] **T-017** `/publicaciones`: tabla, filtro por estado, buscador, marcas de pendiente y de conflicto, aviso de publicaciones activas sin vincular, acciones según el permiso y «Reintentar envíos».
  - Hecho cuando: con la publicación de prueba vinculada se ve, se filtra, se busca por SKU y se pausa y reactiva desde ahí.
  - Hecho el 2026-11-16: `/publicaciones` con `listing-actions.tsx` (menú por fila, confirmación para finalizar y deshacer, «Reintentar envíos»). Las finalizadas solo se ven filtrando por ese estado. Falta verla en el navegador (T-021).
- [x] **T-018** `/publicaciones/vincular`: propuestas con el resumen de cambios, «Vincular» y «Vincular todas», vinculación a mano con buscador, y la lista de las que no se pueden vincular.
  - Hecho cuando: la publicación de prueba aparece propuesta para el producto con su SKU y se vincula desde ahí.
  - Hecho el 2026-11-16: `/publicaciones/vincular` con `link-view.tsx`. El resumen de cambios avisa también si la publicación va a quedar pausada sin stock. Falta verla en el navegador (T-021).
- [x] **T-019** Ficha del producto: estado de su publicación y enlace, si tiene.
  - Hecho cuando: se ve en el producto vinculado.
  - Hecho el 2026-11-16: estado, enlace y fecha de vínculo arriba de la ficha, para quien tiene «ver» en Mercado Libre.

## Documentación

- [x] **T-020** Notas en las specs que cambian: 002 (módulo Mercado Libre), 004 (SKU e historial con origen), 006 (el ingreso envía el precio) y 017 (reinicio). `docs/guia-mercado-libre.md` o una sección en la guía de uso, para el dueño.
  - Hecho cuando: cada spec tiene su nota con fecha.
  - Hecho el 2026-11-16: notas en las specs 002, 004, 006, 013 y 017, y `docs/guia-mercado-libre.md` (con lo que todavía no hace hasta las specs 021, 022 y 025).

## Cambios pedidos en la revisión del usuario

- [x] **T-022** Todo cambio que llega de Mercado Libre avisa en la campanita (RF-14, cambio 2026-11-16), y la pantalla de publicaciones se actualiza sola cada 60 segundos, al volver a la pestaña y con «Actualizar» (RF-14b).
  - Hecho cuando: un precio, un SKU o un cambio de estado hecho en Mercado Libre genera un aviso con el detalle; los cambios propios y las pausas por falta de stock no.
  - Hecho el 2026-11-16: `statusChangeNote` reemplaza a la regla anterior, y `reconcile` arma una sola frase por publicación con todo lo que cambió. Un conflicto de SKU ya señalado no vuelve a avisar. **Corregido de paso:** la pausa que manda el sistema al desactivar un producto se habría tomado como hecha en Mercado Libre; ahora se guarda el estado antes de aplicar la lectura. `auto-refresh.tsx` en la pantalla; por pedido del usuario, cada actualización (sola o con el botón) refresca también la campanita, con un evento que la campanita escucha. La campanita sigue consultando cada 60 segundos. 603 pruebas pasando. Verificado por el usuario el 2026-11-19.

- [x] **T-023** Publicaciones con una sola variante (cambio de spec aprobado el 2026-11-19).
  - Hecho cuando: la billetera de la cuenta de prueba (una variante) se vincula, y precio, cantidad y SKU se cambian en la variante.
  - Hecho el 2026-11-19 en el código: `mlVariationId` en `ml_listings` (migración `20261119230000_add_ml_listing_variation`), `readListing` toma de la variante precio, cantidad, SKU y códigos, `buildUpdateBody` (módulo puro, 3 pruebas) arma el cuerpo con la variante, y una publicación que pasa a tener dos o más variantes deja de recibir cambios y muestra el motivo. Probado contra la billetera: el código escribe en la variante sin cambiar nada. El usuario la vinculó y la usó en las pruebas de las specs 021 y 022 (cantidad y precio en la variante).

## Verificación final

- [x] **T-021** **(D)** Verificación manual con la publicación de prueba, siguiendo el plan, sección 6. Finalizar se prueba con una segunda publicación creada para eso.
  - Parte automática hecha el 2026-11-16, con un script contra la publicación de prueba y un producto de prueba que después se borró: 21 verificaciones bien (propuesta por SKU sin distinguir mayúsculas, resumen de cambios, vincular y no poder vincular dos veces, precio de la ficha a Mercado Libre, precio de Mercado Libre al sistema con historial de origen «Mercado Libre», aviso repetido sin efecto, envío pendiente que gana, SKU de Mercado Libre al producto, reactivar sin campanita, desactivar el producto pausa, no reactivar con el producto desactivado, deshacer el vínculo). La publicación quedó como estaba. **Falta la revisión del usuario en el navegador** y finalizar.
  - Hecha el 2026-11-19: el usuario vinculó el cable y un reloj por propuesta, cambió precios en los dos sentidos, pausó, reactivó y finalizó (el reloj), y revisó los avisos y la actualización de la pantalla. Un segundo script, de solo lectura, verificó filtros, búsqueda, el buscador para vincular a mano y que las seis acciones rechacen en el servidor a un usuario sin permiso.
- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas"). — Cada criterio dice cómo se probó. Sin poder probar con la cuenta: publicaciones con variantes y sin SKU (cubiertas por pruebas unitarias) y un corte real de Mercado Libre.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`). — 2026-11-19: 603 pruebas pasando, sin errores de tipos ni de linter, build de producción correcto con `/publicaciones` y `/publicaciones/vincular`.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-19)».
