# Prueba técnica 024 — resultados

> Se corrió el 2026-11-20 con la cuenta de prueba vendedora conectada, la compradora de prueba y ARCA en **homologación** (las facturas no tienen validez fiscal). La compradora compró la billetera; la compra se facturó con el mecanismo de la spec 023, se subió el PDF a Mercado Libre y después la compradora la canceló. Los scripts fueron temporales y viven fuera del repositorio.

## Estado

**Hecha.** Quedan sin probar el comprador con CUIT (la cuenta de prueba no deja cambiar sus datos fiscales) y las preguntas 8 y 9 de la spec, que se responden con documentación y con el cliente.

## Resultados

| Punto | Resultado |
|---|---|
| 7. Datos fiscales del comprador | La orden trae `buyer.billing_info.id`. Con él, `GET /orders/billing-info/MLA/{id}` con el encabezado `x-version: 2` devuelve `name`, `last_name`, `identification: { type: DNI, number }`, `taxes.taxpayer_type: { id: "05", description: "Consumidor Final" }` y el domicilio (`street_name`, `street_number`, `city_name`, `state`, `zip_code`). La ruta vieja `/orders/{id}/billing_info` trae lo mismo en una lista de pares. El código `05` coincide con el de ARCA para Consumidor Final (spec 023). |
| Emisión | `issueInvoiceForExistingSale` (spec 023) sobre la venta que creó la spec 022: factura C N.º 91, autorizada con CAE, por 2.500, a nombre de «Test Test», DNI 1111111, Consumidor Final. La compra se registró con «Buscar órdenes nuevas» porque los avisos no estaban llegando (el servidor local estaba apagado). |
| PDF | El A4 de la spec 023 pesa 16 KB (el límite de Mercado Libre es 1 MB). |
| Subida | `POST /packs/{pack_id}/fiscal_documents` con el archivo en el campo `fiscal_document` (multipart): 201 y un id. Sin paquete, el `pack_id` es el número de la orden. `GET` de la misma ruta lista el archivo; si no hay ninguno responde **404**, que significa «sin factura cargada». La compradora ve la factura en su compra (verificado por el usuario). |
| 6. Cancelación con factura subida | La compradora canceló (`cancel_detail.code: buyer_cancel_express`). **La factura sigue cargada.** Subir otro archivo da **409** («ya existe un archivo para el paquete»), aunque la compra esté cancelada, y **no se puede borrar** (`DELETE` da 405). |
| Error encontrado en la spec 022 | Mercado Libre canceló primero el **envío** y un momento después la **orden**. El sistema marcó la compra como cancelada con el envío y, al llegar la cancelación de la orden, no la procesó: la venta quedó sin anular y el stock sin volver. **Corregido:** un envío cancelado solo no cambia el estado, y una compra marcada como cancelada sin procesar se procesa con el aviso siguiente. Se volvió a procesar dos veces en paralelo: venta anulada, stock devuelto una vez, un aviso. |

## Consecuencias para la spec y el plan

- **La nota de crédito no se sube a Mercado Libre** (pregunta 6): se emite en ARCA y queda en el sistema, en Comprobantes. La factura subida queda en la compra.
- **Lo subido no se corrige:** antes de subir, el sistema tiene que estar seguro. Solo se sube una factura autorizada, después de que el usuario confirmó los datos (RF-3).
- **Datos fiscales:** se leen de `billing-info` versión 2. El tipo de contribuyente se traduce a la condición frente al IVA de ARCA por su código.
- **«Sin factura cargada»** es el 404 de la lista de documentos.
