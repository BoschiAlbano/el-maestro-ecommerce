# Spec 022 — Órdenes de Mercado Libre

| | |
|---|---|
| **Estado** | Verificada (2026-11-19) |
| **Depende de** | 008, 011, 013, 020, 021 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.6 |

## 1. Objetivo

Que cada compra hecha en Mercado Libre llegue sola al sistema como una venta de ese canal: descuenta el stock, le avisa al equipo y queda lista para preparar el envío. Y que el dueño vea esas ventas en las analíticas junto con las de mostrador.

## 2. Alcance

**Incluye:**

- Registrar cada compra pagada de Mercado Libre como una venta del canal Mercado Libre, con descuento de stock.
- Una pantalla de órdenes con lo que hay que preparar, lo despachado y lo cancelado.
- Imprimir la etiqueta de envío de Mercado Libre.
- Seguir el estado del envío.
- Devolver el stock cuando una compra se cancela antes del despacho.
- Avisos en la campanita: orden nueva, cancelación, riesgo de fraude y despacho por vencer.
- En analíticas, las ventas de Mercado Libre sumadas a las de mostrador, con un filtro por origen.

**No incluye:**

- La factura de la orden (spec 024).
- Reclamos, devoluciones, cambios y mensajes con el comprador: se gestionan en Mercado Libre.
- Cancelar una orden desde el sistema: se hace en Mercado Libre y el sistema lo refleja.
- Calificar al comprador.
- Envíos con el depósito de Mercado Libre.
- Conciliar el dinero que Mercado Libre liquida en la cuenta de Mercado Pago.

## 3. Historias de usuario

- Como **dueño o empleado**, quiero enterarme apenas entra una compra de Mercado Libre, para prepararla a tiempo.
- Como **empleado**, quiero ver qué tengo que preparar y hasta cuándo, para no despachar tarde.
- Como **empleado**, quiero imprimir la etiqueta de envío desde el sistema, para no entrar a Mercado Libre.
- Como **dueño**, quiero que el stock baje solo con cada compra y vuelva solo si se cancela antes de despachar, para no corregirlo a mano.
- Como **dueño**, quiero que el sistema me frene si Mercado Libre detecta riesgo de fraude, para no despachar mercadería que no voy a cobrar.
- Como **dueño**, quiero ver en las analíticas las ventas de Mercado Libre junto con las de mostrador, y poder separarlas, para comparar los dos canales.
- Como **dueño**, quiero saber cuánto me cobró Mercado Libre por cada venta, para conocer lo que realmente me queda.

## 4. Requisitos funcionales

**Ingreso de la compra**

- **RF-1.** Cuando Mercado Libre informa una compra **pagada**, el sistema la registra como una venta del canal Mercado Libre. En una sola operación guarda la venta, sus ítems y el movimiento de stock de cada ítem.
- **RF-2.** Una compra de Mercado Libre puede traer varios productos (un carrito). El sistema la trata como **una sola venta**, con un solo envío. *(Aclarado 2026-11-19.)* En un carrito, Mercado Libre crea una orden por producto y las agrupa en un paquete: el sistema las junta por el número de paquete.
- **RF-3.** Cada ítem guarda el precio al que se vendió en Mercado Libre y el costo vigente del producto en ese momento, como en cualquier venta.
- **RF-4.** La venta guarda, como datos informativos: el número de la compra en Mercado Libre, lo que Mercado Libre cobró por la venta, el costo de envío a cargo del vendedor si lo hay, y el importe neto que resulta.
- **RF-5.** La venta guarda del comprador el nombre o apodo y los datos de entrega necesarios para preparar el paquete.
- **RF-6.** La venta de Mercado Libre **no se asocia a ninguna caja** ni genera movimientos de caja. Su medio de cobro es "Mercado Libre".
- **RF-7.** La venta queda a nombre de un usuario "Sistema", que no puede iniciar sesión.
- **RF-8.** Una misma compra se registra una sola vez, aunque Mercado Libre la informe varias veces.
- **RF-9.** Las compras que todavía no están pagadas no se registran.
- **RF-9b.** *(Agregado 2026-11-11.)* Solo se registran las compras hechas **desde la fecha de inicio** que el dueño define en Configuración > Mercado Libre al poner en marcha el sistema. Las anteriores, que el cliente gestionó directamente en Mercado Libre, no se traen: no descuentan stock ni aparecen en analíticas.
- **RF-10.** Al entrar una compra se genera un aviso de "venta de Mercado Libre" en la campanita.
- **RF-10b.** *(Agregado 2026-11-19.)* Si la compra deja el stock de algún producto en negativo, la orden se marca **sin stock** y se genera un aviso propio, distinto del de venta nueva y destacado, para que el dueño consiga el producto o cancele la compra en Mercado Libre a tiempo.

