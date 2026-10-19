# Spec 008 — Ventas de mostrador y ticket

| | |
|---|---|
| **Estado** | Verificada (el rediseño de las pantallas del 2026-10-19 está pendiente de verificación manual) |
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
- Rediseño de las pantallas de venta, historial y detalle (2026-10-19, RF-9 a RF-13): una pantalla de venta tipo punto de venta, el cobro en una ventana modal con cálculo del vuelto, y el historial y el detalle con el mismo estilo que el resto del sistema

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
- **RF-9.** *(Presentación, 2026-10-19 — no cambia las reglas de RF-1 a RF-8.)* La pantalla `/ventas` se organiza en dos zonas: a la izquierda, el buscador (siempre enfocado) y el carrito, con la cantidad de cada ítem editable con botones "−" y "+" y un ícono para quitarlo; a la derecha, un resumen que se mantiene a la vista con la cantidad de productos, el **total** en grande y el botón **Cobrar**. En el celular el resumen pasa a una barra fija abajo. Sin caja abierta, la pantalla lo explica y ofrece ir a Caja.
- **RF-10.** El botón **Cobrar** abre una ventana modal donde se reparte el cobro (RF-3): se elige el medio con botones (efectivo o transferencia), el monto ya viene cargado con el total, se puede **dividir el pago** en otra forma de pago (con un acceso para poner en cada una lo que falta), y la ventana muestra en todo momento si el pago está completo o cuánto falta o sobra. El botón de confirmar solo se habilita cuando los pagos suman exactamente el total (RF-3) y, en transferencias, están los 4 dígitos del comprobante.
- **RF-11.** *Vuelto.* Si en el cobro hay efectivo, la ventana permite anotar cuánto efectivo entregó el cliente y muestra el **vuelto** a devolver (efectivo recibido menos la parte de la venta cobrada en efectivo). Es solo un cálculo de ayuda en pantalla: no se guarda, no cambia lo que se registra en la caja (se registra lo cobrado, no lo recibido) y no es obligatorio usarlo.
- **RF-12.** Los resultados de la búsqueda aparecen en una lista flotante justo debajo del buscador, **sobre** el carrito y sin desplazar la pantalla (se cierra con Escape, al hacer clic afuera o al agregar un producto). Al buscar un producto, cada resultado muestra su **stock actual** como dato informativo (no bloquea la venta, ver sección 5). Si se escanea o tipea un código de barras exacto y hay un único producto con ese código, se agrega al carrito directamente.
- **RF-14.** *(Presentación, 2026-10-19 — reemplaza la pantalla propia del ticket; el contenido y el formato de RF-5 no cambian.)* El ticket se muestra en una **ventana modal**, no en una página aparte: aparece sola al confirmar una venta (con "Imprimir" y "Nueva venta", que deja la pantalla de venta lista para la siguiente), al entregar un pedido (spec 009), al reimprimir desde el detalle de una venta y al elegir "Ver ticket" en un pedido. Imprimir manda a la impresora solo el ticket de 58 mm, sin el resto de la pantalla.
- **RF-15.** *(2026-10-19)* El historial de ventas se puede ver por período, con un selector arriba: **Caja actual** (el valor por defecto: solo las ventas del turno abierto), **Hoy** (todos los turnos del día, en horario de Tucumán), **Últimos 7 días** y **Todas**. Si no hay ninguna caja abierta, el valor por defecto es "Hoy" y "Caja actual" aparece deshabilitada. Cuando se ven más ventas que las del turno actual, cada fila indica a qué caja pertenece (la actual, o la fecha y hora en que se abrió). Se siguen mostrando las últimas 200 ventas del período. Así se evita reimprimir o anular por error un ticket viejo, sin perder la posibilidad de buscar ventas de turnos anteriores (anular una venta de un turno cerrado sigue permitido, sección 5).
- **RF-13.** El historial de ventas se organiza en pestañas (*Todas*, *Activas*, *Anuladas*, con su cantidad) y el detalle de una venta muestra: el estado y los datos de la anulación (si la hay) de forma destacada, tarjetas con el total, las unidades y el desglose por medio de pago, y los ítems, los pagos y las reimpresiones en paneles separados. *Reimprimir* y *Anular* están arriba; anular se hace en una ventana modal con el motivo obligatorio.

## 5. Reglas de negocio

