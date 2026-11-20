# Plan 022 — Órdenes de Mercado Libre

> Cómo se construye lo que dice `spec.md`. Cada compra pagada de Mercado Libre se registra como una venta del canal Mercado Libre, sin caja y a nombre de un usuario «Sistema», con su descuento de stock por el camino de siempre (spec 005), que a su vez actualiza la cantidad en Mercado Libre (spec 021). Una tabla propia guarda lo que es de Mercado Libre: envío, fecha límite, lo que cobró, la etiqueta y el estado.

## 0. Prueba técnica

Primera ronda hecha el 2026-11-19; el detalle está en `prueba-tecnica.md`. Lo que define de este plan:

1. **Avisos:** llegan `orders_v2` (`/orders/{id}`) y `shipments` (`/shipments/{id}`). `orders_feedback` no hace falta.
2. **La orden trae** `status` (`paid`, `cancelled`), los ítems con `item.id`, `variation_id`, `seller_sku`, `quantity`, `unit_price` y `sale_fee` (por unidad), `total_amount` (solo productos), el comprador y `shipping.id`. Pagada = `status: paid`; `payments[]` trae también los intentos rechazados.
3. **El envío** trae `status` y `substatus` (`ready_to_ship` / `ready_to_print`, `shipped`, `delivered`, `not_delivered`, `cancelled`); la fecha límite de despacho sale de `/shipments/{id}/sla`; lo que paga el vendedor, de `/shipments/{id}/costs`.
4. **La etiqueta** solo viene en PDF A4 (o ZPL): el sistema recorta la etiqueta a 10 × 15 (sección 3.7).
5. **Una cancelación hecha por el vendedor con el motivo «sin stock» no repone la cantidad en Mercado Libre.** No importa: el sistema devuelve el stock y la spec 021 manda la cantidad.

6. **Carrito** (segunda ronda): una orden por producto con el mismo `pack_id` y un solo envío; `GET /packs/{id}` devuelve las órdenes y el envío. **Llega aviso de una sola de las órdenes**: siempre se lee el paquete entero.

## 1. Modelo de datos

**`Sale`, cambios**

| Campo | Cambio |
|---|---|
| `shiftId` | Pasa a ser opcional: una venta de Mercado Libre no tiene caja (constitución, regla 11). Las de mostrador y pedidos lo siguen teniendo siempre (lo garantiza el código que las crea). |
| `channel` | Nuevo, `SaleChannel` (`LOCAL` o `MERCADO_LIBRE`), por defecto `LOCAL`. Las ventas que ya existen quedan como `LOCAL`. «Local» agrupa mostrador y pedidos por encargo (spec, RF-22). |

