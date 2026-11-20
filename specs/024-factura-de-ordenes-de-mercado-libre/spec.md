# Spec 024 — Factura de órdenes de Mercado Libre

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 022, 023 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 ("Ampliación de alcance"); decisión 0005; `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, secciones 1.7 y 2 |

## 1. Objetivo

Que cada orden de Mercado Libre tenga su factura electrónica: emitida con los datos fiscales del comprador, enviada a Mercado Libre para que el comprador la reciba, e impresa para despacharla dentro del paquete.

Es el cierre del pedido original del cliente: llega la orden, se factura, se imprime y sale con el producto.

## 2. Alcance

**Incluye:**

- Emitir la factura C de una orden de Mercado Libre con los datos fiscales que el comprador cargó en Mercado Libre.
- Subir el PDF de la factura a la compra en Mercado Libre.
- Imprimir la factura junto con la etiqueta de envío, en un solo paso de preparación.
- La nota de crédito cuando se cancela una orden ya facturada.
- El seguimiento de facturas pendientes de emitir o de subir.

**No incluye:**

- La emisión en sí, el PDF, la numeración y el manejo de las caídas de ARCA: todo eso es la spec 023 y acá se reutiliza.
- El Facturador de Mercado Libre (decisión 0005: no se usa).
- Mensajes al comprador avisando de la factura: Mercado Libre le avisa por su cuenta.
- Facturas A o B: el cliente es monotributista.
- Devoluciones parciales.

## 3. Historias de usuario

- Como **empleado**, quiero preparar una orden en un solo paso que me deje la factura y la etiqueta listas para imprimir, para armar el paquete sin vueltas.
- Como **dueño**, quiero que la factura salga con los datos que el comprador cargó en Mercado Libre, para no tipearlos.
- Como **dueño**, quiero que la factura le llegue al comprador por Mercado Libre, para cumplir con lo que la plataforma pide.
- Como **dueño**, quiero que si una orden facturada se cancela se emita sola la nota de crédito, para que lo facturado coincida con lo vendido.
- Como **dueño**, quiero saber si alguna orden quedó sin factura o sin subir, para resolverlo antes de despachar.

## 4. Requisitos funcionales

**Preparar la orden**

- **RF-1.** Una orden en estado "para preparar" (spec 022) tiene la acción **"Preparar envío"**. Emite la factura, la sube a Mercado Libre y deja a mano dos impresiones: la factura y la etiqueta de envío.
- **RF-2.** "Preparar envío" no está disponible en una orden con riesgo de fraude, cancelada o sin los datos fiscales del emisor completos (spec 023).
- **RF-3.** Antes de emitir, el sistema muestra los datos del comprador que va a usar y el total. El usuario confirma.

**Datos del comprador**

- **RF-4.** Los datos del comprador para la factura salen de Mercado Libre: nombre o razón social, tipo y número de documento, domicilio fiscal y situación fiscal.
- **RF-5.** La condición frente al IVA del comprador se obtiene de la situación fiscal que informa Mercado Libre. Si no viene informada y el documento es un DNI, se toma como Consumidor Final.
- **RF-6.** Si faltan el documento o el nombre y el total no alcanza el monto que obliga a identificar al comprador (spec 023, RF-9), la factura sale a Consumidor Final.
- **RF-7.** Si faltan y el total sí alcanza ese monto, la factura no se emite: el sistema explica qué falta y permite cargar los datos a mano.
- **RF-8.** El usuario puede corregir a mano los datos del comprador antes de confirmar. El sistema registra que se modificaron.

**Emisión**

- **RF-9.** La factura es siempre clase C, por el total de los productos de la compra al precio al que se vendieron. El detalle lista cada producto con su cantidad y precio.
- **RF-10.** El envío que el comprador le paga a Mercado Libre no se incluye en la factura.
- **RF-11.** Una compra tiene como máximo una factura, aunque incluya varios productos.
- **RF-12.** La emisión usa el mecanismo de la spec 023: si ARCA no responde, la factura queda pendiente, con reintento y control de duplicados.

**Envío a Mercado Libre**

- **RF-13.** Una vez autorizada, el sistema sube el PDF de la factura a la compra en Mercado Libre.
- **RF-14.** Si la subida falla, la factura queda "emitida, sin subir" y se reintenta desde la orden y en el control diario.
- **RF-15.** La orden muestra el estado de su factura: sin factura, pendiente de autorización, emitida sin subir, o emitida y subida.
- **RF-16.** El sistema no envía mensajes al comprador por la factura.

**Impresión**

- **RF-17.** La factura de una orden se imprime en hoja A4, para incluirla en el paquete.
- **RF-18.** La etiqueta de envío (spec 022) se ofrece al lado de la factura. Si la factura quedó pendiente, la etiqueta se puede imprimir igual, con una advertencia de que la orden todavía no tiene factura.

**Cancelaciones**

- **RF-19.** Si se cancela una orden con factura emitida, el sistema emite la nota de crédito C por el total, con el mecanismo de la spec 023.
- **RF-20.** Si se cancela una orden con la factura pendiente de autorización, la factura se descarta y no se emite nota de crédito.

**Seguimiento**

- **RF-21.** La pantalla de órdenes (spec 022) permite filtrar por estado de la factura.
- **RF-22.** Las facturas de órdenes aparecen en la pantalla de comprobantes (spec 023) con origen "Mercado Libre" y suman al acumulado contra el tope del monotributo.
- **RF-23.** La campanita avisa cuando hay órdenes despachadas sin factura subida.

## 5. Reglas de negocio

- **Las órdenes de Mercado Libre se facturan siempre** (`docs/PROJECT.md`, sección 5). No es opcional como en el local.
- **La factura la emite el sistema**, no el Facturador de Mercado Libre (decisión 0005). Usar los dos a la vez duplicaría comprobantes.
- **Transición** *(agregado 2026-11-11)*. El cliente va a vender en Mercado Libre antes de que el sistema esté listo, y mientras tanto factura por otro medio (el Facturador de Mercado Libre o la web de ARCA, según indique su contador). Al poner en marcha esta spec:
  - Se desactiva antes la emisión automática del Facturador de Mercado Libre, si estaba en uso.
  - El sistema solo factura compras posteriores a la fecha de inicio (spec 022, RF-9b).
  - El sistema nunca factura una compra que ya tiene una factura cargada en Mercado Libre.
- **Siempre factura C**, aunque el comprador tenga CUIT o haya pedido IVA discriminado. La regla de Mercado Libre "CUIT → factura A, DNI → factura B" es para vendedores responsables inscriptos.
- **La factura se emite al preparar el envío**, no al entrar la compra. Así no se factura lo que se cancela en los primeros minutos ni lo que Mercado Libre marca con riesgo de fraude.
- **El dato fiscal del comprador es el de Mercado Libre.** El domicilio de la factura es el fiscal, que puede ser distinto del de entrega.
- **Mercado Libre le avisa al comprador** cuando se sube la factura. Mandar mensajes propios por lo mismo puede hacer que la cuenta sea observada.
- **Condiciones que impone Mercado Libre:** un solo PDF por compra, de hasta 1 MB.
- **Datos personales:** los datos fiscales del comprador se guardan solo para el comprobante y los ve quien puede ver la orden.
- Valen todas las reglas de la spec 023: un comprobante no se edita ni se borra, la numeración es de ARCA y la operación no se frena por ARCA.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Preparar envío (emitir y subir la factura) | Permiso "editar" en Mercado Libre |
| Corregir los datos del comprador antes de emitir | Permiso "editar" en Mercado Libre |
| Reintentar la emisión o la subida | Permiso "editar" en Mercado Libre |
| Ver e imprimir la factura de una orden | Permiso "ver" en Mercado Libre |
| Nota de crédito por cancelación | Automática |

## 7. Casos borde y errores

- **Mercado Libre no devuelve los datos fiscales del comprador:** se aplican el RF-6 o el RF-7 según el monto.
- **El comprador cambió sus datos fiscales después de comprar:** se usan los vigentes al momento de preparar el envío.
- **ARCA rechaza el documento del comprador:** la factura queda pendiente; se puede corregir el dato o emitir a Consumidor Final si el monto lo permite.
- **ARCA no responde al preparar:** la factura queda pendiente; la etiqueta se puede imprimir con la advertencia del RF-18.
- **La subida a Mercado Libre falla:** queda "emitida, sin subir" (RF-14). La factura impresa sale igual.
- **El PDF supera 1 MB:** no debería ocurrir; si ocurre, el sistema lo informa como error y no lo sube.
- **La compra ya tiene un archivo de factura cargado en Mercado Libre** (por ejemplo, subido a mano desde la web): el sistema lo informa y no lo pisa sin confirmación.
- **Se intenta preparar dos veces la misma orden:** no se emite otra factura; se muestran la que ya existe y las impresiones.
- **La orden se cancela mientras se está emitiendo la factura:** si la factura llegó a autorizarse, se emite la nota de crédito.
- **Orden con un producto "sin vincular"** (spec 022): se factura igual, con la descripción que trae Mercado Libre.
- **Compra por un monto que supera lo que queda del tope del monotributo:** se emite igual. El tope es solo informativo (spec 023, RF-27).
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.

## 8. Criterios de aceptación

- [ ] "Preparar envío" en una orden de prueba emite una factura C con los datos del comprador que informa Mercado Libre.
- [ ] La factura aparece cargada en la compra, vista desde la cuenta del comprador de prueba.
- [ ] Una compra con dos productos genera una sola factura con los dos en el detalle.
- [ ] El envío pagado por el comprador no figura en la factura.
- [ ] Una orden sin datos fiscales del comprador y de monto bajo se factura a Consumidor Final.
- [ ] Una orden con riesgo de fraude no permite preparar el envío.
- [ ] Con ARCA sin responder, la factura queda pendiente y la etiqueta se imprime con la advertencia.
- [ ] Con la subida fallida, la factura queda "emitida, sin subir" y el reintento la sube.
- [ ] Preparar dos veces la misma orden no duplica la factura.
- [ ] Cancelar una orden facturada emite la nota de crédito.
- [ ] La factura de la orden aparece en la pantalla de comprobantes con origen "Mercado Libre" y suma al acumulado.
- [ ] Hay pruebas unitarias de: traducción de los datos fiscales de Mercado Libre a los del comprobante, decisión entre identificar al comprador y Consumidor Final, armado del detalle desde un carrito, y decisión de nota de crédito según el estado de la factura.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

**Para el cliente:**

1. **Cuándo se factura.** La propuesta es al preparar el envío, con un botón. La alternativa es automática, apenas entra la compra: ahorra un paso pero genera notas de crédito por las cancelaciones tempranas. ¿Cuál prefiere?
2. **Impresora.** La factura de la orden va en hoja A4. ¿El local tiene una impresora común además de la de tickets?

**Para el contador:**

3. **Importe.** ¿La factura es por el precio de los productos, sin el envío que cobra Mercado Libre? Es la propuesta.
4. **Descuentos de Mercado Libre.** Si Mercado Libre le hace un descuento al comprador con un cupón propio, ¿se factura el precio publicado o lo que pagó el comprador?
5. **Comprador que pide IVA discriminado.** Como monotributista solo se puede emitir factura C. ¿Hace falta alguna aclaración en el comprobante?

**A confirmar en la prueba técnica:**

6. **Nota de crédito y Mercado Libre.** Cuando se cancela una orden facturada, ¿la factura subida se deja, se borra o se reemplaza por la nota de crédito? Mercado Libre admite un solo PDF por compra.
7. **Datos que realmente devuelve Mercado Libre** para un comprador con DNI y para uno con CUIT, y con qué nombres llega la situación fiscal.
8. **Plazo.** Si Mercado Libre exige subir la factura dentro de algún plazo en Argentina.
9. **Facturador de Mercado Libre.** Confirmar que su emisión automática se puede desactivar una vez activada, para el cambio al sistema.
