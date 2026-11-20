# Plan 021 — Sincronización de stock con Mercado Libre

> Cómo se construye lo que dice `spec.md`. Se apoya casi entero en lo que dejó la spec 020: la tabla `ml_listings`, la bandeja de envíos (`pushPendingListings`), la conciliación de lo que llega de Mercado Libre (`reconcile`) y la pasada diaria. Esta spec le suma la cantidad a esa misma maquinaria.

## 0. Prueba técnica

Hecha el 2026-11-19; el detalle está en `prueba-tecnica.md`. Lo que define de este plan:

1. **La cantidad va por `PUT /items/{id}` con `available_quantity`**, igual que el precio y la pausa. No hace falta la API de stock del producto ni su número de versión.
2. **Mercado Libre pausa sola con 0 y reactiva sola al volver el stock**, salvo que la haya pausado el vendedor. El sistema solo manda el número.
3. **Los cambios de cantidad llegan como `items`**, que ya se procesa. El tema `stock-locations` no hace falta.
4. **Se corrigió un error de la 020** en el estado «pausada por el vendedor y sin stock» (`listing-status.ts`).

## 1. Modelo de datos

**`MercadoLibreListing`, campos nuevos**

| Campo | Tipo | Nota |
|---|---|---|
| `quantityPendingSince` | `DateTime?` | Hay una cantidad del sistema que todavía no llegó a Mercado Libre (RF-6). Mismo criterio que `pricePendingSince`. |
| `lastKnownQuantity` | `Int?` | Última cantidad leída de Mercado Libre o enviada (RF-10). Vacío en las filas que ya existen hasta la primera lectura. |
| `lastQuantitySyncAt` | `DateTime?` | Último envío o control de cantidad que terminó bien. |

Índice por `quantityPendingSince`.

**Sin tablas ni enums nuevos.** Sin cambios en el reinicio del sistema: `ml_listings` ya se vacía (spec 020).

**Migración contra la base de la nube**, con copia previa de las tablas y **reiniciando `pnpm dev` después** (`docs/entorno-local.md`).

## 2. Rutas y pantallas

| Ruta | Cambio |
|---|---|
| `/publicaciones` | Columna «En Mercado Libre» (cantidad publicada) al lado de «Stock», marca «Cantidad pendiente de enviar», y el botón «Sincronizar ahora» en lugar de «Reintentar envíos» (RF-9, RF-10). |
| Campanita | Un aviso calculado en vivo, no guardado: «Hay N publicaciones con cambios sin enviar a Mercado Libre» (RF-7). |

No hay rutas nuevas.

## 3. Lógica de servidor

### 3.1 Marcar la cantidad pendiente (RF-3)

`registerStockMovement` (`src/lib/stock.ts`) es el único camino para cambiar el stock (spec 005): por ahí pasan la venta, la anulación, la entrega de pedido, el ingreso, el ajuste, la merma, el conteo y el stock inicial al crear un producto. **Dentro de la misma transacción** que crea el movimiento, marca `quantityPendingSince` en la publicación vigente del producto (`updateMany` por `linkedProductId`). Así ningún movimiento se puede olvidar de avisar, y si la transacción falla no queda nada marcado.

El tipo `StockTx` suma `mercadoLibreListing.updateMany`; las pruebas de `stock.test.ts` agregan ese mock.

### 3.2 Enviar (RF-4 a RF-6)

**`pushPendingListings`** (spec 020) suma la cantidad: si la publicación tiene `quantityPendingSince`, el `PUT` lleva `available_quantity = publishableQuantity(stock actual)`. Lee el stock **en el momento del envío**, así dos movimientos seguidos mandan el último valor (RF-5). Precio, pausa y cantidad pendientes van en una sola llamada. La marca se borra solo si nadie volvió a marcar mientras se enviaba (como ya hace con el precio), y se guardan `lastKnownQuantity` y `lastQuantitySyncAt`.

**Disparar el envío sin demorar la operación:** cada una de las siete acciones que mueven stock llama, después de su transacción, a `scheduleListingPush(productIds)`, que hace `after(() => pushPendingListingsSafely({ productIds }))`. Un solo `after` por acción: una venta de diez productos manda los diez juntos, no diez veces.

`scheduleListingPush` no lanza nunca. Si alguna acción futura se olvida de llamarla, la marca de 3.1 igual queda, y la recogen los reintentos.

**Reintentos (RF-6)**, sin cambios respecto de la 020: el próximo movimiento del producto, el próximo aviso de Mercado Libre de esa publicación, la pasada diaria y «Sincronizar ahora».

### 3.3 Lo que llega de Mercado Libre (RF-11)

`reconcile` (spec 020) suma la cantidad, con un parámetro nuevo `mode`: `"notification"` (aviso de Mercado Libre) o `"control"` (control completo).

| Cantidad en Mercado Libre, contra la que corresponde | Aviso (`notification`) | Control (`control`) |
|---|---|---|
| Igual | Nada (incluye el aviso de un envío propio). | Nada. |
| **Más** | Se marca pendiente y se envía. | Se marca pendiente y se envía. |
| **Menos** | **Nada por ahora**: puede ser una venta de Mercado Libre que la spec 022 todavía no registró. | Se marca pendiente y se envía: manda el sistema. |
| Distinta, con un envío propio pendiente | Se envía el propio. | Se envía el propio. |

