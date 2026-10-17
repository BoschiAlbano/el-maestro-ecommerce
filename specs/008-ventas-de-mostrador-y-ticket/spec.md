# Spec 008 — Ventas de mostrador y ticket

| | |
|---|---|
| **Estado** | Aprobada |
| **Depende de** | 005, 007 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Vender productos por mostrador, cobrando una o varias formas de pago, con ticket impreso, de forma que el stock y la caja queden siempre al día sin que alguien tenga que corregirlos a mano después.

## 2. Alcance

**Incluye:**

- Búsqueda de productos por nombre o código, con soporte para lector de código de barras USB
- Carrito con varios productos y cantidades
- Cobro repartido en una o más formas de pago (efectivo y/o transferencia, con referencia si corresponde — spec 007)
- Al confirmar: descuento de stock (spec 005) y registro del/los cobros en la caja (spec 007), todo en una sola operación
- Ticket imprimible de 58 mm con los datos acordados
- Reimpresión de ticket, con registro de quién y cuándo
- Anulación de una venta con motivo, que revierte automáticamente el stock y la plata cobrada
- Historial de ventas y detalle de cada una

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md` (sin descuentos, sin tarjeta ni QR, sin facturación fiscal, un solo puesto de caja). No incluye los pedidos por encargo (spec 009) ni devoluciones parciales de una venta — la anulación es de la venta completa, no de ítems sueltos.

## 3. Historias de usuario

- Como cajero, quiero buscar un producto por nombre o pasarlo por el lector de código de barras, para agregarlo rápido al carrito.
- Como cajero, quiero cobrar una venta repartida entre efectivo y transferencia, para los casos en que el cliente paga mitad y mitad.
- Como cajero, quiero que al confirmar la venta se genere el ticket para imprimir, para entregárselo al cliente.
- Como cajero, quiero poder reimprimir un ticket si el cliente lo pide de nuevo, y que quede registrado quién lo reimprimió.
- Como dueño o cajero con permiso, quiero poder anular una venta mal hecha con un motivo, y que el stock y la plata vuelvan solos, sin tener que corregir nada a mano.
- Como dueño, quiero ver el historial de ventas, para repasar qué se vendió y cuándo.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite buscar un producto por nombre o código de barras (tipeado a mano o con lector USB, que para la aplicación es indistinguible de tipear y apretar Enter) y agregarlo al carrito con una cantidad.
- **RF-2.** No se puede vender sin una caja abierta (spec 007).
- **RF-3.** El cobro de una venta se reparte en una o más formas de pago (efectivo y/o transferencia, cada una con su referencia si corresponde); la suma de las partes tiene que coincidir exactamente con el total de la venta antes de poder confirmarla.
- **RF-4.** Al confirmar una venta, en una sola operación: se registra la venta con sus ítems, se descuenta el stock de cada ítem (movimiento de tipo "venta", spec 005) y se registra un movimiento de caja por cada forma de pago usada (spec 007).
- **RF-5.** El sistema genera un ticket de 58 mm con razón social, número de ticket, fecha y hora, empleado que la hizo, los productos con sus precios, los totales, y la leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA"; se imprime con la impresión del navegador (sin comandos ESC/POS, `docs/PROJECT.md` sección 6).
- **RF-6.** El sistema permite reimprimir el ticket de una venta ya confirmada; cada reimpresión queda registrada (quién y cuándo), no solo la última.
- **RF-7.** El sistema permite anular una venta con un motivo obligatorio; al anular, se genera automáticamente un movimiento de stock que devuelve la cantidad de cada ítem y un movimiento de caja (egreso) por cada forma de pago que se usó al cobrarla.
- **RF-8.** El sistema permite ver el historial de ventas (fecha, empleado, total, si está anulada) y el detalle de una venta en particular (ítems, pagos, reimpresiones).

## 5. Reglas de negocio

- Solo efectivo y transferencia; una sola lista de precios; sin descuentos (`docs/PROJECT.md`, sección 5).
- No se vende sin caja abierta (`docs/PROJECT.md`, sección 5; spec 007).
- Cada venta guarda sus ítems, sus pagos y el movimiento de stock en una sola operación — se guarda todo o nada (constitución, integridad de datos).
- El costo de cada ítem vendido es el precio de compra vigente del producto en ese momento, guardado como foto en el momento de la venta: si el costo del producto cambia después, el margen de esa venta no cambia (`docs/PROJECT.md`, sección 5; constitución, regla 8).
- Anular una venta revierte stock y caja automáticamente; no hay anulación parcial, se anula la venta completa.
- El egreso de caja que revierte una venta anulada se registra en el turno abierto en el momento de la anulación, que puede ser distinto del turno en que se hizo la venta originalmente (los turnos cerrados no se tocan, spec 007).
- Vender más unidades de las que hay en stock no se bloquea; el stock puede quedar negativo, igual criterio que los ajustes manuales (spec 005).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Vender (buscar, armar el carrito, cobrar, generar el ticket) | Permiso "crear" en Ventas |
| Ver el historial y el detalle de una venta | Permiso "ver" en Ventas |
| Reimprimir un ticket | Permiso "ver" en Ventas, además del permiso especial "reimprimir tickets" |
| Anular una venta | Permiso "anular" en Ventas, además del permiso especial "anular ventas" |

## 7. Casos borde y errores

- Se intenta vender sin ninguna caja abierta: se rechaza.
- Los pagos ingresados no suman exactamente el total de la venta: se rechaza, no se confirma nada.
- Se busca un producto por un código que no existe: se avisa, no se agrega nada al carrito.
- Se intenta anular una venta que ya estaba anulada: se rechaza.
- Un usuario sin el permiso especial "anular ventas" intenta anular una venta llamando a la acción directamente (no solo por la interfaz): el servidor lo rechaza.
- Un usuario sin el permiso especial "reimprimir tickets" intenta reimprimir: el servidor lo rechaza.
- Se vende más cantidad de un producto que el stock disponible: se permite, el stock queda negativo y la pantalla de inventario lo señala (spec 005).

## 8. Criterios de aceptación

- [ ] Se puede buscar un producto por nombre o código y agregarlo al carrito con una cantidad.
- [ ] Se puede cobrar una venta repartida entre efectivo y transferencia; si la suma no coincide con el total, no se puede confirmar.
- [ ] Al confirmar la venta, el stock de cada producto baja según lo vendido y queda un movimiento de caja por cada forma de pago usada.
- [ ] Se genera un ticket de 58 mm con todos los datos acordados, listo para imprimir.
- [ ] Se puede reimprimir un ticket y cada reimpresión queda registrada.
- [ ] Se puede anular una venta con un motivo, y el stock y la caja se revierten solos, sin tocar nada a mano.
- [ ] Un usuario sin el permiso especial "anular ventas" no puede anular una venta, probado con un rol real.
- [ ] Se puede ver el historial de ventas y el detalle de una en particular.

## 9. Entidades previstas

A confirmar en el plan: `Sale` (fecha, usuario, turno de caja, total, si está anulada, motivo y usuario/fecha de anulación), `SaleItem` (venta, producto, cantidad, precio de venta unitario y costo unitario — los dos como foto del momento de la venta) y `TicketReprint` (venta, usuario, fecha).

## 10. Decisiones (ya confirmadas con el cliente)

- **Anular revierte todo automáticamente (stock y caja), sin anulación parcial.** Evita depender de que alguien se acuerde de corregir el stock y la caja a mano después de anular; coherente con que todo lo demás en el sistema (precios, stock, caja) también funciona por movimientos que se agregan, nunca por ediciones.
- **El costo de cada ítem queda como foto del precio de compra al momento de la venta**, no se recalcula si el costo del producto cambia después.
- **Sin "vuelto" modelado como movimiento propio.** Los pagos ingresados tienen que sumar exactamente el total de la venta; el cambio físico que entrega el cajero (si pagaron con un billete más grande) no es un evento que el sistema registre — no afecta el efectivo esperado de la caja de ninguna manera distinta.
- **Reimpresión: se guarda un registro por cada vez**, no solo la última — coherente con "reimpresión con registro" (`docs/PROJECT.md`, sección 4).
