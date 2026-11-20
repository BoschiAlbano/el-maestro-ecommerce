# Prueba técnica 022 — resultados

> Primera ronda, 2026-11-19. Cuenta de prueba vendedora (`TESTUSER1794626107`) conectada al sistema y cuenta de prueba compradora (`TESTUSER1090254404`). La compradora compró la billetera (`MLA2304418309`, una variante, Mercado Envíos con despacho en correo) y pagó con dinero cargado en la cuenta: con las tarjetas de prueba el pago se rechazó. Los scripts fueron temporales, de solo lectura, y viven fuera del repositorio.

## Estado

**Hecha.** Puntos 1, 2, 3, 4 y 6 con resultado. El riesgo de fraude (punto 5) no se puede provocar con cuentas de prueba.

## Resultados

| Punto | Resultado |
|---|---|
| 1. Mercado Envíos en la cuenta de prueba | La cuenta figura con Mercado Envíos `not_accepted`, pero la publicación salió con `me2` / `xd_drop_off` y el envío se creó bien. Lo que importa es la publicación. |
| 2. Aviso de la compra | Llegaron dos avisos `orders_v2` (recurso `/orders/{id}`) y dos `shipments` (`/shipments/{id}`), unos segundos después de pagar. Hoy quedan como «sin acción». |
| 2. La orden | `GET /orders/{id}`: `status: paid`, `tags: [paid, not_delivered, test_order]`, `pack_id: null` (un solo producto), `date_created` y `date_closed` con la zona de Mercado Libre (−04:00), `buyer: { id, nickname }`, `shipping: { id }`. |
| 2. Los ítems | `order_items[]`: `item.id`, **`item.variation_id`** (la variante de la billetera), **`item.seller_sku`**, `quantity`, `unit_price` y **`sale_fee`** (lo que cobra Mercado Libre **por unidad**: 1.730 sobre 2.500 en la prueba). |
| 2. Importes | `total_amount` (2.500) es lo de los productos. `paid_amount` (13.990) suma el envío que pagó el comprador (`payments[].shipping_cost`: 11.490). |
| 2. Pagos | `payments[]` trae **todos los intentos**: uno con tarjeta `rejected` y otro con dinero en cuenta `approved`. Para saber si está pagada se usa `status: paid` de la orden, no el primer pago. |
| 4. El envío | `GET /shipments/{id}`: `status: ready_to_ship`, `substatus: ready_to_print`, `mode: me2`, `logistic_type: xd_drop_off`. La dirección de entrega trae nombre, domicilio, código postal y teléfono del comprador (datos personales). |
| 4. Costo del envío | `GET /shipments/{id}/costs`: el comprador pagó 11.490 y el vendedor **0** (`senders[].cost`). |
| 4. Fecha límite de despacho | `GET /shipments/{id}/sla`: `expected_date` (2026-11-24 23:59 −03:00) y `status: on_time`. Coincide con «Despachar: martes 24/nov» de la etiqueta. |
| 4. Etiqueta | `GET /shipment_labels?shipment_ids={id}&response_type=pdf` devuelve un **PDF en A4**: la etiqueta de 10 × 15 en la esquina de una hoja apaisada, y una segunda hoja con el detalle del paquete (SKU, cantidad, variante). Con `response_type=zpl2` devuelve un ZIP con un `.txt` en ZPL (para impresoras térmicas tipo Zebra) y el mismo detalle en PDF. **No hay un PDF de 10 × 15 listo.** |
| La publicación después de la venta | Mercado Libre bajó la cantidad a 0 y la pausó por falta de stock. El sistema la tomó como «pausada sin stock» y **no volvió a subir la cantidad** (spec 021: una cantidad menor que llega por aviso espera a la venta). El stock del sistema sigue en 1 porque la 022 todavía no registra la compra. |

## Cancelación antes del despacho (punto 6)

El usuario canceló la compra desde la cuenta vendedora, antes de despachar.

- **Avisos:** varios `orders_v2` y un `shipments`, y uno nuevo, `orders_feedback` (`/orders/{id}/feedback`), que no hace falta.
- **La orden:** `status: cancelled`, `tags: [not_delivered, not_paid, test_order]` y `cancel_detail: { group: seller, code: feedback_out_of_stock, requested_by: seller, date }`: quién la canceló, por qué y cuándo.
- **El pago:** el aprobado pasó a `refunded`, con `transaction_amount_refunded` igual a lo pagado.
- **El envío:** `status: cancelled`.
- **En la verificación (2026-11-19)** se vio además que, al cancelar el vendedor con el motivo «sin stock», Mercado Libre **pausa la publicación** (estado `paused`, sin subestado). El sistema lo toma como «Se pausó desde Mercado Libre» y no la reactiva solo: la reactiva el dueño.
- **La publicación:** Mercado Libre **no repuso la cantidad** (sigue en 0, pausada sin stock), porque el motivo fue «el vendedor no tiene stock». Con la 022, la cancelación devuelve la unidad al stock del sistema y la spec 021 le manda a Mercado Libre la cantidad que corresponde: no se depende de lo que haga Mercado Libre.

## Consecuencias para el plan

- **Avisos:** `orders_v2` y `shipments` se procesan con una función cada uno en `handlers.ts`; los dos llevan a la orden.
- **El ítem trae el SKU y la variante**, pero se busca por `item.id` en `ml_listings`: es la llave de verdad (spec 020, plan, riesgo 5).
- **Lo que cobra Mercado Libre** = `sale_fee × quantity` sumado por ítem. **El envío a cargo del vendedor** sale de `/shipments/{id}/costs`.
- **Fecha límite de despacho** desde `/shipments/{id}/sla`.
- **Etiqueta para la impresora de 10 × 15:** se recorta el PDF de Mercado Libre al rectángulo de la etiqueta, con la hoja A4 completa como alternativa *(decisión 2026-11-19: el cliente todavía no vende por Mercado Libre y no tiene un método armado; PDF es lo más simple)*. ZPL queda descartado: un navegador no puede mandarlo directo a la impresora.
- **Pagada** = `status: paid` de la orden.
- **Cancelada antes del despacho** = `status: cancelled` con el envío todavía sin despachar (`ready_to_ship` o `cancelled` sin haber pasado por `shipped`). El motivo de `cancel_detail` se muestra en la orden.

## Carrito de dos productos (punto 3, segunda ronda)

La compradora compró juntos la billetera y un segundo producto, los dos de publicaciones con una variante.

- **Dos órdenes**, una por producto, con el **mismo `pack_id`** y el mismo `shipping.id`. Cada una con su `total_amount` y su `sale_fee`.
- **`GET /packs/{id}`** devuelve `orders: [{ id }, { id }]`, `shipment: { id }`, `status: released` y el comprador.
- **El envío es uno solo** con los dos productos (`shipping_items`). El vendedor pagó 0; el comprador, 11.990. Mismo plazo de despacho.
- **Llegaron dos avisos `orders_v2`, pero de una sola de las dos órdenes.** No hay que esperar un aviso por cada orden del paquete: a partir de cualquiera se lee el paquete entero.

**Consecuencia:** se confirma la sección 3.2 del plan (la compra es el paquete, `mlKey = pack:{id}`, total y lo que cobra Mercado Libre sumados de sus órdenes).