**Pantalla de órdenes**

- **RF-11.** Una pantalla "Órdenes" lista las ventas de Mercado Libre con: número de compra, fecha, comprador, productos y cantidades, total, estado, y la fecha y hora límite de despacho.
- **RF-12.** Los estados que muestra el sistema son: **para preparar**, **lista para despachar**, **en camino**, **entregada**, **no entregada** y **cancelada**. Siguen lo que informa Mercado Libre.
- **RF-13.** La lista abre en "para preparar", ordenada por la fecha límite de despacho más próxima, y se filtra por estado y por fecha.
- **RF-14.** Al abrir la pantalla, y con un botón "Buscar órdenes nuevas", el sistema consulta a Mercado Libre por las compras recientes y registra las que falten.
- **RF-15.** El detalle de una orden muestra los ítems, los importes del RF-4, los datos de entrega, el historial de estados y un enlace a la venta en Mercado Libre.

**Preparación y envío**

- **RF-16.** Desde una orden para preparar se descarga la etiqueta de envío de Mercado Libre para imprimirla. El sistema registra quién la descargó y cuándo, y permite volver a descargarla. *(Decisión del cliente, 2026-11-19.)* El local despacha con Mercado Envíos en un correo o una sucursal de Mercado Libre, e imprime en una impresora de etiquetas de 10 × 15 cm (3nStar POSVENT) ya configurada: la etiqueta se pide a Mercado Libre en ese formato.
- **RF-17.** Una orden cuya fecha límite de despacho vence en las **próximas 4 horas** *(decisión del cliente, 2026-11-19)* se destaca en la lista y genera un aviso en la campanita. Si vence sin haberse despachado, se genera otro aviso.
- **RF-18.** Una orden marcada por Mercado Libre con **riesgo de fraude** se muestra con una advertencia de no despachar, no permite descargar la etiqueta y genera un aviso en la campanita.

**Cancelaciones**

- **RF-19.** Si una compra se cancela **antes de despacharse**, el sistema anula la venta y devuelve el stock de cada ítem, en una sola operación, y genera un aviso.
- **RF-20.** Si una compra se cancela o no se entrega **después de despachada**, la venta se marca como cancelada pero el stock **no** vuelve solo. La orden ofrece "Reingresar al stock", que el usuario usa cuando la mercadería vuelve en condiciones, indicando la cantidad por ítem.
- **RF-21.** Una venta de Mercado Libre no se puede anular con la anulación de ventas de mostrador (spec 008). Su estado sigue al de Mercado Libre.

**Analíticas e inicio**

- **RF-22.** Las analíticas (spec 011) incluyen las ventas de Mercado Libre en sus totales y suman un filtro **Origen** con tres valores: **Todas**, **Local** y **Mercado Libre**. "Local" agrupa las ventas de mostrador y las entregas de pedidos por encargo.
- **RF-23.** En los agrupados de analíticas, Mercado Libre aparece como un canal propio, como un medio de cobro propio y, en ventas por empleado, como "Mercado Libre (automático)".
- **RF-24.** Para quien tenga el permiso "ver costos y márgenes", el margen de las ventas de Mercado Libre descuenta además lo que cobró Mercado Libre (RF-4).
- **RF-25.** Las exportaciones de analíticas respetan el filtro Origen e incluyen una columna con el origen. *(Ajuste 2026-11-19: las exportaciones son resúmenes, sin una fila por venta; en lugar de una columna llevan la tabla «Ventas por origen».)*
- **RF-26.** El inicio del dueño (spec 012) muestra cuántas órdenes de Mercado Libre hay para preparar, con acceso a la pantalla de órdenes.

## 5. Reglas de negocio

