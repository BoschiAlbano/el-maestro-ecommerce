# Tareas 022 — Órdenes de Mercado Libre

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (cuentas de prueba o revisión manual); el resto se hace en el código.

## Preparación

- [x] **T-001** **(D)** Prueba técnica (plan, sección 0) con las cuentas de prueba vendedora y compradora.
  - Hecho cuando: cada punto tiene resultado en `prueba-tecnica.md` y el plan lo tiene en cuenta.
  - Hecha el 2026-11-19, en dos rondas: una compra, su cancelación y un carrito de dos productos. Confirmó el paquete, la fecha límite (`/sla`), lo que cobra Mercado Libre (`sale_fee`) y que la etiqueta viene en A4.

## Base de datos

- [x] **T-002** Migración: `shiftId` opcional y `channel` en `sales`; tablas `ml_orders`, `ml_order_items` y `ml_order_events`; `mlOrdersStartDate` en `settings`; enums `SaleChannel` y `MlOrderStatus`; valores nuevos de `NotificationType` y `AuditAction`; rol y usuario «Sistema». Copia previa de las tablas.
  - Hecho cuando: aplica en la base de la nube, sin diferencias con el esquema, y la base rechaza un `mlKey` repetido.
  - Hecho el 2026-11-19: `prisma/migrations/20261120000000_add_ml_orders`, aplicada en la base de la nube, sin diferencias con el esquema y con copia previa. Probado en una transacción deshecha: `mlKey` repetido rechazado y venta de Mercado Libre sin caja aceptada. La relación de la venta con la caja mantiene `onDelete: Restrict`. Rol «Sistema» y usuario «Mercado Libre (automático)» inactivo, con identificadores fijos. Arreglos para compilar: el historial de ventas y analíticas aceptan ventas sin caja, y los cuatro avisos nuevos ya tienen su permiso.

## Lógica pura (con pruebas)

- [x] **T-003** `order-read.ts` y `order-status.ts`: leer orden, paquete y envío; estado del RF-12; efecto de una cancelación.
  - Hecho cuando: Vitest cubre las órdenes reales de la prueba técnica (recortadas, sin datos personales) y la tabla del plan, sección 3.3.
  - Hecho el 2026-11-19: `orders/order-read.ts` y `orders/order-status.ts`, con siete órdenes y envíos reales de la prueba técnica en `orders/__fixtures__` (sin dirección ni nombre real). 24 pruebas. El riesgo de fraude se detecta por las etiquetas `fraud_risk_detected` o `fraud_risk` de la orden: no se pudo ver una real.
- [x] **T-004** `order-sale.ts` y `order-alerts.ts`: la venta desde una orden o un paquete (ítems vinculados y sin vincular, total, lo que cobra Mercado Libre, neto) y los avisos de despacho.
  - Hecho cuando: Vitest cubre una orden, el carrito de la prueba, un ítem sin vincular, y vence en 4 horas, vencida y despachada.
  - Hecho el 2026-11-19: `orders/order-sale.ts` (venta, pagada, cancelada entera o en parte, antes de la fecha de inicio) y `orders/order-alerts.ts`. 14 pruebas.

## Servidor

- [x] **T-005** `orders-api.ts` y `syncOrder`: registrar la compra en una transacción, actualizar el estado y el envío, y los avisos `orders_v2` y `shipments` en `handlers.ts`.
  - Hecho cuando: el carrito de la prueba se registra como una venta, baja el stock de los dos productos y el aviso repetido no duplica.
  - Hecho el 2026-11-19: `orders/orders-api.ts`, `orders/orders.ts` (`syncOrder`, `syncShipment`, `fetchRecentOrders`, `restockOrder`) y `orders/system-user.ts`; avisos `orders_v2` y `shipments` en `handlers.ts`; la pasada diaria busca órdenes antes del control de stock; al reconectar, también. Probado con el carrito real (fecha de inicio de desarrollo: 19/11/2026): una venta de Mercado Libre sin caja con los dos productos, total 7.500, cobró 3.835, neto 3.665, stock de los dos en 0, aviso de venta nueva; la segunda búsqueda no registró nada. La compra cancelada no entró. La venta toma la fecha de la compra en Mercado Libre.