**Tabla nueva `MercadoLibreOrder` → `ml_orders`.** Una fila por compra: una orden suelta o un paquete (carrito).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `mlKey` | `String @unique` | `pack:{pack_id}` o `order:{order_id}`. Garantiza en la base que una compra se registre una sola vez (RF-8). |
| `mlOrderIds` | `String[]` | Las órdenes de Mercado Libre que la forman. |
| `saleId` | `String? @unique` | La venta que se registró. |
| `status` | `MlOrderStatus` | `TO_PREPARE`, `READY_TO_SHIP`, `SHIPPED`, `DELIVERED`, `NOT_DELIVERED`, `CANCELLED` (RF-12). |
| `mlShipmentId` | `String?` | |
| `shipmentStatus`, `shipmentSubstatus` | `String?` | Lo que informa Mercado Libre, sin traducir. |
| `dispatchDeadline` | `DateTime?` | De `/shipments/{id}/sla` (RF-17). |
| `buyerNickname`, `receiverName` | `String`, `String?` | Lo mínimo para identificar el paquete. **La dirección, el teléfono y el documento no se guardan**: la etiqueta los trae (spec, sección 5: datos personales). |
| `destinationCity` | `String?` | Ciudad y provincia, para mostrar. |
| `total` | `Decimal` | Lo que pagó el comprador por los productos (sin el envío que cobra Mercado Libre). |
| `mlFee` | `Decimal` | Lo que cobró Mercado Libre: suma de `sale_fee × quantity` (RF-4). |
| `sellerShippingCost` | `Decimal` | Envío a cargo del vendedor, de `/shipments/{id}/costs`. |
| `net` | `Decimal` | `total − mlFee − sellerShippingCost`. |
| `outOfStock` | `Boolean` | Algún producto quedó con stock negativo al registrarla (RF-10b). |
| `fraudRisk` | `Boolean` | Mercado Libre la marcó con riesgo de fraude (RF-18). |
| `needsReview` | `String?` | Motivo para revisar: ítem sin vincular, devolución parcial (spec, sección 7). |
| `cancelReason` | `String?` | De `cancel_detail`, en español. |
| `cancelledAt`, `shippedAt`, `deliveredAt` | `DateTime?` | |
| `labelPrintedAt`, `labelPrintedByUserId` | | Última descarga de la etiqueta (RF-16). |
| `deadlineAlertedAt` | `DateTime?` | Para no repetir el aviso de despacho por vencer. |
| `mlCreatedAt` | `DateTime` | Fecha de la compra en Mercado Libre, guardada en UTC (constitución, regla 9). |
| `createdAt`, `updatedAt` | | |

Índices por `status` y por `dispatchDeadline`.

**Tabla nueva `MercadoLibreOrderItem` → `ml_order_items`**: `orderId`, `mlItemId`, `mlVariationId?`, `title`, `sku?`, `quantity`, `unitPrice`, `saleFee`, `productId?` (vacío si la publicación no estaba vinculada), `saleItemId? @unique`, `restockedQuantity Int @default(0)` (RF-20).

**Tabla nueva `MercadoLibreOrderEvent` → `ml_order_events`**: `orderId`, `status`, `detail?`, `at`. El historial de estados del detalle (RF-15).

**`Setting`, campo nuevo:** `mlOrdersStartDate DateTime?` (RF-9b). Va en la configuración y no en la conexión: sobrevive a una reconexión. Sin fecha cargada **no se registra ninguna compra**: es una decisión del día del arranque.

**Usuario «Sistema» (RF-7).** La migración crea un rol «Sistema» sin permisos y un usuario «Mercado Libre (automático)» inactivo (no puede iniciar sesión), con identificadores fijos. `systemUserId()` lo busca por su `authUserId` fijo. El reinicio del sistema (spec 017) lo conserva.

**Enums nuevos:** `SaleChannel`, `MlOrderStatus`.

**Enums que se amplían:**

- `NotificationType`: `ML_VENTA` (venta nueva), `ML_VENTA_SIN_STOCK` (RF-10b), `ML_CANCELACION` (RF-19, RF-20), `ML_FRAUDE` (RF-18).
- `AuditAction`: `ML_ORDER_RESTOCKED` (RF-20).

**Reinicio del sistema (spec 017):** `ml_orders`, `ml_order_items` y `ml_order_events` se suman a las tablas que se vacían; el usuario y el rol «Sistema» se conservan. `mlOrdersStartDate` se conserva con la configuración.

**Migraciones contra la base de la nube**, con copia previa y reiniciando `pnpm dev` después.

## 2. Rutas y pantallas

| Ruta | Qué es | Quién accede |
|---|---|---|
| `/ordenes` | Lista de órdenes (RF-11 a RF-14, RF-17). | «Ver» en Mercado Libre |
| `/ordenes/[id]` | Detalle (RF-15), etiqueta (RF-16) y «Reingresar al stock» (RF-20). | «Ver» en Mercado Libre |
| `GET /ordenes/[id]/etiqueta?formato=10x15\|a4` | La etiqueta en PDF (RF-16). | «Editar» en Mercado Libre |
| `/configuracion`, pestaña «Mercado Libre» | Fecha de inicio de las órdenes (RF-9b). | «Editar» en Configuración |
| `/analiticas` y sus exportaciones | Filtro Origen (RF-22 a RF-25). | Los de hoy |
| `/inicio` | Órdenes para preparar (RF-26). | «Ver» en Mercado Libre |
| `/ventas/historial` y su detalle | Las ventas de Mercado Libre aparecen con su canal y sin caja; no se pueden anular (RF-21). | Los de hoy |