- **Las ventas de Mercado Libre no pasan por la caja del local.** El dinero lo cobra Mercado Libre y lo liquida en la cuenta del cliente. Por eso no aparecen en la caja por turnos (spec 007) ni en la caja del día (spec 014), y no afectan el efectivo esperado.
- **Se registra con caja abierta o cerrada**, a cualquier hora. Es la excepción de la regla 11 de la constitución (ver sección 9).
- **Todo o nada** (constitución, regla 10): la venta, sus ítems y los movimientos de stock se guardan juntos.
- **Precio y costo como foto del momento** (regla 8).
- **El stock se descuenta al entrar la compra pagada**, no al despachar.
- **El stock puede quedar negativo** (spec 005). Si una compra entra por una unidad que ya se vendió en el mostrador, se registra igual, el stock queda negativo y la orden se marca "sin stock" para que el dueño decida: conseguir el producto o cancelar en Mercado Libre (RF-10b). Sin stock de reserva (spec 021) este es el caso esperable de una venta doble.
- **El stock de la compra baja por el camino de siempre** (spec 005), así que la cantidad en Mercado Libre se actualiza sola (spec 021). Coincide con lo que Mercado Libre ya descontó: no se descuenta dos veces. Cuando una cancelación devuelve el stock, la cantidad en Mercado Libre vuelve a subir de la misma forma.
- **Lo que cobra Mercado Libre es informativo.** El total de la venta es lo que pagó el comprador por los productos. La comisión no es un egreso de caja.
- **El envío que paga el comprador no es parte de la venta** cuando lo cobra Mercado Libre.
- **Un aviso de Mercado Libre no es un dato** (spec 019): el sistema siempre consulta la compra antes de registrar o cambiar algo.
- **Los datos del comprador son personales.** Se guardan los necesarios para preparar el envío y facturar, y solo los ve quien tiene permiso sobre las órdenes.
- **Fechas en UTC en la base**, mostradas en la zona de Tucumán (regla 9).
- **Plan gratuito de hosting:** la recuperación de avisos perdidos es diaria (spec 019). El RF-14 compensa: cada vez que alguien abre la pantalla, el sistema busca las compras que falten.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver órdenes y su detalle | Permiso "ver" en Mercado Libre |
| Buscar órdenes nuevas | Permiso "ver" en Mercado Libre |
| Descargar la etiqueta de envío | Permiso "editar" en Mercado Libre |
| Reingresar al stock una orden cancelada | Permiso "editar" en Mercado Libre, además del permiso especial "ajustar stock" |
| Ver lo que cobró Mercado Libre y el importe neto | Permiso "ver" en Mercado Libre |
| Ver el margen de las ventas | Permiso especial "ver costos y márgenes" |
| Ver los avisos de órdenes en la campanita | Permiso "ver" en Mercado Libre |
| Ver ventas de Mercado Libre en analíticas | Permiso "ver" en Analíticas |

## 7. Casos borde y errores

- **Llega dos veces el aviso de la misma compra:** se registra una sola vez (RF-8).
- **La compra trae un producto de una publicación que el sistema no conoce:** la venta se registra con ese ítem marcado "sin vincular", sin movimiento de stock, y se avisa para revisarlo. Es el caso de una publicación creada directamente en Mercado Libre que todavía no se vinculó (spec 020, vincular publicaciones).
- **Compra anterior a la fecha de inicio que cambia de estado después** (se despacha, se entrega o se cancela): se ignora (RF-9b).
- **El producto fue desactivado o su publicación finalizada después de la compra:** la venta se registra igual.
- **Compra por más unidades que el stock:** se registra, el stock queda negativo y la orden se marca "sin stock".
- **El comprador cancela después de descargada la etiqueta pero antes del despacho:** aplica el RF-19.
- **Devolución parcial de una compra con varios productos:** la orden se marca "revisar en Mercado Libre"; el sistema no ajusta stock ni importes por su cuenta.
- **Cancelación de una compra que el sistema nunca llegó a registrar:** no se registra nada.
- **Mercado Libre no responde al consultar una compra:** el aviso queda pendiente y se reintenta (spec 019). No se registra una venta a medias.
- **La etiqueta todavía no está disponible:** el sistema lo indica y permite reintentar.
- **Envío que no usa etiqueta de Mercado Libre** (retiro en el local o entrega acordada): la orden lo indica y no ofrece etiqueta.
- **Se intenta "Reingresar al stock" dos veces:** no se puede reingresar más unidades que las vendidas.
- **La conexión requiere reconexión:** no entran compras. Al reconectar, el sistema busca las de los días anteriores.
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.

## 8. Criterios de aceptación