- [x] **T-006** Cancelaciones, «Reingresar al stock» y el rechazo de `voidSale` para ventas de Mercado Libre.
  - Hecho cuando: Vitest cubre la decisión; una compra cancelada antes del despacho anula la venta y devuelve el stock.
  - Hecho el 2026-11-19: `cancelPurchase` en `orders.ts` (antes del despacho anula la venta y devuelve el stock; después, la anula sin tocar el stock), «Reingresar al stock» con su límite por ítem y su auditoría, y `voidSale` rechaza las ventas de Mercado Libre. La decisión tiene pruebas (`cancellationEffect`); el flujo completo se prueba en T-016 cancelando una compra.
  - **Error encontrado en la revisión del usuario (2026-11-19) y corregido:** Mercado Libre mandó tres avisos de la misma cancelación en el mismo segundo, se procesaron en paralelo y el stock se devolvió tres veces (y llegaron tres avisos). Ahora la cancelación, los cambios de estado, el aviso de fraude y «Reingresar al stock» se reclaman con una actualización condicional (`updateMany` con la condición de lo leído): la base las ordena y solo la primera hace el cambio. Se repararon los datos de la prueba y se volvió a procesar la cancelación tres veces en paralelo: una sola devolución, un evento, un aviso, stock en 1 y Mercado Libre en 1.
  - **Error encontrado en la prueba técnica de la spec 024 (2026-11-20) y corregido:** Mercado Libre canceló primero el envío y un momento después la orden; el sistema marcó la compra como cancelada por el envío y no procesó la cancelación de la orden (venta sin anular, stock sin volver). Ahora un envío cancelado solo no cambia el estado, la cancelación se reclama por `cancelledAt` y no por el estado, y una compra marcada como cancelada sin procesar se procesa con el aviso siguiente. Se reparó esa compra.
  - **Mejora de la revisión (2026-11-19):** los avisos de órdenes dicen el número de compra y los productos (`describePurchase`), porque dos cancelaciones del mismo comprador se veían iguales.
- [x] **T-007** «Buscar órdenes nuevas»: al abrir la pantalla (una vez por minuto), con el botón, en la pasada diaria antes del control de stock y al reconectar.
  - Hecho cuando: con la fecha de inicio cargada, la búsqueda registra las compras de la prueba técnica que falten.
  - Hecho el 2026-11-19: `fetchRecentOrders` busca 14 días (o desde la fecha de inicio) y sincroniza una sola vez cada paquete; al abrir `/ordenes` corre con `after`, como mucho una vez por minuto (`lastOrdersFetchAt`); el botón y la pasada diaria lo fuerzan; al reconectar, también. Probado: registró el carrito y la segunda búsqueda no duplicó.
- [x] **T-008** Etiqueta: `pdf-lib`, recorte a 10 × 15 y Route Handler con la hoja A4 como alternativa.
  - Hecho cuando: Vitest recorta el PDF de la prueba técnica a una página de 10 × 15, y la ruta rechaza una orden con riesgo de fraude.
  - Hecho el 2026-11-19: `pdf-lib` 1.17.1; `orders/label.ts` recorta la primera hoja al rectángulo medido con la etiqueta real (se revisó a ojo: entra entera, sin cortes) y la pone en 10 × 15 cm; 3 pruebas con un PDF armado en la prueba (el real tiene datos del comprador y no se guarda). Ruta `/ordenes/[id]/etiqueta`, con `?formato=a4` para la hoja original; rechaza fraude, sin Mercado Envíos y ya despachada, y registra quién la descargó.
- [x] **T-009** Caja por turnos y caja del día sin ventas de Mercado Libre; historial y detalle de ventas con el canal.
  - Hecho cuando: una venta de Mercado Libre no cambia la caja y se ve en el historial como «Mercado Libre».
  - Hecho el 2026-11-19: la caja por turnos ya filtraba por caja; la caja del día filtra `channel: LOCAL`. El historial muestra «Mercado Libre» en lugar de la caja; el detalle dice «Venta de Mercado Libre, sin caja» con enlace a la orden, sin botón de anular ni de facturar (la factura es la spec 024). `voidSale` rechaza las ventas de Mercado Libre en el servidor.
