# 0005 — Factura electrónica emitida por el sistema

- **Fecha:** 2026-11-10
- **Estado:** Aceptada

## Contexto

Mercado Libre pide que el comprador reciba la factura de cada venta. El cliente quiere además poder facturar en el mostrador. La decisión 0003 dejaba la facturación fuera del sistema.

Se evaluaron dos caminos para las ventas de Mercado Libre: el Facturador de Mercado Libre (gratuito, emite y envía la factura solo) o que el sistema emita la factura contra ARCA y la suba a Mercado Libre. El Facturador no sirve para el mostrador.

El cliente es monotributista, categoría B, venta de cosas muebles.

## Decisión

- **El sistema emite las facturas electrónicas contra ARCA**, para Mercado Libre y para el local. No se usa el Facturador de Mercado Libre.
- El comprobante es siempre **factura C**.
- Las **órdenes de Mercado Libre se facturan siempre**.
- En el **local** (mostrador y entregas de pedidos por encargo) la factura es **opcional y la decide el cajero** en cada venta.
- El **ticket de 58 mm sigue siendo un documento interno**, con su leyenda. La factura es un comprobante aparte.

## Consecuencias

- Reemplaza la decisión 0003 en lo que hace a "el sistema no emite comprobantes fiscales". Lo del ticket sigue vigente.
- Facturación electrónica deja de estar fuera de alcance: specs 023 y 024. Se cotiza aparte.
- El Facturador de Mercado Libre y el sistema no pueden emitir a la vez: duplicaría comprobantes.
- *(Agregado 2026-11-11.)* Mientras el sistema no esté listo, el cliente vende en Mercado Libre y factura por otro medio, que define su contador; puede ser el Facturador de Mercado Libre. Al poner en marcha la spec 024 se desactiva ese medio, y el sistema solo factura compras posteriores a la fecha de inicio y sin factura ya cargada.
- El cliente y su contador tienen que gestionar en ARCA un certificado digital y un punto de venta para servicios web.
- Todo lo facturado suma para el tope anual de la categoría del monotributo. Vendiendo por Mercado Libre ese tope se alcanza rápido. El sistema muestra el acumulado y avisa una vez al cruzar el 80 %, solo para informar al contador: pasarse del tope no bloquea la facturación.
- Quedan para el contador: la actividad registrada para la venta en local, la factura opcional en mostrador, y el tratamiento de la seña.
- El sistema pasa a depender de un servicio externo para lo fiscal. La regla es que una venta nunca se frena por ARCA: la factura queda pendiente y se completa después.
