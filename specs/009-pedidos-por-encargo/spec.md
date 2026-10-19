# Spec 009 — Pedidos por encargo

| | |
|---|---|
| **Estado** | Verificada (el rediseño del detalle del 2026-10-19 está pendiente de verificación manual) |
| **Depende de** | 005, 007, 008 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Llevar el registro de lo que un cliente encargó (con o sin stock), cobrar una seña si corresponde, entregarlo de a partes convirtiendo cada entrega en una venta, y cancelar devolviendo lo que no se usó de la seña.

## 2. Alcance

**Incluye:**

- Alta de un pedido: cliente (nombre, teléfono, canal) y una lista de productos con cantidades, con o sin stock disponible
- Agregar o quitar productos de un pedido mientras sigue pendiente
- Seña opcional, cobrada en una sola forma de pago (efectivo o transferencia)
- Entrega total o parcial: los ítems elegidos se convierten en una venta con ticket (spec 008), descontando stock y aplicando la seña disponible
- El pedido se cierra solo cuando no queda nada pendiente
- Cancelación: devuelve como egreso de caja lo que quede de la seña sin aplicar
- Indicador informativo de unidades comprometidas en pedidos pendientes, por producto
- Historial de pedidos y exportación de la lista

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md` (sin reserva automática de stock). No incluye un comprobante fiscal distinto del ticket de entrega ni de la seña.

## 3. Historias de usuario

- Como vendedor, quiero registrar un pedido con los datos del cliente y los productos que encargó, para llevar el registro aunque no tenga stock de todo.
- Como vendedor, quiero cobrar una seña al crear el pedido o después, para asegurar el compromiso del cliente.
- Como vendedor, quiero agregar o quitar productos de un pedido mientras está pendiente, para ajustarlo si el cliente cambia de idea.
- Como vendedor, quiero entregar parte o todo lo pedido, generando la venta y el ticket correspondiente, para que el stock y la caja queden al día.
- Como vendedor, quiero que la seña ya cobrada se aplique sola al entregar, y ver cuánto queda a favor del pedido, para no cobrar de más ni de menos.
- Como dueño, quiero cancelar un pedido devolviendo la seña, para los casos en que el cliente no vuelve.
- Como dueño, quiero ver cuántas unidades de un producto están comprometidas en pedidos pendientes, para saber qué stock está realmente disponible para vender.
- Como dueño, quiero ver el historial de pedidos y exportar la lista, para hacer seguimiento.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite crear un pedido con datos del cliente (nombre, teléfono, canal) y una lista de productos con cantidades, con o sin stock disponible en ese momento. **La seña no es obligatoria para crear un pedido**: un pedido puede existir y procesarse de principio a fin (entregas, cancelación) sin que se cobre nunca ninguna seña.
- **RF-2.** Mientras un pedido está pendiente, se pueden agregar o quitar productos de su lista, y **cambiar la cantidad pedida** de un producto *(2026-10-19)*: no puede quedar en menos de 1 ni en menos de lo que ya se entregó de ese producto (un producto con entregas no se puede quitar, y su cantidad solo puede subir o bajar hasta lo entregado). Si se agrega un producto que ya está en el pedido, se suma a su misma línea en lugar de crear otra.
- **RF-3.** El sistema permite cobrar una seña opcional para un pedido (en cualquier momento mientras está pendiente, no solo al crearlo), en una sola forma de pago (con referencia si es transferencia); exige caja abierta y genera un movimiento de caja.
- **RF-4.** El sistema permite entregar uno o más ítems pendientes de un pedido: genera una venta (con ticket, spec 008) por esos ítems, descuenta el stock, y aplica contra el total de esa entrega lo que quede de la seña, si el pedido tiene (hasta cubrirlo); si no hay seña, o no alcanza, lo que falta se cobra como una venta normal.
- **RF-5.** El ticket de una entrega muestra, además de lo habitual (spec 008), cuánto se aplicó de la seña en esa entrega y cuánto queda de saldo a favor del pedido — esta sección del ticket no aparece si el pedido nunca tuvo seña.
- **RF-6.** Los ítems entregados salen de la lista de pendientes; el pedido se cierra solo cuando no queda nada pendiente.
- **RF-7.** El sistema permite cancelar un pedido pendiente: si tiene seña sin aplicar, la devuelve como egreso de caja (con motivo); si el pedido nunca tuvo seña (o ya se aplicó toda), se cancela directo sin generar ningún movimiento de caja. El pedido pasa a cancelado en los dos casos.
- **RF-8.** El sistema muestra, por producto, cuántas unidades están comprometidas en pedidos pendientes — dato informativo, no bloquea ninguna operación.
- **RF-9.** El sistema permite ver el historial de pedidos (cliente, estado, fecha) y el detalle de uno en particular (ítems, entregas, seña), y exportar la lista. La lista muestra solo los pedidos pendientes por defecto — mezclarlos con los cerrados y cancelados dificulta ver qué hay que comprar o entregar — con un filtro arriba para ver cerrados, cancelados o todos.
- **RF-11.** *(2026-10-19)* En la lista de pedidos, cada fila tiene un botón **Acciones** con *Ver detalle* y, para los pedidos pendientes y quien tenga permiso de anular en Pedidos, *Cancelar pedido* (la misma ventana de cancelación del detalle, con el motivo obligatorio y la misma regla de devolución de la seña, RF-7), para poder cancelar sin entrar al detalle.
- **RF-10.** *(Presentación, 2026-10-19 — no cambia las reglas de RF-1 a RF-9.)* El detalle de un pedido se organiza así:
  - **Encabezado:** cliente, estado, teléfono, canal y quién lo creó y cuándo; y las acciones del pedido según permisos y estado: *Entregar*, *Cobrar seña* (solo si todavía no tiene seña) y *Cancelar pedido*, cada una en una ventana modal.
  - **Tarjetas:** *Entregado* (unidades entregadas de las pedidas), *Total del pedido* (a los precios actuales), *Seña* (monto y medio, o "sin seña") y *Falta cobrar* (lo pendiente de entregar menos el saldo de seña a favor).
  - **Buscar producto:** un panel propio, arriba de la tabla, con la misma búsqueda de la pantalla de venta (spec 008): caja grande, resultados flotantes que no desplazan la pantalla, el **stock actual** de cada producto como dato informativo (no bloquea nada), y un código de barras exacto con un único resultado se agrega solo.
  - **Productos del pedido:** tabla con lo pedido (con botones "−" y "+" para cambiar la cantidad, RF-2), lo entregado, lo pendiente, el precio y el subtotal, con una etiqueta de estado por producto (Pendiente, Parcial, Entregado); un producto sin entregas se puede quitar.
  - **Entregar:** en la ventana se elige cuánto entregar de cada producto con botones "−" y "+", y se ve el total de la entrega, lo que se descuenta de la seña y lo que hay que cobrar; si hay algo para cobrar, se pasa al cobro con el mismo modal de la pantalla de venta (medios de pago, pago dividido y vuelto, spec 008); si la seña cubre todo, se confirma sin cobrar nada.
  - **Entregas realizadas:** tabla con ticket, fecha, total, seña aplicada y el acceso al ticket en ventana modal.
  - Un pedido cancelado muestra su motivo de forma destacada y sin acciones.

## 5. Reglas de negocio

- Un pedido no reserva stock: la mercadería que llega queda disponible para una venta nueva o para entregar un pedido (`docs/PROJECT.md`, sección 5).
- **La seña es opcional, no un requisito para crear o procesar un pedido.** Un pedido sin seña se entrega cobrando el total completo en cada entrega (como una venta normal) y, si se cancela, no genera ningún movimiento de caja — no hay nada que devolver.
- El precio de cada ítem se fija al momento de entregarlo (el precio de venta vigente en ese momento), igual criterio que una venta común — no se "congela" un precio al crear el pedido.
- La seña se cobra con la caja abierta, suma a la caja del día en que se cobra, y no se vuelve a contar en el cierre del día de entrega (`docs/PROJECT.md`, sección 5).
- Al entregar, la seña disponible se aplica hasta cubrir el total de esa entrega; si sobra, el excedente queda como saldo a favor del pedido para la próxima entrega.
- Al cancelar, se devuelve como egreso de caja lo que quede de la seña sin aplicar; si la seña fue por transferencia, el egreso es por ese medio y no afecta el efectivo esperado (`docs/PROJECT.md`, sección 5).
- No se puede cobrar una seña ni entregar un pedido sin caja abierta (mismo criterio que una venta, spec 008).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver pedidos y su historial | Permiso "ver" en Pedidos |
| Crear un pedido, agregar/quitar ítems, cobrar una seña | Permiso "crear" en Pedidos |
| Entregar ítems de un pedido (genera una venta) | Permiso "crear" en Pedidos, además del permiso "crear" en Ventas |
| Cancelar un pedido | Permiso "anular" en Pedidos |
| Exportar la lista de pedidos | Permiso "exportar" en Pedidos |

## 7. Casos borde y errores

- Se intenta cobrar una seña o entregar un pedido sin caja abierta: se rechaza.
- Se intenta entregar un ítem que ya está completo (nada pendiente de esa línea): se rechaza.
- Se intenta cancelar un pedido que ya está cerrado o cancelado: se rechaza.
- Se cancela un pedido sin seña, o cuya seña ya se aplicó por completo en entregas anteriores: no hay nada que devolver, se cancela sin generar un egreso.
- Se intenta agregar o quitar un ítem de un pedido que ya está cerrado o cancelado: se rechaza.

## 8. Criterios de aceptación

- [x] Se puede crear un pedido con cliente y productos, con o sin stock disponible, y sin necesidad de cobrar ninguna seña.
- [x] Se pueden agregar o quitar productos de un pedido mientras sigue pendiente.
- [x] Se puede cobrar una seña (opcional) y queda reflejada en la caja del día.
- [x] Se puede entregar parte de un pedido: se genera la venta con ticket, baja el stock, y se aplica la seña disponible contra esa entrega (si no tiene seña, se cobra el total completo).
- [x] El pedido se cierra solo cuando se entregó todo lo pedido.
- [x] Se puede cancelar un pedido pendiente: si tiene seña sin aplicar, se devuelve como egreso de caja; si no tiene seña, se cancela sin generar ningún movimiento.
- [x] Un producto muestra cuántas unidades están comprometidas en pedidos pendientes.
- [x] Se puede ver el historial de pedidos y exportar la lista.
- [ ] (RF-11) Desde la lista de pedidos se puede cancelar un pedido pendiente con el menú Acciones (con motivo, y devolviendo la seña no usada como egreso), sin entrar al detalle; la opción no aparece en pedidos cerrados o cancelados ni sin permiso de anular.
- [ ] (RF-2, RF-10) La cantidad de un producto del pedido se cambia con "−" y "+" (no baja de 1 ni de lo entregado, y solo mientras el pedido está pendiente); agregar un producto que ya está suma a su línea; la búsqueda muestra el stock y agrega sola con un código exacto.
- [ ] (RF-10) El detalle muestra las tarjetas con los números correctos; Entregar, Cobrar seña y Cancelar funcionan desde las ventanas modales (con los mismos permisos y reglas que antes), y los productos se agregan con el buscador flotante.

## 9. Entidades previstas

A confirmar en el plan: `Order` (cliente, canal, estado, usuario, fecha), `OrderItem` (pedido, producto, cantidad pedida, cantidad entregada). La seña se registra como `CashMovement` enlazado al pedido; cada entrega se registra como un `Sale` enlazado al pedido (mismo criterio que el `saleId` de la spec 008: campos directos, agregados ahora que hay un consumidor real).

## 10. Decisiones (ya confirmadas con el cliente)

- **El ticket de entrega muestra la seña aplicada y el saldo a favor**; no se entrega ningún comprobante aparte al cobrar la seña en sí.
- **La seña se cobra en una sola forma de pago**, no repartida como una venta.
- **La seña es opcional**: un pedido puede crearse, entregarse y cancelarse sin cobrar nunca ninguna seña — no es un requisito en ningún paso del flujo.
- **Se pueden agregar o quitar productos de un pedido mientras sigue pendiente** — no queda fijo al crearlo.
- **El precio de cada ítem se fija al entregarlo**, no al crear el pedido.
