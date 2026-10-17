# Plan 009 — Pedidos por encargo

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`OrderStatus`** (enum): `PENDIENTE`, `CERRADO`, `CANCELADO`.
- **`Order`**: `id`, `customerName`, `customerPhone` (`String?`), `channel` (`String?`, texto libre — igual criterio que el proveedor de la spec 006, sin una entidad propia), `status` (default `PENDIENTE`), `userId` (quien lo creó), `createdAt`.
  - Seña (como mucho una por pedido, en un solo pago — spec.md, sección 10): `depositAmount` (`Decimal`, default 0), `depositPaymentMethod` (`PaymentMethod?`), `depositTransferReference` (`String?`), `depositPaidAt` (`DateTime?`).
  - `depositApplied` (`Decimal`, default 0): cuánto de la seña ya se usó en entregas anteriores. `depositAmount - depositApplied` es el saldo a favor que se muestra en pantalla y en el ticket.
  - Cierre/cancelación: `closedAt` (`DateTime?`), `cancelledAt` (`DateTime?`), `cancelledByUserId` (`String?`), `cancelReason` (`String?`, obligatorio en la Server Action siempre que se cancela, haya o no seña de por medio — mismo criterio que anular una venta, spec 008, no el de "solo si hay diferencia" de cerrar caja).