Siempre se guarda `lastKnownQuantity` con lo leído. Los cambios de cantidad no generan aviso en la campanita (spec, sección 5).

En una publicación finalizada no se envía nada (como hoy con el precio).

### 3.4 Control completo (RF-8, RF-9)

**`syncAllListings()`** en `listings.ts`:

1. `pushPendingListings()`: lo pendiente primero.
2. Lee todas las publicaciones vigentes de a 20 (`getListings`) y aplica `reconcile` en modo `"control"`.
3. Envía lo que haya quedado marcado.
4. Devuelve `{ revisadas, corregidas, fallaron: [{ título, motivo }] }`.

**Pasada diaria (`runMaintenance`):** reemplaza los dos pasos que agregó la 020 por `syncAllListings()`. Va **después** de procesar los avisos, para que cuando exista la 022 las órdenes ya hayan bajado el stock antes de comparar.

**Server Action `syncListingsNow`** («Sincronizar ahora»): `requirePermission(MERCADO_LIBRE, "editar")`, conexión vigente, `syncAllListings()` y el resumen en un mensaje. Reemplaza a `retryPendingSync` de la 020.

**Al reconectar la cuenta (spec 019):** el retorno de la autorización agenda `syncAllListings()` con `after`, para corregir lo que haya quedado mientras estaba desconectada (spec, sección 7).

### 3.5 Aviso de pendientes en la campanita (RF-7)

Calculado en cada consulta de la campanita, igual que los avisos de facturación (`LiveAlert`): cuenta las publicaciones vigentes con alguna marca pendiente (precio, pausa o cantidad) **de hace más de 2 minutos**. El margen evita que el aviso aparezca y desaparezca en cada envío normal, que tarda segundos. Lo ven quienes tienen «ver» en Mercado Libre, y lleva a `/publicaciones`.

## 4. Componentes

- **`/publicaciones`**: columna «En Mercado Libre» con `lastKnownQuantity` (o «—» si todavía no se leyó), en rojo si es distinta del stock y no hay nada pendiente; marca «Cantidad pendiente de enviar» con el último error; botón «Sincronizar ahora» siempre visible para quien tiene «editar» (no solo con pendientes), con el resumen en un mensaje.
- **`listing-actions.tsx`**: `RetryPendingButton` pasa a ser `SyncNowButton`.
- **`notifications-data.ts`**: el aviso de 3.5.

## 5. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Ver la cantidad publicada | `hasPermission(MERCADO_LIBRE, "ver")` | `/publicaciones` (ya existe) |
| Sincronizar ahora | `requirePermission(MERCADO_LIBRE, "editar")` | `syncListingsNow` |
| Aviso de pendientes | `hasPermission(MERCADO_LIBRE, "ver")` | `notifications-data.ts` |
| Envío automático | Ninguna: no depende de quien movió el stock (spec, sección 6) | `registerStockMovement` y `after` |

## 6. Pruebas

**Unitarias (Vitest):**

- `publishableQuantity`: ya cubierta en la 020 (negativo, cero). Se quita el parámetro de reserva.
- `reconcile`: la tabla de 3.3 completa, en los dos modos.
- `registerStockMovement`: marca la publicación del producto en la misma transacción.
- El aviso de pendientes: con marcas recientes no avisa; con marcas de más de 2 minutos, sí; sin permiso, no.

**Manuales, con la publicación de prueba** (se documentan en `tasks.md`):

- Venta de mostrador, anulación, ingreso, ajuste, merma, conteo y entrega de pedido de un producto vinculado: la cantidad cambia en Mercado Libre.
- Llevar el stock a 0: queda pausada sin stock; ingresar mercadería: se reactiva sola. Pausada por el dueño: no se reactiva.
- Subir la cantidad a mano en Mercado Libre: se corrige al llegar el aviso. Bajarla: no se corrige hasta «Sincronizar ahora».
- Con Mercado Libre sin conexión: la venta se confirma, queda pendiente y aparece el aviso en la campanita.

**E2E:** pendiente para la pasada de endurecimiento.

## 7. Riesgos y decisiones

1. **Muchos productos a la vez** (un conteo grande). Un `PUT` tarda medio segundo, y la función de Vercel tiene un límite de tiempo, también para lo que corre con `after`. Se envían de a 5 en paralelo. Lo que no llegue a enviarse queda marcado y lo toman los reintentos. No se pierde nada, pero la cantidad puede tardar en corregirse.
2. **Marcar dentro de `registerStockMovement`** suma una escritura a cada movimiento de stock, aunque el producto no tenga publicación (el `updateMany` no encuentra filas). Es una consulta chica y se acepta para no depender de que cada acción se acuerde.
3. **Venta en Mercado Libre antes de la 022** (spec, sección 5): el control diario volvería a subir la cantidad. Es una regla de uso, no se resuelve con código hasta la 022.
4. **El aviso de un envío propio puede llegar antes de que se borre la marca.** `reconcile` ve la marca y vuelve a enviar el mismo valor. No cambia nada (RF-5), solo es una llamada de más.
5. **`publishableQuantity` pierde el parámetro de reserva** que tenía en la 020 (decisión del cliente: sin reserva). Si un día se agrega la reserva, se vuelve a sumar ahí y en ningún otro lado.

## 8. Preguntas abiertas

Ninguna.
