# Spec 023 — Facturación electrónica (ARCA)

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 003, 008, 009 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 ("Ampliación de alcance"); decisión 0005; `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 2 |

## 1. Objetivo

Que el sistema emita facturas electrónicas con autorización de ARCA para las ventas del local, cuando el cajero lo decide, y las notas de crédito cuando una venta facturada se anula.

Esta spec construye la facturación en sí. La spec 024 la usa para las órdenes de Mercado Libre.

No depende de Mercado Libre: se puede desarrollar antes o en paralelo a las specs 019 a 022.

## 2. Alcance

**Incluye:**

- Los datos fiscales del negocio en Configuración.
- Emitir una **factura C** al confirmar una venta de mostrador o la entrega de un pedido por encargo, si el cajero lo elige.
- Emitir la factura de una venta ya hecha que no se facturó en el momento.
- La nota de crédito automática al anular una venta facturada.
- El comprobante en PDF y su impresión, con código QR.
- Una pantalla de comprobantes emitidos, con reimpresión y exportación.
- El acumulado facturado contra el tope de la categoría del monotributo.
- Manejo de las caídas de ARCA: la venta no se frena y la factura queda pendiente.

**No incluye:**

- Facturas A, B, M y de exportación. El cliente es monotributista: todo es clase C.
- Notas de débito.
- Notas de crédito parciales: la anulación de una venta es total (spec 008).
- Facturar la seña de un pedido por separado.
- Más de un punto de venta.
- Percepciones, retenciones y cualquier cálculo de impuestos.
- Presentaciones ante ARCA, recategorización y libros contables.
- La factura de las órdenes de Mercado Libre (spec 024).

Esta spec **modifica el comportamiento de las specs 008 y 009**: agrega la opción de facturar al cobrar. Al aprobarse, el cambio se anota en ambas.

## 3. Historias de usuario

- Como **cajero**, quiero elegir en cada venta si sale con factura o con el ticket de siempre, para darle factura al cliente que la pide.
- Como **cajero**, quiero que la factura se imprima sola al confirmar, para no hacer pasos de más.
- Como **cajero**, quiero poder facturar una venta que ya hice, para el cliente que vuelve a pedir la factura.
- Como **cajero**, quiero que si ARCA no responde la venta se cobre igual, para no dejar al cliente esperando.
- Como **dueño**, quiero que al anular una venta facturada se emita sola la nota de crédito, para que lo fiscal no quede descuadrado.
- Como **dueño**, quiero ver todos los comprobantes emitidos y exportarlos, para pasárselos al contador.
- Como **dueño**, quiero ver cuánto llevo facturado contra el tope de mi categoría, para no pasarme sin darme cuenta.

## 4. Requisitos funcionales

**Configuración fiscal**

- **RF-1.** Configuración tiene una sección "Facturación" con los datos del emisor: razón social, CUIT, domicilio comercial, condición frente al IVA (Responsable Monotributo), número de Ingresos Brutos, fecha de inicio de actividades y número de punto de venta.
- **RF-2.** La sección muestra el estado de la conexión con ARCA: si está en modo de prueba o real, si la última consulta funcionó y la fecha de vencimiento del certificado.
- **RF-3.** "Probar conexión" consulta a ARCA y muestra el resultado y el último número de factura autorizado para el punto de venta.
- **RF-4.** Mientras los datos del RF-1 estén incompletos o la conexión no funcione, la opción de facturar no se ofrece en las ventas y la sección explica qué falta.
- **RF-5.** El sistema avisa en la campanita cuando al certificado le faltan 30 días o menos para vencer.
- **RF-6.** La sección guarda el **tope anual de facturación** de la categoría del monotributo, cargado a mano por el dueño.

**Emitir al vender**

- **RF-7.** Al cobrar una venta de mostrador (spec 008) o la entrega de un pedido (spec 009), el cajero elige **con factura** o **sin factura**. Por defecto, sin factura.
- **RF-8.** Con factura, el cajero puede dejarla a **Consumidor Final** sin más datos, o identificar al comprador con tipo y número de documento (DNI o CUIT), nombre o razón social, y su condición frente al IVA.
- **RF-9.** Si el total de la venta alcanza el monto desde el que ARCA exige identificar al comprador, los datos del RF-8 son obligatorios. Ese monto se guarda en la configuración.
- **RF-10.** La venta se confirma primero, con sus reglas de siempre. Recién después el sistema pide a ARCA la autorización de la factura.
- **RF-11.** Si ARCA autoriza, la factura queda **emitida**, con su número, el código de autorización y su vencimiento, y se ofrece imprimirla.
- **RF-12.** Si ARCA no responde o rechaza, la venta **queda hecha** y la factura queda **pendiente**, con el motivo. El cajero ve el aviso y puede reintentar; mientras tanto puede entregar el ticket.
- **RF-13.** Antes de reintentar una factura pendiente, el sistema verifica con ARCA si el intento anterior llegó a autorizarse, para no emitir dos facturas por la misma venta.
- **RF-14.** Una venta tiene como máximo una factura.

**Facturar una venta ya hecha**

- **RF-15.** Desde el detalle de una venta sin factura y sin anular se puede "Emitir factura", con los mismos datos del RF-8. La factura lleva la fecha del día en que se emite.
- **RF-16.** Solo se puede facturar después una venta hecha dentro del plazo que se define en la pregunta abierta 2.

**Nota de crédito**

- **RF-17.** Al anular una venta facturada (spec 008), el sistema emite una nota de crédito C por el total, asociada a esa factura.
- **RF-18.** La anulación de la venta no espera a ARCA: se anula con sus reglas de siempre. Si la nota de crédito no se autoriza, queda **pendiente**, con reintento y con el control del RF-13.
- **RF-19.** Mientras haya facturas o notas de crédito pendientes, la campanita muestra un aviso con la cantidad.

**Comprobante**

- **RF-20.** Cada factura y cada nota de crédito tiene un PDF con: los datos del emisor (RF-1), tipo y letra del comprobante, punto de venta y número, fecha, datos del comprador, detalle de productos con cantidad, precio unitario e importe, total, código de autorización con su vencimiento y código QR de ARCA.
- **RF-21.** El comprobante se puede imprimir en hoja A4 y en la impresora de tickets de 58 mm. El contenido es el mismo; cambia la disposición.
- **RF-22.** Una venta facturada imprime la factura en lugar del ticket. El ticket interno sigue disponible para reimprimir desde el detalle de la venta y conserva su leyenda.
- **RF-23.** Reimprimir un comprobante no emite nada nuevo: vuelve a mostrar el mismo.

**Comprobantes emitidos**

- **RF-24.** Una pantalla "Comprobantes" lista facturas y notas de crédito con: tipo, número, fecha, comprador, total, estado (emitida o pendiente), origen (local o Mercado Libre) y la venta relacionada. Se filtra por fecha, tipo, estado y origen.
- **RF-25.** La pantalla muestra el total facturado en el período filtrado, neto de notas de crédito.
- **RF-26.** La lista se exporta a Excel con las mismas columnas, para el contador.
- **RF-27.** La pantalla muestra lo facturado en los últimos 12 meses, neto de notas de crédito, contra el tope del RF-6. Cuando ese acumulado cruza el 80 % del tope, se genera un aviso en la campanita. Es una **advertencia informativa**, para que el dueño le avise al contador: no bloquea ni limita la facturación, y no hay otro aviso al llegar al tope ni al pasarlo.

## 5. Reglas de negocio

- **Siempre factura C.** El cliente es monotributista (`docs/PROJECT.md`, sección 5). No hay IVA que discriminar ni que calcular.
- **En el local, la factura es opcional y la decide el cajero en cada venta** (`docs/PROJECT.md`, sección 5).
- **La venta no depende de ARCA.** Cobrar y descontar stock nunca se frena por la factura. Lo fiscal se completa después si hace falta (RF-12).
- **Un comprobante autorizado no se edita ni se borra.** La única forma de dejarlo sin efecto es una nota de crédito.
- **La numeración la da ARCA**, correlativa por punto de venta y tipo de comprobante.
- **El total facturado es el total de la venta**, ya redondeado al peso (constitución, regla 6). En la entrega de un pedido con seña, la factura es por el total de la venta que se entrega: la seña aplicada es parte del pago, no un descuento.
- **El ticket sigue siendo un documento interno** y siempre lleva la leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA" (constitución, regla 25). La regla no cambia: la factura es otro documento.
- **La fecha del comprobante es la del día de emisión**, en la zona de Tucumán (regla 9).
- **Las credenciales de ARCA son secretos** (regla 16): no se cargan, no se ven ni se descargan desde la interfaz.
- **Modo de prueba.** En modo de prueba los comprobantes no tienen validez fiscal y el PDF lo dice de forma visible. El modo real se activa solo en producción.
- **Datos del comprador.** Son datos personales: se guardan los que exige el comprobante y los ve quien puede ver la venta.
- **El tope del monotributo es solo informativo** (decisión del cliente, 2026-11-10). El sistema nunca impide facturar por haberlo alcanzado o superado: qué hacer en ese caso es tarea del contador.
- **Condiciones que impone ARCA** (ver investigación, sección 2.4): condición frente al IVA del comprador obligatoria, identificación del comprador desde cierto monto, y código QR en el comprobante.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Emitir factura al vender o entregar un pedido | El mismo permiso que permite vender o entregar |
| Emitir la factura de una venta ya hecha | Permiso "crear" en Ventas |
| Reintentar un comprobante pendiente | Permiso "crear" en Ventas |
| Nota de crédito | Automática; la dispara quien puede anular la venta (spec 008) |
| Ver y reimprimir comprobantes | Permiso "ver" en Ventas |
| Exportar comprobantes | Permiso "exportar" en Ventas |
| Ver el acumulado contra el tope | Solo el rol Dueño |
| Editar los datos fiscales, el tope y el monto de identificación | Solo el rol Dueño |
| Probar la conexión con ARCA | Solo el rol Dueño |

## 7. Casos borde y errores

- **ARCA no responde al facturar:** la venta queda hecha, la factura pendiente (RF-12).
- **ARCA rechaza por un dato del comprador** (por ejemplo, un CUIT inexistente): la factura queda pendiente, el sistema muestra el motivo en español y permite corregir el dato y reintentar.
- **Se pierde la respuesta de ARCA** (se autorizó pero el sistema no se enteró): el RF-13 lo detecta y recupera el comprobante en lugar de emitir otro.
- **Dos usuarios facturan al mismo tiempo:** las facturas salen con números correlativos sin repetirse ni saltearse.
- **Se anula una venta cuya factura está pendiente:** la factura pendiente se descarta y no se emite nota de crédito, porque nunca existió un comprobante.
- **Se anula una venta facturada y ARCA está caído:** la venta se anula, la nota de crédito queda pendiente y se avisa (RF-18).
- **El certificado venció:** no se puede facturar; el sistema lo explica y las ventas siguen saliendo con ticket.
- **Datos fiscales incompletos:** la opción de facturar no aparece (RF-4).
- **CUIT o DNI con formato inválido:** se rechaza antes de consultar a ARCA.
- **Venta por un monto que exige identificar al comprador, sin datos:** no se puede emitir hasta cargarlos; la venta ya está hecha y la factura queda pendiente.
- **Se intenta facturar una venta anulada o ya facturada:** se rechaza.
- **Se intenta facturar una venta fuera del plazo del RF-16:** se rechaza con la explicación.
- **Cambia el punto de venta en la configuración:** los comprobantes ya emitidos conservan el suyo.
- **Reinicio del sistema (spec 017):** los comprobantes autorizados existen en ARCA aunque se borren del sistema. El reinicio tiene que tratarlos aparte; se define al aprobar esta spec.
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.

## 8. Criterios de aceptación

- [ ] Con los datos fiscales completos, "Probar conexión" responde bien y muestra el último número autorizado.
- [ ] Con datos incompletos, la opción de facturar no aparece al cobrar.
- [ ] Una venta de mostrador "con factura" a Consumidor Final emite una factura C con número, código de autorización y QR.
- [ ] Una venta "sin factura" sale con el ticket de siempre, con su leyenda.
- [ ] Una factura con comprador identificado muestra sus datos en el comprobante.
- [ ] La entrega de un pedido con seña se factura por el total de la venta.
- [ ] Con ARCA sin responder, la venta se confirma, la factura queda pendiente y aparece el aviso.
- [ ] Reintentar una pendiente la emite; si el primer intento ya se había autorizado, no se duplica.
- [ ] Una venta sin factura se factura después desde su detalle.
- [ ] Anular una venta facturada emite la nota de crédito asociada.
- [ ] El comprobante se imprime en A4 y en 58 mm con todos los datos del RF-20, y el QR lleva a la verificación de ARCA.
- [ ] La pantalla de comprobantes filtra, totaliza y exporta a Excel.
- [ ] El acumulado de 12 meses se muestra contra el tope y genera un aviso al cruzar el 80 %.
- [ ] Con el acumulado por encima del tope, se sigue pudiendo facturar y no aparece ningún aviso más.
- [ ] Un usuario que no es Dueño no puede editar los datos fiscales.
- [ ] Hay pruebas unitarias de: armado de los datos del comprobante, validación de CUIT y DNI, exigencia de identificar al comprador según el monto, decisión de emitir o no la nota de crédito, control de duplicados al reintentar, y cálculo del acumulado.
- [ ] Todas las pruebas se hicieron en el modo de prueba de ARCA antes de activar el modo real.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

**Para el contador del cliente:**

1. **Actividad.** Las actividades registradas son venta por internet, expendio de comidas y peluquería. ¿Hay que sumar venta al por menor en local para facturar el mostrador?
2. **Facturar después.** ¿Hasta cuántos días después de una venta se puede emitir su factura, fechada el día de emisión? La propuesta es limitarlo a ventas de los últimos 5 días.
3. **Factura opcional.** ¿Es compatible con las obligaciones del cliente que en mostrador se facture solo cuando el cajero lo elige?
4. **Seña.** La seña de un pedido se cobra sin comprobante y la factura sale en la entrega, por el total. ¿Es correcto?
5. **Formato de 58 mm.** ¿Es válido entregar la factura impresa en el rollo de 58 mm, con todos sus datos y el QR?
6. **Datos del encabezado.** Número de Ingresos Brutos y domicilio comercial (las constancias muestran dos alturas distintas).
7. **Certificado.** ¿Queda a nombre del cliente, o se delega el servicio al CUIT del desarrollador? La propuesta es que quede a nombre del cliente.
8. **Punto de venta.** Número del punto de venta nuevo para servicios web.

**Para el cliente:**

9. **Impresión.** ¿La factura de mostrador se imprime en la impresora de tickets, en hoja A4, o las dos?
10. **Tope.** El tope de la categoría B cambia dos veces por año. La propuesta es que el dueño lo actualice a mano en Configuración.

**Técnicas, para el plan:**

11. **Desarrollo sin esperar al cliente.** El ambiente de pruebas de ARCA se puede usar con el CUIT del desarrollador. Se propone arrancar así.
12. **Reinicio del sistema (spec 017)** con comprobantes ya autorizados.