- Solo efectivo y transferencia; una sola lista de precios; sin descuentos (`docs/PROJECT.md`, sección 5).
- No se vende sin caja abierta (`docs/PROJECT.md`, sección 5; spec 007).
- Cada venta guarda sus ítems, sus pagos y el movimiento de stock en una sola operación — se guarda todo o nada (constitución, integridad de datos).
- El costo de cada ítem vendido es el precio de compra vigente del producto en ese momento, guardado como foto en el momento de la venta: si el costo del producto cambia después, el margen de esa venta no cambia (`docs/PROJECT.md`, sección 5; constitución, regla 8).
- Anular una venta revierte stock y caja automáticamente; no hay anulación parcial, se anula la venta completa.
- El egreso de caja que revierte una venta anulada se registra en el turno abierto en el momento de la anulación, que puede ser distinto del turno en que se hizo la venta originalmente (los turnos cerrados no se tocan, spec 007).
- Vender más unidades de las que hay en stock no se bloquea; el stock puede quedar negativo, igual criterio que los ajustes manuales (spec 005). El stock que se muestra al buscar (RF-12) es solo informativo.

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

- [x] Se puede buscar un producto por nombre o código y agregarlo al carrito con una cantidad.
- [x] Se puede cobrar una venta repartida entre efectivo y transferencia; si la suma no coincide con el total, no se puede confirmar.
- [x] Al confirmar la venta, el stock de cada producto baja según lo vendido y queda un movimiento de caja por cada forma de pago usada.
- [x] Se genera un ticket de 58 mm con todos los datos acordados, listo para imprimir.
- [x] Se puede reimprimir un ticket y cada reimpresión queda registrada.
- [x] Se puede anular una venta con un motivo, y el stock y la caja se revierten solos, sin tocar nada a mano.
- [x] Un usuario sin el permiso especial "anular ventas" no puede anular una venta, probado con un rol real.
- [x] Se puede ver el historial de ventas y el detalle de una en particular.
- [ ] (RF-9, RF-10) La venta se arma con el buscador y el carrito, y se cobra desde la ventana modal: con un solo medio, con dos medios, y con una transferencia (que pide los 4 dígitos); no se puede confirmar si el pago no está completo.
- [ ] (RF-11) Al cobrar en efectivo, anotar el efectivo recibido muestra el vuelto correcto, y la caja registra solo lo cobrado.
- [ ] (RF-12) La búsqueda muestra el stock de cada producto; un código de barras exacto agrega el producto sin hacer clic.
- [ ] (RF-14) El ticket aparece en una ventana modal al confirmar una venta, al entregar un pedido, al reimprimir y al elegir "Ver ticket"; al imprimir sale solo el ticket de 58 mm, y "Nueva venta" deja la pantalla de venta vacía.
- [ ] (RF-15) El historial abre en la caja actual; el selector cambia a Hoy, Últimos 7 días y Todas, las filas de otros turnos indican su caja, y sin caja abierta el valor por defecto es Hoy.
- [ ] (RF-13) El historial filtra por pestañas y el detalle muestra todo lo indicado, con la anulación en una ventana modal que exige el motivo.

## 9. Entidades previstas

A confirmar en el plan: `Sale` (fecha, usuario, turno de caja, total, si está anulada, motivo y usuario/fecha de anulación), `SaleItem` (venta, producto, cantidad, precio de venta unitario y costo unitario — los dos como foto del momento de la venta) y `TicketReprint` (venta, usuario, fecha).

## 10. Decisiones (ya confirmadas con el cliente)

- **Anular revierte todo automáticamente (stock y caja), sin anulación parcial.** Evita depender de que alguien se acuerde de corregir el stock y la caja a mano después de anular; coherente con que todo lo demás en el sistema (precios, stock, caja) también funciona por movimientos que se agregan, nunca por ediciones.
- **El costo de cada ítem queda como foto del precio de compra al momento de la venta**, no se recalcula si el costo del producto cambia después.
- **Sin "vuelto" modelado como movimiento propio** *(sigue vigente; el 2026-10-19 se agregó solo una ayuda en pantalla, RF-11: el cajero puede anotar cuánto recibió y ver el vuelto, pero el sistema sigue sin registrarlo).* Los pagos ingresados tienen que sumar exactamente el total de la venta; el cambio físico que entrega el cajero (si pagaron con un billete más grande) no es un evento que el sistema registre — no afecta el efectivo esperado de la caja de ninguna manera distinta.
- **Reimpresión: se guarda un registro por cada vez**, no solo la última — coherente con "reimpresión con registro" (`docs/PROJECT.md`, sección 4).