- **`OrderItem`**: `id`, `orderId` (FK `Order`, `onDelete: Cascade`), `productId` (FK `Product`), `quantityOrdered` (`Int`), `quantityDelivered` (`Int`, default 0). Pendiente de esa línea = `quantityOrdered - quantityDelivered`.
- **`Sale.orderId`** (`String?`, FK `Order`) y **`Sale.depositApplied`** (`Decimal?`): toda entrega de un pedido genera una `Sale` común (spec 008) con estos dos campos de más — así el ticket de esa venta puede mostrar cuánto se descontó de la seña sin necesitar una tabla aparte.
- **`CashMovement.orderId`** (`String?`, FK `Order`): la seña (INGRESO) y, si corresponde, su devolución al cancelar (EGRESO) quedan enlazadas al pedido — mismo patrón que `saleId` (spec 008), ahora con un segundo consumidor real.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/pedidos` | Historial de pedidos | Permiso "ver" en Pedidos |
| `/pedidos/nuevo` | Alta de pedido (cliente + ítems) | Permiso "crear" en Pedidos |
| `/pedidos/[id]` | Detalle: ítems (pendiente/entregado), seña, agregar/quitar ítem, entregar, cancelar | Ver: "ver". Agregar/quitar ítem y cobrar seña: "crear". Entregar: "crear" en Pedidos + "crear" en Ventas. Cancelar: "anular". |

El ticket de una entrega reutiliza `/ventas/[id]/ticket` (spec 008), con una sección nueva que aparece solo si `sale.orderId` no es `null`.

## 3. Lógica de servidor

- `src/lib/order.ts`:
  - `computeDepositApplication(remainingDeposit, saleTotal)` — función **pura**: `depositApplied = min(remainingDeposit, saleTotal)`, `amountToCollect = saleTotal - depositApplied`. Esto es lo que RF-4 describe en números.
  - `computeCommittedQuantities(items)` — función pura: de una lista de `{ productId, quantityOrdered, quantityDelivered }` (de pedidos pendientes), devuelve cuánto está comprometido por producto (ignora líneas ya completas).
- `src/app/(app)/pedidos/actions.ts`:
  - `createOrder(customerName, customerPhone, channel, items)` — exige "crear" en Pedidos; crea `Order` + `OrderItem` en una transacción. Sin seña en este paso (RF-1: la seña nunca es obligatoria, ni siquiera al crear).
  - `addOrderItem(orderId, productId, quantity)` / `removeOrderItem(orderItemId)` — exige "crear" en Pedidos; rechaza si el pedido no está `PENDIENTE`.
  - `payDeposit(orderId, amount, method, transferReference?)` — exige "crear" en Pedidos; rechaza si ya tiene una seña (`depositAmount > 0`) o si no hay caja abierta; llama `registerCashMovement` (`type: "INGRESO"`, `orderId`) y guarda los campos de seña en `Order`.
  - `deliverOrderItems(orderId, items, extraPayments)` — exige "crear" en Pedidos + "crear" en Ventas; rechaza sin caja abierta o si algún ítem pide más de lo pendiente. Calcula `computeSaleTotal` (spec 008) sobre los ítems a entregar, `computeDepositApplication` contra `depositAmount - depositApplied`, y exige que `extraPayments` sume exacto `amountToCollect` (`validatePayments`, spec 008). En una transacción: crea la `Sale` (con `orderId`, `depositApplied`) y sus `SaleItem`, `registerStockMovement` por ítem, `registerCashMovement` solo por los pagos nuevos (la parte cubierta por la seña no genera un movimiento nuevo — esa plata ya entró cuando se cobró la seña), suma `quantityDelivered` en cada `OrderItem`, suma `depositApplied` en `Order`, y si ya no queda nada pendiente en ningún ítem, marca `Order.status = "CERRADO"`. Redirige al ticket de la venta creada.
  - `cancelOrder(orderId, reason)` — exige "anular" en Pedidos; rechaza si el pedido no está `PENDIENTE`; motivo siempre obligatorio. Si `depositAmount - depositApplied > 0`, exige caja abierta y genera el egreso (`registerCashMovement`, mismo medio/referencia que la seña original); si no queda nada de seña (o nunca hubo), cancela directo sin pedir caja abierta — no hay ninguna operación de caja que hacer.
- `src/app/(app)/ventas/[id]/ticket/page.tsx` (spec 008): se le agrega una sección condicional — si `sale.orderId`, muestra "Seña aplicada: $X" y "Saldo a favor del pedido: $Y" (`order.depositAmount - order.depositApplied`, ya actualizado).
- `/inventario` (spec 005): columna "Comprometido" usando `computeCommittedQuantities` sobre los `OrderItem` de pedidos `PENDIENTE` (una sola consulta, reducido en JS — mismo criterio de escala que "bajo stock").

## 4. Componentes

- `OrderForm` (alta): cliente + lista de ítems (mismo patrón de búsqueda de producto que `SaleForm`, spec 008, sin cobro todavía).
- `OrderItemsEditor` (en el detalle): agregar/quitar ítems mientras está pendiente.
- `DepositForm`: monto, medio de pago, referencia si es transferencia — se oculta si el pedido ya tiene una seña cobrada.
- `DeliverForm`: elegir cuánto entregar de cada ítem pendiente (no más de lo que queda), muestra el total, cuánto cubre la seña y cuánto hay que cobrar aparte (con el mismo armado de pagos que `SaleForm`) solo si `amountToCollect > 0`.
- `CancelOrderForm`: motivo obligatorio, mismo wizard simple que anular una venta (spec 008).

## 5. Permisos

Primer uso real del módulo `PEDIDOS` de la matriz (existe desde la spec 002, sin nada que lo ejerciera). Entregar combina dos módulos a la vez ("crear" en Pedidos y en Ventas) porque genera una venta de verdad — alguien con permiso de pedidos pero no de ventas no debería poder generar tickets.

## 6. Pruebas

- **Unitarias:** `computeDepositApplication` (seña cubre todo, cubre parte, no hay seña, seña ya se usó toda) y `computeCommittedQuantities` (suma bien, ignora líneas completas, ignora pedidos sin ítems pendientes).
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas").

## 7. Riesgos y decisiones

- **La seña vive como campos directos en `Order`, no como un registro aparte.** Como mucho hay una seña por pedido (spec.md, sección 10), así que no hace falta una tabla — `depositAmount`/`depositApplied` alcanzan. El `CashMovement` real (para que la caja la vea) se crea una sola vez, al cobrarla.
- **La porción de una entrega cubierta por la seña no genera un `CashMovement` nuevo.** Ese dinero ya entró a la caja cuando se cobró la seña; registrarlo de nuevo al entregar duplicaría el ingreso. Solo lo que se cobra de más en esa entrega (`amountToCollect`) genera movimientos nuevos.
- **Cancelar un pedido sin seña pendiente no exige caja abierta.** Si no hay plata que mover, no tiene sentido bloquear la cancelación por algo que no le hace falta a la operación.
- **`cancelReason` siempre obligatorio**, a diferencia de la diferencia de caja (spec 007, que solo pide motivo si hay diferencia). Cancelar un pedido es una decisión en sí misma, no la corrección de una discrepancia — se trata más parecido a anular una venta (spec 008, motivo siempre obligatorio).
