# Guía: publicaciones de Mercado Libre

Para el dueño del negocio. Explica cómo conectar las publicaciones de Mercado Libre con los productos del sistema y qué pasa con el precio.

## Antes de empezar

- La cuenta de Mercado Libre tiene que estar conectada en **Configuración > Mercado Libre**.
- Las publicaciones se crean en Mercado Libre, como siempre. El sistema las toma desde ahí.
- Cargá el **SKU** en cada producto (en su ficha) y el mismo SKU en la publicación de Mercado Libre. Así el sistema encuentra solo qué publicación es de qué producto.
- Tené el **stock al día** antes de vincular: al vincular, la publicación queda con la cantidad que dice el sistema.

## Vincular

1. Entrá a **Mercado Libre** en el menú y tocá **Vincular publicaciones**.
2. Arriba aparecen las **propuestas**: publicaciones que coinciden con un producto por el SKU o el código de barras. Cada una muestra qué va a cambiar en Mercado Libre (precio, cantidad, SKU).
3. Revisá y tocá **Vincular**, o **Vincular todas**.
4. Las que no tienen propuesta se vinculan a mano: buscás el producto por nombre, código o SKU y lo elegís.

Al vincular **manda el sistema**: la publicación queda con el precio de venta, el SKU y la cantidad del producto.

Las publicaciones con variantes (talles, colores) o que se envían desde el depósito de Mercado Libre (Full) no se pueden vincular por ahora.

## Un solo precio

El precio de venta del producto es el mismo en el local y en Mercado Libre.

- Si lo cambiás en el sistema (en la ficha o en un ingreso de mercadería), se cambia en Mercado Libre.
- Si lo cambiás en Mercado Libre, se cambia en el sistema, también para el mostrador.
- Cada cambio queda en el historial de precios del producto, con quién lo hizo, o «Mercado Libre».
- Mercado Libre cobra una comisión por cada venta, y el sistema no la suma al precio. Si querés cubrirla, subí el precio del producto.

Si Mercado Libre no responde en el momento, el precio cambia igual en el sistema y la publicación muestra **Pendiente de enviar**. El sistema lo reintenta solo; también podés tocar **Sincronizar ahora**.

## Stock

La cantidad en Mercado Libre es siempre el stock del sistema. Cada venta, anulación, entrega de pedido, ingreso de mercadería, ajuste, merma o conteo la cambia sola, unos segundos después.

- **Con 0 unidades** Mercado Libre pausa la publicación por falta de stock, y la reactiva sola cuando vuelve a haber. Si la pausaste vos, sigue pausada aunque entre mercadería.
- **No hay stock de reserva:** se publica todo el stock. Si la última unidad se vende en el local y en Mercado Libre casi al mismo tiempo, una de las dos ventas queda sin mercadería. Es poco probable, pero conviene tener el inventario al día.
- La pantalla de publicaciones muestra **En Mercado Libre**, la cantidad que tiene publicada. En rojo, si no coincide con el stock.
- Si alguien cambia la cantidad a mano en Mercado Libre, el sistema la vuelve a poner. Si la baja, espera al control diario o a **Sincronizar ahora**, por si fue una venta que todavía no llegó.
- **Sincronizar ahora** envía lo pendiente y revisa todas las cantidades. Usalo después de un conteo grande o si Mercado Libre estuvo caído. Además el sistema lo hace solo una vez por día.
- Si algo queda sin enviar más de unos minutos, aparece un aviso en la campanita.

## Pausar, reactivar y finalizar

Desde la pantalla de publicaciones, en el menú de cada fila:

- **Pausar** y **Reactivar**: la publicación deja de venderse y vuelve, con su historial.
- **Finalizar**: es definitivo. Para volver a venderlo hay que crear una publicación nueva en Mercado Libre y vincularla.
- **Deshacer vínculo**: la publicación sigue en Mercado Libre, pero el sistema deja de administrarla.

Si desactivás un producto en el catálogo, su publicación se pausa sola.

## Avisos

La campanita separa los avisos en tres pestañas: **Todos**, **Sistema** (pedidos, caja, stock y facturación) y **Mercado Libre**. Cada una muestra cuántos tiene sin leer y tiene **Marcar todas como leídas**. Los urgentes (riesgo de fraude, venta sin stock, despacho vencido y conexión caída) se ven en rojo. Los avisos marcados «Ahora» se van solos cuando se resuelve lo que avisan.