Ítem «Órdenes» en la navegación, al lado de «Mercado Libre», con «ver» en Mercado Libre.

## 3. Lógica de servidor

Todo en `src/lib/mercadolibre/orders/`, con la regla de siempre: la decisión es pura y con pruebas; lo que toca red o base es una capa fina.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `order-read.ts` (pura) | Valida con `zod` la orden y el envío, y los traduce a lo que usa el sistema. |
| `order-status.ts` (pura) | `mapOrderStatus(order, shipment)` → estado del RF-12. `cancellationEffect(...)`: devolver el stock o no (RF-19, RF-20). Texto del motivo de cancelación. |
| `order-sale.ts` (pura) | `buildMlSale(orders, links)`: ítems de la venta (los vinculados), ítems sin vincular, total, lo que cobró Mercado Libre, neto. |
| `order-alerts.ts` (pura) | Órdenes que vencen en 4 horas y vencidas (RF-17). |
| `label.ts` | Recorta el PDF de Mercado Libre a 10 × 15 (sección 3.7). |
| `orders-api.ts` | Llamadas: orden, paquete, envío, plazo, costos, búsqueda y etiqueta. |
| `orders.ts` | Lo que toca la base: registrar, actualizar el estado, cancelar, reingresar. |

### 3.2 Registrar una compra (RF-1 a RF-10b)

`syncOrder(mlOrderId)`, desde el aviso `orders_v2` o desde la búsqueda (3.5):

1. Lee la orden. Si tiene `pack_id`, lee el paquete y todas sus órdenes: la compra es el paquete.
2. Si la compra es anterior a `mlOrdersStartDate`, o no hay fecha cargada, no hace nada (RF-9b).
3. Si ya existe la fila de `ml_orders` (por `mlKey`): actualiza el estado (3.3) y termina.
4. Si no está **pagada** (todas las órdenes del paquete con `status: paid`): no hace nada; la registrará el próximo aviso (RF-9).
5. Lee el envío, el plazo y los costos.
6. `buildMlSale` con los vínculos de `ml_listings` (por `mlItemId`).
7. **En una transacción** (constitución, regla 10): crea la venta (`channel: MERCADO_LIBRE`, sin caja, a nombre del usuario Sistema, con el total), sus ítems con el precio de Mercado Libre y el costo vigente del producto (regla 8), un movimiento de stock `VENTA` por cada ítem vinculado (`registerStockMovement`, que marca la cantidad para Mercado Libre), la fila de `ml_orders` con sus ítems y el primer evento, y los avisos: `ML_VENTA`, y `ML_VENTA_SIN_STOCK` si algún producto quedó negativo, y `ML_FRAUDE` si corresponde.
8. Después: `scheduleListingPush` (spec 021). La cantidad que se manda coincide con la que Mercado Libre ya descontó.

Si la fila ya la creó otro proceso en paralelo, la restricción única de `mlKey` hace fallar la transacción entera y no queda nada duplicado (RF-8): se toma como «ya registrada».

*(Agregado 2026-11-19, por un error encontrado en la revisión.)* Mercado Libre manda varios avisos del mismo cambio casi juntos y se procesan en paralelo. Todo cambio sobre una compra ya registrada (cancelación, estado, fraude, reingreso) se **reclama** con una actualización condicional a lo que se leyó: la base las ordena y solo la primera hace el cambio, el movimiento de stock y el aviso.

