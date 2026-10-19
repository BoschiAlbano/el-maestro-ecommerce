# Plan 008 — Ventas de mostrador y ticket

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`Sale`**: `id`, `ticketNumber` (`Int`, `@unique @default(autoincrement())` — correlativo simple, un solo puesto de caja), `shiftId` (FK `CashShift`, el turno en que se hizo la venta), `userId` (FK `User`, quien la hizo), `total` (`Decimal(12,2)`, redondeado al peso con `roundToPeso` — spec 001, sin uso hasta ahora), `createdAt`; `voidedAt` (`DateTime?`), `voidedByUserId` (`String?`), `voidReason` (`String?`). Una venta está anulada si `voidedAt` no es `null`.
- **`SaleItem`**: `id`, `saleId` (FK `Sale`, `onDelete: Cascade`), `productId` (FK `Product`), `quantity` (`Int`, positivo), `unitSalePrice` (`Decimal(12,2)`, foto del precio de venta en ese momento), `unitCost` (`Decimal(12,2)`, foto del precio de compra en ese momento — nunca se recalcula después, spec.md sección 5).
- **`TicketReprint`**: `id`, `saleId` (FK `Sale`, `onDelete: Cascade`), `userId`, `createdAt`. Una fila por cada reimpresión real (no la primera impresión al confirmar la venta — ver sección 3).
- **`StockMovement.saleId`** (`String?`, FK `Sale`) y **`CashMovement.saleId`** (`String?`, FK `Sale`): primer consumidor real de lo que las specs 005 y 007 dejaron pendiente ("se agrega cuando haga falta enlazar un movimiento a su origen"). Un campo directo (no `sourceType`/`sourceId` genérico): por ahora el único origen posible además de lo manual es una venta, y si en el futuro hace falta otro (spec 009, pedidos), se agrega su propio campo igual de directo — no se construye polimorfismo genérico para un caso que todavía no existe.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/ventas` | Punto de venta: buscar producto, carrito, cobrar, confirmar | Permiso "crear" en Ventas |
| `/ventas/[id]/ticket` | Ticket de 58 mm para imprimir (redirect automático al confirmar una venta) | Permiso "ver" en Ventas |
| `/ventas/historial` | Lista de ventas | Permiso "ver" en Ventas |
| `/ventas/historial/[id]` | Detalle (ítems, pagos, reimpresiones) con botones "Reimprimir" y "Anular" | Permiso "ver"; reimprimir exige además "reimprimir tickets"; anular exige "anular" + "anular ventas" |

## 3. Lógica de servidor

- `src/lib/sale.ts`: `computeSaleTotal(items)` — función pura: `quantity × unitSalePrice` de cada ítem, sumado y redondeado con `roundToPeso` (spec 001). `validatePayments(total, payments)` — pura: la suma de los montos de los pagos tiene que ser exactamente igual al total.
- `src/app/(app)/ventas/actions.ts`:
  - `searchProducts(query)` — busca por nombre o código (contiene, insensible a mayúsculas — mismo criterio que `/productos`), solo productos activos. De solo lectura.
  - `confirmSale(items, payments)` — exige "crear" en Ventas; rechaza si no hay caja abierta; vuelve a traer los productos de la base (nunca confía en el precio que mandó el cliente) para calcular `computeSaleTotal`; valida `validatePayments`. En **una sola transacción**: crea la `Sale` y sus `SaleItem` (con `unitSalePrice`/`unitCost` fotografiados de `Product` en ese momento), llama `registerStockMovement` por cada ítem (`type: "VENTA"`, cantidad negativa, `saleId`) y `registerCashMovement` por cada pago (`type: "INGRESO"`, concepto `"Venta #<ticketNumber>"`, `saleId`). Al final, `redirect` a `/ventas/<id>/ticket`.
  - `reprintTicket(saleId)` — exige "ver" + el permiso especial "reimprimir tickets"; crea una fila en `TicketReprint`.
  - `voidSale(saleId, reason)` — exige "anular" en Ventas + el permiso especial "anular ventas"; rechaza si la venta ya estaba anulada o si no hay caja abierta (el egreso de reversa necesita un turno abierto, aunque la venta original sea de un turno ya cerrado — spec.md, sección 5). En una transacción: marca `voidedAt`/`voidedByUserId`/`voidReason`; por cada `SaleItem`, `registerStockMovement` con `type: "VENTA"` y cantidad **positiva** (mismo tipo, signo invertido — así una futura suma de movimientos "VENTA" por producto ya da el neto real vendido, sin tener que filtrar anulaciones aparte); por cada `CashMovement` de tipo `INGRESO` enlazado a esa venta, `registerCashMovement` con `type: "EGRESO"`, mismo monto/medio/referencia, en el turno abierto actual.

## 4. Componentes

- `SaleForm` (cliente): input de búsqueda (nombre o código — un lector USB es, para el navegador, alguien tipeando rápido y apretando Enter, no necesita nada especial), resultados para agregar al carrito, tabla de carrito con cantidad editable y quitar, sección de pagos (agregar una o más líneas: medio, monto, referencia si es transferencia — mismo patrón que `CashMovementForm`, spec 007), total y el botón "Confirmar venta" (deshabilitado si los pagos no suman el total).
- `TicketView` (la pantalla de `/ventas/[id]/ticket`): layout angosto (`width: 58mm` en CSS de impresión, fuente monoespaciada, ~32 caracteres por línea — requisito no funcional de `docs/PROJECT.md` sección 7), con razón social (desde `Setting`, spec 003) y la leyenda fija. Un botón "Imprimir" (`window.print()`), sin librería de PDF, mismo criterio que etiquetas y el resumen de caja.
- `SaleHistoryTable` / detalle con los botones "Reimprimir" y "Anular" (este último con motivo obligatorio, mismo wizard simple que el cierre de caja).

### Rediseño de las pantallas (2026-10-19)

- `SaleForm` pasa a dos zonas (RF-9): buscador y carrito a la izquierda, resumen fijo con el total y *Cobrar* a la derecha (barra fija abajo en el celular). `searchProducts` devuelve además `stock` (RF-12) y, si la búsqueda es un código de barras exacto con un único resultado, el formulario lo agrega solo.
- `PaymentDialog` (modal, RF-10 y RF-11): reparto del cobro en una o más líneas, estado "completo / falta / sobra", efectivo recibido y vuelto. Funciones puras nuevas en `src/lib/sale.ts`, con tests: `computeChange(received, cashAmount)` y `computePaymentStatus(total, payments)`.
- `TicketDialog` (modal, RF-14; reemplaza a la pantalla `/ventas/[id]/ticket`, que se eliminó): carga los datos con la Server Action `getTicketData(saleId)` (exige "ver" en Ventas), arma el ticket como **texto plano monoespaciado** con `buildTicketLines` (`src/lib/ticket-lines.ts`, con tests; usa los helpers de `src/lib/ticket-texto.ts`: `MAX` = 24 caracteres por línea, `addCenter`, `addExtremes`, `formatoMonto`, etc.) y lo imprime con `window.print()` desde un iframe oculto que contiene solo ese texto — así no sale el resto de la pantalla. Se arma como texto porque las térmicas en modo "Generic / Text Only" ignoran el CSS (flex, bordes, alineación): cada línea se alinea con espacios. Si las líneas se cortan en la impresora real, se baja `MAX`; si sobra margen, se sube. `confirmSale` ya no redirige: devuelve el `saleId` y el formulario abre el modal.
- Período del historial (RF-15): `parseSalesPeriod` y `salesPeriodRange` (`src/lib/sales-history.ts`, con tests; reusan los helpers de fecha de Tucumán de `lib/analytics.ts`). El período viaja en la URL (`?periodo=turno|hoy|7dias|todas`) y la página filtra en el servidor: por `shiftId` del turno abierto, por rango de `createdAt`, o sin filtro, siempre con `take: 200`.
- `SaleHistoryTabs` (cliente) para el historial en pestañas y `SaleActions` con la anulación en una ventana modal (RF-13). Los componentes `StatCard` y `Panel` se comparten con Caja, Inicio y Analíticas (`src/components/stat-card.tsx`).

## 5. Permisos

Primer uso real del módulo `VENTAS` de la matriz y de los permisos especiales "anular ventas" y "reimprimir tickets" (los tres existen desde la spec 002, sin nada que los ejerciera).

## 6. Pruebas

- **Unitarias:** `computeSaleTotal` (suma y redondea correctamente, usa `roundToPeso` ya probado en spec 001) y `validatePayments` (acepta solo si la suma es exacta, rechaza de más o de menos).
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas"). Esta es la spec que la constitución marca como flujo crítico (regla 19) — igual se difiere, por la misma decisión de 2026-10-15 que aplica a todas las specs sin excepción.

## 7. Riesgos y decisiones

- **`StockMovement.saleId`/`CashMovement.saleId` como campos directos, no un `sourceType`/`sourceId` genérico.** Es la primera vez que un movimiento necesita enlazarse a su origen real (specs 005/007 lo dejaron pendiente a propósito). Un campo directo es más simple de consultar y tipar que un polimorfismo genérico, y por ahora el único origen posible es una venta; si la spec 009 (pedidos) necesita lo mismo, se agrega su propio campo de la misma forma.
- **La anulación de una venta reutiliza el mismo tipo de movimiento (`VENTA`) con el signo invertido**, en vez de un tipo nuevo como `DEVOLUCION`. Así, sumar los movimientos `VENTA` de un producto da directamente las unidades netas vendidas (ventas menos anulaciones), sin tener que acordarse de filtrar anulaciones en reportes futuros (spec 011).
- **El ticket se puede volver a ver/imprimir navegando directo a `/ventas/[id]/ticket` sin pasar por el botón "Reimprimir"**, sin que quede registrado. Se decidió no bloquear la vista del ticket detrás del permiso especial "reimprimir tickets" (solo el botón explícito lo exige) porque la vista también es el destino del redirect automático al confirmar una venta — bloquearla ahí rompería el flujo normal de cobro. Es una simplificación aceptada para una herramienta interna; si se vuelve un problema real, se resuelve marcando la venta como "ya impresa" la primera vez y exigiendo el permiso para cualquier vista posterior.
- **Sin modelo de "vuelto".** Ya decidido en `spec.md`, sección 10 — los pagos tienen que sumar exacto, el cambio físico no es un evento del sistema.
- **Bug transversal encontrado al armar el ticket: ninguna pantalla ocultaba la navegación al imprimir.** `AppShell` (el layout compartido por toda la app) no tenía ningún `print:hidden` — las etiquetas (spec 004) y el resumen de caja (spec 007) imprimían con el menú lateral/inferior y el header de "Importadora" arriba, algo que no se notó antes porque esas dos salen en hoja A4 (el margen de más no rompe nada a la vista). Para el ticket de 58 mm esto sí era un problema real: en una impresora térmica angosta, esa navegación de más arruina el ticket entero. Se corrigió en `AppShell` (`src/components/nav/app-shell.tsx`), agregando `print:hidden` a `SideNav`, `BottomNav` y el header — arregla las tres pantallas de una sola vez, no solo el ticket.