- [x] Una compra de prueba pagada aparece como venta de Mercado Libre, con sus ítems, y baja el stock. *(Usuario, con las cuentas de prueba.)*
- [x] La venta se registra con la caja cerrada. *(Usuario y script: las ventas de Mercado Libre no tienen caja.)*
- [x] La venta no aparece en la caja por turnos ni en la caja del día, y no cambia el efectivo esperado. *(Usuario.)*
- [x] Una compra con dos productos distintos queda como una sola venta. *(Usuario y script, con el carrito.)*
- [x] El mismo aviso recibido dos veces no duplica la venta ni el descuento de stock. *(Script: la segunda búsqueda no registró nada; restricción única de la compra. La cancelación con tres avisos juntos se triplicaba y se corrigió: ver tareas, T-006.)*
- [x] Se genera el aviso de venta nueva en la campanita. *(Usuario.)*
- [x] Se descarga la etiqueta de envío y queda registrado quién y cuándo. *(Usuario: 10 × 15 y A4; queda en el historial de la orden.)*
- [x] El estado de la orden avanza cuando Mercado Libre informa el despacho y la entrega. *(Prueba unitaria de la tabla de estados. Con cuentas de prueba solo se vio el paso de «para preparar» a «lista para despachar» al imprimir la etiqueta: despachar y entregar no se pueden provocar.)*
- [x] Cancelar la compra antes del despacho anula la venta y devuelve el stock. *(Usuario, con una compra y con el carrito.)*
- [x] Cancelar después del despacho no devuelve el stock; "Reingresar al stock" lo hace, con el permiso especial. *(Prueba unitaria de la decisión y revisión del código del reingreso; no se puede despachar con cuentas de prueba.)*
- [x] Una orden con riesgo de fraude muestra la advertencia y no permite descargar la etiqueta. *(Prueba unitaria de la detección y revisión de la ruta de la etiqueta; no se puede provocar con cuentas de prueba.)*
- [x] "Buscar órdenes nuevas" registra una compra cuyo aviso no llegó. *(Script: registró el carrito, cuyos avisos habían llegado antes de que existiera la 022.)*
- [x] En analíticas, el filtro Origen separa Local y Mercado Libre, y "Todas" suma las dos. *(Usuario y pruebas unitarias.)*
- [x] El margen de una venta de Mercado Libre descuenta lo que cobró Mercado Libre, y solo lo ve quien tiene el permiso. *(Pruebas unitarias; el permiso es el mismo control de siempre de analíticas.)*
- [x] Hay pruebas unitarias de: registro único de una compra, armado de la venta desde un carrito, decisión de devolver o no el stock según el momento de la cancelación, y cálculo del importe neto y del margen.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Cambio en la constitución (aprobado el 2026-11-10)

La regla 11 decía:

> **No se vende sin caja abierta** y solo hay **una caja abierta** a la vez (restricción en la base de datos, no solo en la interfaz).

El cliente aprobó exceptuar las ventas de Mercado Libre. La regla ya quedó así en `specs/constitution.md`:

> **No se vende en el local sin caja abierta** y solo hay **una caja abierta** a la vez (restricción en la base de datos, no solo en la interfaz). Las ventas de Mercado Libre son la única excepción: las cobra Mercado Libre, no generan movimientos de caja y se registran con o sin caja abierta.

La regla 10 queda igual: cuando una venta no tiene caja, lo que se guarda junto es la venta, los ítems y los movimientos de stock.

## 10. Preguntas abiertas

**Respondidas (2026-11-19):**

- **Modalidad de envío:** Mercado Envíos, despachando en un correo o una sucursal de Mercado Libre (RF-16).
- **Impresora:** de etiquetas de 10 × 15 cm (3nStar POSVENT), ya configurada (RF-16).
- **Aviso de despacho por vencer:** 4 horas antes (RF-17).
- **Fecha de inicio** (RF-9b): se define el día que arranca el cliente.
- **Filtro Origen:** "Local" agrupa mostrador y pedidos por encargo (RF-22), como estaba propuesto.
- **Margen:** descuenta lo que cobra Mercado Libre (RF-24), como estaba propuesto.
- **Compra sin stock:** aviso propio y destacado (RF-10b).

**Para la prueba técnica**, con una cuenta de prueba vendedora conectada y otra cuenta de prueba compradora (las cuentas de prueba solo operan entre ellas; una cuenta real no puede comprarles):

1. Que la cuenta de prueba vendedora tenga Mercado Envíos y se pueda publicar con envío.
2. Qué aviso llega al comprar (tema `orders_v2`) y la forma de la orden: ítems, precio, lo que cobra Mercado Libre, comprador, paquete y envío.
3. Un carrito de dos productos: cómo se ve el paquete.
4. El envío: estados, fecha límite de despacho y la etiqueta en PDF de 10 × 15 cm.
5. Cómo se marca el riesgo de fraude.
6. Cancelar la compra antes del despacho: qué aviso llega y cómo queda la orden.