Un ítem de una publicación sin vincular se guarda en `ml_order_items` sin producto ni movimiento de stock, y la orden queda con `needsReview` (spec, sección 7). El total de la venta es igual el de la compra.

### 3.3 Estado y envío (RF-12, RF-17)

`mapOrderStatus`:

| Mercado Libre | Estado |
|---|---|
| Orden `cancelled` | Cancelada |
| Envío `delivered` | Entregada |
| Envío `not_delivered` | No entregada |
| Envío `shipped` | En camino |
| Envío `ready_to_ship` con etiqueta ya impresa (`printed`) | Lista para despachar |
| Envío `ready_to_ship` / `pending` / `handling` | Para preparar |

El aviso `shipments` busca la orden por `mlShipmentId` y la actualiza; `orders_v2` también actualiza si la fila ya existe. Cada cambio de estado agrega un evento. El plazo (`dispatchDeadline`) se vuelve a leer mientras la orden esté para preparar.

### 3.4 Cancelaciones (RF-19 a RF-21)

Cuando una compra registrada pasa a cancelada, `cancellationEffect`:

- **Antes de despachar** (nunca estuvo en camino: `shippedAt` vacío): en una transacción, anula la venta (a nombre del usuario Sistema, con el motivo de Mercado Libre) y registra un movimiento que devuelve el stock de cada ítem vinculado. Aviso `ML_CANCELACION`. Después, `scheduleListingPush`. **Pasa igual si el vendedor canceló con el motivo «sin stock»**: la venta se deshace entera; si de verdad no había unidades, el stock vuelve a quedar en lo que tenía antes de la compra.
- **Después de despachar** (o no entregada): la orden queda cancelada o no entregada, la venta se marca anulada para que no sume en analíticas, **sin** movimiento de stock, y aviso `ML_CANCELACION`. La mercadería vuelve por «Reingresar al stock».

**«Reingresar al stock» (RF-20):** Server Action con «editar» en Mercado Libre y el permiso especial «ajustar stock». Por ítem, hasta `quantity − restockedQuantity`. En una transacción: movimiento `AJUSTE` con el motivo «Devolución de Mercado Libre, compra N.º …», suma `restockedQuantity` y registra `ML_ORDER_RESTOCKED`.

**Anulación de mostrador (spec 008):** `voidSale` rechaza una venta con `channel: MERCADO_LIBRE` (RF-21), también llamada directo al servidor. En el detalle de la venta no aparece el botón.

**Devolución parcial** (un carrito donde se devuelve una parte): la orden queda con `needsReview` y no se toca el stock (spec, sección 7).

### 3.5 Buscar órdenes nuevas (RF-14)

`fetchRecentOrders()`: `GET /orders/search?seller={id}&order.date_created.from={max(inicio, hace 14 días)}&sort=date_desc`, por páginas, y `syncOrder` para las que no estén registradas o hayan cambiado. Se llama:

- al abrir `/ordenes`, como mucho una vez por minuto (se guarda la última búsqueda en la conexión);
- con el botón «Buscar órdenes nuevas»;
- en la pasada diaria, antes del control de stock (spec 021): así las ventas ya bajaron el stock cuando se comparan las cantidades;
- al reconectar la cuenta (spec 019, sección 7).

### 3.6 Avisos de despacho (RF-17, RF-18)

Calculados en cada consulta de la campanita, como los de la spec 021 (`LiveAlert`), sin guardar nada:

- «Hay N órdenes que vencen en menos de 4 horas» *(decisión del cliente)*.
- «Hay N órdenes con el despacho vencido».
- «Hay N órdenes con riesgo de fraude sin resolver».

Lo ven quienes tienen «ver» en Mercado Libre y llevan a `/ordenes`. Desaparecen solos cuando la orden se despacha o se cancela.

### 3.7 Etiqueta (RF-16, RF-18)

`GET /ordenes/[id]/etiqueta`, con «editar» en Mercado Libre:

1. Rechaza si la orden tiene riesgo de fraude, si no usa Mercado Envíos o si ya no está para preparar.
2. Pide `/shipment_labels?shipment_ids={id}&response_type=pdf`. Si Mercado Libre todavía no la tiene, responde con el mensaje para reintentar (spec, sección 7).
3. **10 × 15** (por defecto): con `pdf-lib` (dependencia nueva), toma la primera página, que es una hoja A4 apaisada con la etiqueta en la esquina superior izquierda, y la recorta a ese rectángulo, en una página de 10 × 15 cm. **A4**: el PDF tal cual, por si un día Mercado Libre cambia el diseño y el recorte deja de servir.
4. Guarda `labelPrintedAt` y quién la descargó, y agrega un evento.
5. Devuelve el PDF para abrirlo e imprimirlo en la 3nStar.

El rectángulo se mide con la etiqueta de la prueba técnica y queda como constante, con una prueba que compara contra ese PDF.

### 3.8 Analíticas, caja e inicio (RF-22 a RF-26)

- **Caja por turnos y caja del día (specs 007 y 014):** sus consultas de ventas filtran `channel: LOCAL`. Hoy la caja del día busca las ventas por fecha, sin caja, y sumaría las de Mercado Libre.
- **Analíticas (spec 011):** filtro Origen (Todas, Local, Mercado Libre) sobre `channel`. En medios de cobro, las de Mercado Libre aparecen como «Mercado Libre» (no tienen movimientos de caja). En ventas por empleado, el usuario Sistema se llama «Mercado Libre (automático)». El margen, para quien tiene «ver costos y márgenes», descuenta `mlFee` y `sellerShippingCost` (RF-24). Las exportaciones suman una columna Origen.
- **Historial de ventas:** las de Mercado Libre muestran «Mercado Libre» en lugar de la caja, con enlace a la orden.
- **Inicio (spec 012):** tarjeta «Órdenes para preparar» con la cantidad y enlace a `/ordenes`. La tarjeta de ventas del día muestra el total y, debajo, **Local** y **Mercado Libre** por separado *(decisión del usuario, 2026-11-19)*.

### 3.9 Avisos de Mercado Libre

`handlers.ts` suma `orders_v2` → `syncOrder` y `shipments` → `syncShipment`. Como en la 020 y la 021, cada función lee el recurso y nunca usa el aviso como dato, y correrla dos veces no duplica nada.

## 4. Componentes

- **`/ordenes`**: pestañas o filtro por estado (abre en «Para preparar»), filtro por fecha, orden por fecha límite. Columnas: número, fecha, comprador, productos y cantidades, total, estado, fecha límite (destacada si vence en menos de 4 horas o venció), marcas «Sin stock», «Riesgo de fraude», «Revisar». Botón «Buscar órdenes nuevas». Se actualiza sola cada 60 segundos, como la pantalla de publicaciones.
- **`/ordenes/[id]`**: ítems (con enlace al producto o «sin vincular»), importes (total, lo que cobró Mercado Libre, envío a cargo del vendedor, neto), destino y nombre de quien recibe, historial de estados, enlace a la venta en Mercado Libre y a la venta del sistema. Botones «Etiqueta 10 × 15» y «Etiqueta en hoja A4», con la última descarga. Advertencia de fraude. «Reingresar al stock» con cantidades por ítem.
- **Configuración > Mercado Libre**: campo «Registrar compras desde», con la explicación de RF-9b.
- **Campanita**: los cuatro tipos nuevos (`notification-types.ts`, «ver» en Mercado Libre, enlace a la orden) y los avisos calculados de 3.6.
- **Analíticas**: el filtro Origen y lo de 3.8.