Cualquier cambio que se haga en Mercado Libre sobre una publicación vinculada (el precio, el SKU, pausarla, reactivarla, finalizarla, o que Mercado Libre la observe o la dé de baja) aparece como aviso en la campanita, con el detalle. Las pausas por falta de stock no avisan.

La pantalla de publicaciones se actualiza sola cada minuto; también podés tocar **Actualizar**.

Si hay publicaciones activas en Mercado Libre que no están vinculadas, la pantalla lo advierte: sus ventas no descuentan stock del sistema.

## Órdenes

Cada compra pagada en Mercado Libre entra sola al sistema como una **venta de Mercado Libre**: descuenta el stock y avisa en la campanita. No pasa por la caja, porque el dinero lo cobra Mercado Libre.

- **Desde cuándo:** en Configuración > Mercado Libre se carga la fecha desde la que se registran las compras. Sin fecha no entra ninguna; se carga el día que se empieza.
- **Órdenes** (en el menú) muestra lo que hay que despachar, con la fecha límite. Las que vencen en menos de 4 horas se destacan y avisan en la campanita.
- **Preparar envío** (en la orden): ver la sección siguiente, «Factura de las órdenes».
- **Etiqueta:** en la orden, **Etiqueta 10 × 15** la abre lista para la impresora de etiquetas. Si algún día sale mal, **Etiqueta en hoja A4** da la de Mercado Libre tal cual.
- **Carrito:** si alguien compra varios productos juntos, queda como una sola venta con un solo envío.
- **Sin stock:** si entra una compra de algo que ya no hay, se registra igual y aparece un aviso destacado: conseguí el producto o cancelá la compra en Mercado Libre.
- **Riesgo de fraude:** si Mercado Libre lo marca, la orden lo advierte y no deja descargar la etiqueta. No la despaches.
- **Cancelaciones:** se cancelan en Mercado Libre. Si se cancela antes de despachar, el stock vuelve solo. Si se cancela o no se entrega después de despachar, cuando la mercadería vuelva usá **Reingresar al stock** en la orden. Ojo: si la cancelás vos diciendo que no tenés stock, Mercado Libre además **pausa la publicación**; cuando tengas el producto, reactivala desde Publicaciones.
- **Buscar órdenes nuevas:** la pantalla busca sola las compras que falten cada vez que se abre; el botón lo hace en el momento.
- **Analíticas:** el filtro **Origen** separa Local y Mercado Libre, y el margen descuenta lo que cobró Mercado Libre.

## Factura de las órdenes

Cada compra se factura cuando se prepara el paquete, con la facturación de ARCA del sistema (ver `guia-facturacion.md`).

1. En la orden, apretá **Preparar envío**.
2. La ventana muestra los datos de facturación que el comprador cargó en Mercado Libre: nombre, documento, condición frente al IVA y domicilio. Si algo está mal, corregilo ahí. Si el comprador no cargó datos y el monto es bajo, va a Consumidor Final; si el monto obliga a identificarlo, hay que cargar los datos a mano.
3. **Confirmar y emitir la factura**: se emite en ARCA y se sube sola a la compra en Mercado Libre, donde el comprador la ve.
4. Imprimí **Factura 10 × 15** y **Etiqueta 10 × 15** y pegá las dos en el paquete. Las dos también salen en hoja A4.

- **Si ARCA no responde**, la factura queda pendiente: la etiqueta se puede imprimir igual, y en la orden está **Reintentar en ARCA**. Cuando se autoriza, se sube sola.
- **Si falla la subida a Mercado Libre**, la orden queda «Emitida, sin subir» con el motivo y **Reintentar la subida**. Además, el sistema lo reintenta una vez por día.
- **Una compra que ya tenía factura en Mercado Libre** (por ejemplo, del Facturador de Mercado Libre) no se factura otra vez: la orden lo explica.
- **Si se cancela una compra facturada**, el sistema emite solo la nota de crédito. La nota no se sube a Mercado Libre: Mercado Libre admite un solo archivo por compra y no deja borrarlo.
- **Seguimiento:** en **Órdenes**, el filtro **Factura** muestra las que no tienen factura, las pendientes y las que faltan subir. La campanita avisa si hay órdenes despachadas sin la factura subida. En **Comprobantes**, el filtro **Origen** separa las del local y las de Mercado Libre.

## Lo que todavía no hace

Llega en la próxima etapa:

- **Publicar un producto nuevo desde el sistema** (spec 025). Por ahora se publica en Mercado Libre y después se vincula.
