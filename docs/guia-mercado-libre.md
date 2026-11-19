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

Si Mercado Libre no responde en el momento, el precio cambia igual en el sistema y la publicación muestra **Pendiente de enviar**. El sistema lo reintenta solo; también podés tocar **Reintentar envíos**.

## Pausar, reactivar y finalizar

Desde la pantalla de publicaciones, en el menú de cada fila:

- **Pausar** y **Reactivar**: la publicación deja de venderse y vuelve, con su historial.
- **Finalizar**: es definitivo. Para volver a venderlo hay que crear una publicación nueva en Mercado Libre y vincularla.
- **Deshacer vínculo**: la publicación sigue en Mercado Libre, pero el sistema deja de administrarla.

Si desactivás un producto en el catálogo, su publicación se pausa sola.

## Avisos

Cualquier cambio que se haga en Mercado Libre sobre una publicación vinculada (el precio, el SKU, pausarla, reactivarla, finalizarla, o que Mercado Libre la observe o la dé de baja) aparece como aviso en la campanita, con el detalle. Las pausas por falta de stock no avisan.

La pantalla de publicaciones se actualiza sola cada minuto; también podés tocar **Actualizar**.

Si hay publicaciones activas en Mercado Libre que no están vinculadas, la pantalla lo advierte: sus ventas no descuentan stock del sistema.

## Lo que todavía no hace

Llega en las próximas etapas:

- **La cantidad publicada no sigue al stock.** Se envía una sola vez, al vincular. Hasta que esté la sincronización de stock (spec 021), si vendés en el local, la cantidad en Mercado Libre no baja sola.
- **Las ventas de Mercado Libre no entran al sistema** ni descuentan stock hasta que esté la parte de órdenes (spec 022).
- **Publicar un producto nuevo desde el sistema** (spec 025). Por ahora se publica en Mercado Libre y después se vincula.