## 5. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Ver órdenes y su detalle | `requirePermission(MERCADO_LIBRE, "ver")` | `/ordenes`, `/ordenes/[id]` |
| Buscar órdenes nuevas | `requirePermission(MERCADO_LIBRE, "ver")` | `fetchOrdersNow` |
| Descargar la etiqueta | `requirePermission(MERCADO_LIBRE, "editar")` | Route Handler de la etiqueta |
| Reingresar al stock | `requirePermission(MERCADO_LIBRE, "editar")` + `requireSpecialPermission("ajustarStock")` | `restockOrder` |
| Ver el margen | `hasSpecialPermission("verCostosMargenes")` | Analíticas, detalle |
| Avisos de órdenes | «Ver» en Mercado Libre | `notification-types.ts`, avisos calculados |
| Fecha de inicio | `requirePermission(CONFIGURACION, "editar")` | Configuración |
| Lo que llega de Mercado Libre | Sin sesión: la cola de la 019 | `handlers.ts` |

## 6. Pruebas

**Unitarias (Vitest):**

- `order-read`: la orden y el envío reales de la prueba técnica (recortados, sin datos personales), pagada, cancelada, con paquete.
- `order-status`: la tabla de 3.3; cancelación antes y después del despacho.
- `order-sale`: una orden, un carrito, un ítem sin vincular, una variante; lo que cobró Mercado Libre y el neto.
- `order-alerts`: vence en 4 horas, vencida, ya despachada.
- `label`: recortar el PDF de la prueba técnica da una página de 10 × 15.
- Filtro Origen y margen con lo que cobra Mercado Libre en `analytics.ts`.
- Reinicio con las tablas nuevas.

**Manuales, con las cuentas de prueba** (se documentan en `tasks.md`): una compra baja el stock y la venta aparece sin caja; un carrito queda como una sola venta; el aviso repetido no duplica; la etiqueta se imprime en 10 × 15; cancelar antes del despacho devuelve el stock y la cantidad en Mercado Libre; «Buscar órdenes nuevas» registra una compra con la ruta de avisos apagada; analíticas con el filtro; caja sin las ventas de Mercado Libre. Despachar, entregar y la cancelación después del despacho no se pueden provocar con cuentas de prueba: se prueban con pruebas unitarias.

**E2E:** pendiente para la pasada de endurecimiento.

## 7. Riesgos y decisiones

1. **`shiftId` opcional en `Sale`.** Ningún código de mostrador puede crear una venta sin caja por error: `confirmSale` y la entrega de pedidos siguen exigiendo una caja abierta antes de crearla. Se suma una prueba de eso.
2. **Datos personales.** Se guarda lo mínimo (apodo, nombre de quien recibe, ciudad). La dirección y el teléfono solo viajan en la etiqueta, que no se guarda. La spec 024 (factura) puede necesitar el documento del comprador: se decide ahí.
3. **El recorte de la etiqueta depende del diseño de Mercado Libre.** Si cambia, el botón A4 sigue funcionando y la prueba del recorte avisa al actualizar.
4. **Despachar, entregar y no entregar no se pueden probar** con cuentas de prueba. Los estados se toman de la documentación y se verifican con pruebas unitarias; la primera venta real del cliente es la verificación final.
5. **Plan gratuito:** la búsqueda de órdenes al abrir la pantalla compensa los avisos que se pierdan hasta la pasada diaria (spec, sección 5).
6. **Ventas del día en el inicio:** una sola tarjeta con el total y el detalle Local y Mercado Libre *(decisión del usuario, 2026-11-19)*.
7. **`pdf-lib`** 1.17.1 es una dependencia nueva *(aprobada por el usuario, 2026-11-19)*, para recortar el PDF del lado del servidor. *(Corregido al instalarla: trae cuatro dependencias chicas — `pako`, `tslib`, `@pdf-lib/standard-fonts` y `@pdf-lib/upng` —, no ninguna.)*

## 8. Preguntas abiertas

Ninguna. El carrito se confirmó en la segunda ronda de la prueba técnica (sección 0, punto 6).