- [x] **T-010** Analíticas: filtro Origen, medio de cobro «Mercado Libre», usuario «Mercado Libre (automático)», margen con lo que cobra Mercado Libre y columna Origen en las exportaciones.
  - Hecho cuando: Vitest cubre el filtro y el margen, y las exportaciones traen la columna.
  - Hecho el 2026-11-19: filtro Origen (`?origen=local|mercadolibre`) en la pantalla y las exportaciones; canal «Mercado Libre»; medio de cobro «Mercado Libre» (no tienen movimientos de caja); el usuario Sistema fuera del filtro de empleados; margen con `unitFee` (lo que cobró Mercado Libre por unidad más su parte del envío a cargo del vendedor). **Ajuste:** las exportaciones son resúmenes, sin una fila por venta, así que en lugar de una columna Origen llevan la tabla «Ventas por origen» (también en pantalla). 6 pruebas nuevas.
- [x] **T-011** Inicio: ventas del día con Local y Mercado Libre por separado, y «Órdenes para preparar».
  - Hecho cuando: se ven en el inicio del Dueño.
  - Hecho el 2026-11-19: «Ventas de hoy» muestra el total y el detalle Local y Mercado Libre; sección «Mercado Libre» con «Órdenes para preparar» para quien ve el módulo.
- [x] **T-012** Campanita: los cuatro tipos nuevos y los avisos calculados de despacho y fraude.
  - Hecho cuando: Vitest cubre la visibilidad por permiso y los avisos calculados.
  - Hecho el 2026-11-19: los cuatro tipos con «ver» en Mercado Libre y enlace a `/ordenes`; avisos calculados de despacho por vencer, vencido y fraude en `notifications-data.ts`.
- [x] **T-013** Usuario y rol «Sistema»: el reinicio los conserva, y no aparecen en Usuarios, Roles ni en los filtros de empleados. Tablas nuevas en el reinicio.
  - Hecho cuando: `system-reset.test.ts` pasa con las tablas nuevas y el usuario no se ve en esas pantallas.
  - Hecho el 2026-11-19: el usuario y el rol «Sistema» no aparecen en Usuarios, Roles, Empleados ni en el filtro de empleados de analíticas; las acciones de usuarios y roles los rechazan, también llamando directo al servidor; el reinicio los conserva y vacía las tres tablas de órdenes.

## Pantallas

- [x] **T-014** `/ordenes` y `/ordenes/[id]`, ítem «Órdenes» en la navegación, migas, y la fecha de inicio en Configuración > Mercado Libre.
  - Hecho cuando: el carrito de la prueba se ve en la lista y en el detalle, con su etiqueta.
  - Hecho el 2026-11-19: `/ordenes` (filtro por estado y fecha, abre en «Por despachar» ordenada por fecha límite, marcas, actualización cada 60 segundos y «Buscar órdenes nuevas»), `/ordenes/[id]` (productos, importes, envío, etiqueta 10 × 15 y A4, reingreso, historial), ítem «Órdenes» y migas, y la fecha de inicio en Configuración > Mercado Libre. Falta verlas en el navegador (T-016).

## Documentación

- [x] **T-015** Notas en las specs 007, 008, 011, 012, 013, 014 y 017, y la guía para el dueño.
  - Hecho cuando: cada documento tiene su nota con fecha.
  - Hecho el 2026-11-19: notas en las specs 002, 007, 008, 011, 012, 013, 014 y 017; la regla de la spec 021 queda resuelta; sección «Órdenes» en `docs/guia-mercado-libre.md`.

## Verificación final

- [x] **T-016** **(D)** Verificación manual con las cuentas de prueba, siguiendo el plan, sección 6.
  - Hecha el 2026-11-19: el usuario revisó órdenes, detalle, etiqueta 10 × 15 y A4, historial de ventas, caja, inicio y analíticas; hizo una compra nueva (entró sola, con aviso y stock en 0) y canceló esa compra y el carrito (volvió el stock). Encontró el triple procesamiento de la cancelación, que se corrigió (T-006), y los avisos iguales de dos compras, que ahora dicen el número y los productos.
- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas"). — Cada criterio dice cómo se probó. Sin poder provocar con cuentas de prueba: despacho, entrega, cancelación después del despacho y riesgo de fraude; la primera venta real del cliente es la verificación final de esos casos.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`). — 2026-11-19: 668 pruebas pasando, sin errores de tipos ni de linter, build de producción correcto con `/ordenes`, `/ordenes/[id]` y la ruta de la etiqueta.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-19)».
