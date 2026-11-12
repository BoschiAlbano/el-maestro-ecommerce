# Investigación: integración con Mercado Libre y factura electrónica (ARCA)

| | |
|---|---|
| **Fecha** | 2026-11-10 |
| **Para** | Specs 019 a 024 (`docs/PROJECT.md`, sección 4, "Ampliación de alcance") |
| **Estado** | Relevamiento de documentación. Nada de esto se probó todavía contra una cuenta real. |

Este documento junta lo que se relevó para escribir las specs y lo que van a necesitar los planes técnicos. Las specs dicen **qué** hace el sistema; acá queda **qué impone** cada plataforma y de dónde salió cada dato.

Cada dato lleva una marca de confianza:

- **[Oficial]** leído en la documentación oficial el 2026-11-10.
- **[Secundaria]** notas de difusión, blogs o guías de terceros. Hay que confirmarlo antes de depender de él.
- **[A probar]** solo se confirma con la prueba técnica.

---

## 1. Mercado Libre

### 1.1 Requisitos para empezar

- **[Oficial]** No hay ambiente de pruebas separado. Se prueba en producción con **usuarios de prueba**, que publican, compran y venden entre ellos sin cargos ni efecto en la reputación.
- **[Oficial]** Los usuarios de prueba se crean por la API con una autorización válida, así que primero tiene que existir la aplicación. Hasta 10 por cuenta; vencen y los que pasan 60 días sin actividad se eliminan. Hay que guardar usuario y contraseña al crearlos: no se pueden volver a consultar.
- **[Oficial]** Las publicaciones de prueba se titulan "Item de Prueba - Por favor, NO OFERTAR", van de preferencia en la categoría "Otros" y nunca en los tipos de publicación de mayor exposición. Las compras de prueba se pagan con tarjetas de prueba.
- **[Oficial]** En Argentina solo se puede crear una aplicación desde una cuenta con los **datos del titular cargados y validados**. La validación de identidad puede tardar hasta 3 días hábiles.
- **[Oficial]** Mercado Libre recomienda crear la aplicación con la cuenta del dueño de la solución, para no tener que transferirla después. Coincide con la decisión de registrarla con la cuenta del cliente.
- **[Oficial]** Desde el 30/08/2026 una aplicación es solo de Mercado Libre o solo de Mercado Pago. La nuestra es solo de Mercado Libre.
- **[Oficial]** La dirección de retorno de la autorización tiene que ser https. Se carga la raíz del dominio.
- **[Oficial]** La aplicación elige permisos de lectura y escritura, y los temas de avisos que quiere recibir (órdenes, publicaciones, envíos, entre otros), con una dirección pública para recibirlos.

### 1.2 Autorización de la cuenta

- **[Secundaria]** La autorización vence a las 6 horas y se renueva con una credencial de renovación.
- **[Secundaria]** La credencial de renovación es de un solo uso: cada renovación entrega una nueva y solo vale la última. Si dos procesos renuevan a la vez, uno se queda con una credencial muerta.
- **[Secundaria]** La vigencia de la credencial de renovación figura como 6 meses en una versión de la documentación. **[A probar]**
- **[Oficial]** Mercado Libre ofrece una verificación adicional opcional para el intercambio de la autorización (PKCE) y recomienda activarla.

**Probado el 2026-11-11** con una cuenta de prueba (detalle en `specs/019-conexion-con-mercado-libre/prueba-tecnica.md`):

- La autorización dura 6 horas. Confirmado.
- **La credencial de renovación solo se entrega si la aplicación tiene activado el flujo "Refresh Token".** Una aplicación recién creada no lo trae activado.
- Cada renovación entrega una credencial nueva, pero **la anterior siguió sirviendo** en usos repetidos, al revés de lo que dice la documentación. No se probó si vence pasado un tiempo.
- Renovar con un permiso revocado da HTTP 400 con `invalid_grant`. Consultar da HTTP 401 con "invalid access token", tras unos segundos de demora.
- El permiso se puede revocar por la API.
- **Una revocación no se nota enseguida (verificado el 2026-11-11).** Después de revocar, la renovación falla al instante con `invalid_grant`, pero la autorización que ya estaba emitida **siguió sirviendo durante varios minutos** (más de un minuto seguro; en la prueba técnica, el rechazo apareció después de unos minutos). Consecuencia: el sistema detecta la revocación en el primer rechazo (HTTP 401) o en la primera renovación, lo que ocurra antes. La pasada diaria consulta la cuenta justamente para eso.
- Los avisos perdidos solo los puede consultar la cuenta dueña de la aplicación. Se resuelve con el permiso propio de la aplicación (sin usuario), que también dura 6 horas.
- Límite de la aplicación: 18.000 consultas por hora.

### 1.3 Avisos

- **[Oficial]** Mercado Libre avisa por un pedido a la dirección configurada cada vez que cambia algo. El aviso solo trae qué recurso cambió; el detalle hay que pedirlo a la API.
- **[Oficial]** Hay que confirmar cada aviso **en menos de 500 milisegundos**. Si no, Mercado Libre puede desactivar los temas, los avisos de ese período no se guardan y hay que volver a suscribirse.
- **[Oficial]** Un aviso sin confirmar se reintenta durante 1 hora (8 intentos). Después se da por perdido.
- **[Oficial]** Los avisos perdidos se pueden consultar, pero **solo los de los últimos 2 días**. Para el tema de publicaciones hay que indicar además el sitio (Argentina).
- **[Oficial]** Los avisos también llegan por cambios hechos fuera del sistema: desde la web o la aplicación de Mercado Libre.
- **[Oficial]** Los avisos salen de una lista publicada de direcciones de red, que sirve para filtrar el origen.
- **[Oficial]** Temas que nos interesan: órdenes (el recomendado avisa creación y cambios de ventas confirmadas), publicaciones y envíos.

**Consecuencia del plan gratuito de Vercel.** Con una sola pasada diaria de recuperación, un aviso perdido se recupera dentro de la ventana de 2 días. Si la pasada falla dos días seguidos, el aviso se pierde del todo. Por eso las specs 021 y 022 no dependen solo de los avisos: suman un control propio contra Mercado Libre.

### 1.4 Publicar

- **[Oficial]** Para desarrollos nuevos hay que publicar con el modelo nuevo de Mercado Libre, en el que cada producto físico del vendedor es una unidad propia y la publicación son sus condiciones de venta. En ese modelo el título cambia de función y no se envía; el vendedor informa un nombre y Mercado Libre agrupa productos parecidos en una "familia". **[A probar]** cómo queda exactamente para un vendedor nuevo.
- **[Oficial]** Los usuarios de prueba tienen que pedir por formulario que se los habilite en el modelo nuevo. **El plazo es de dos semanas** según el propio formulario (las preguntas frecuentes de la documentación dicen "cada 7 días": se toma el más largo), y **Mercado Libre no avisa**: hay que probar pasado ese plazo, mirando si `GET /users/me` trae la etiqueta `user_product_seller`.
  - El formulario es de Google (hay que iniciar sesión) y pide: correo, sitio (Argentina), identificador de la aplicación (`App_Id`), correo de contacto y el **identificador numérico del usuario de prueba** (por ejemplo `6543999`, sin `MLA`, sin direcciones ni mails). Pide además que el usuario se haya creado con el recurso de usuarios de prueba.
  - Un vendedor real no necesita el formulario: a medida que Mercado Libre lo habilita pasa a publicar en el modelo nuevo, y desde que tiene la etiqueta ya no puede publicar en el modelo viejo. Cuál es el caso de la cuenta del cliente se ve en la etiqueta cuando la conecte.
- **[Oficial]** La categoría se obtiene con un predictor a partir del título. Publicar en una categoría distinta de la recomendada expone a que la publicación sea observada.
- **[Oficial]** Cada categoría define características obligatorias y el largo máximo del título.
- **[Oficial]** Código universal del producto: si la categoría lo exige siempre, hay que mandarlo; si lo exige de forma condicional, se puede declarar un motivo por el que no se tiene. Si la marca ya tiene 30 o más productos con código en Mercado Libre, pasa a ser exigido.
- **[Oficial]** Fotos: JPG o PNG, hasta 10 MB, recomendadas de 1200 × 1200 px, mínimo 500 × 500 px. La cantidad máxima depende de la categoría.
- **[Oficial]** La condición (nuevo, usado, reacondicionado) es obligatoria.
- **[Oficial]** Con compra inmediata, la orden recién le aparece al vendedor cuando el pago está aprobado.
- **[Oficial]** Tipos de publicación en Argentina: sin cuotas (se paga el cargo por vender y, si aplica, un costo fijo) y con cuotas (se suma un costo por ofrecerlas). Las dos duran sin límite.
- **[Oficial]** Existe un calculador de costos por vender. En Argentina necesita el tipo de logística y el peso del paquete para que el costo fijo coincida con lo que se cobra.
- **[Oficial]** Para el envío por Mercado Envíos se informan alto, ancho y largo del **embalaje** en centímetros y el peso en gramos, como números enteros sin unidad. Mercado Libre rechaza medidas irreales.
- **[Oficial]** Una cuenta puede estar bloqueada para publicar por datos regulatorios incompletos; se puede consultar.

**Publicaciones que ya existen** (relevado el 2026-11-11, para vincularlas):

- **[Oficial]** Se pueden listar todas las publicaciones de la cuenta de un vendedor, en cualquier estado. Hay un modo de recorrido para cuentas con más de 1000.
- **[Oficial]** Se puede buscar una publicación por su **código de vendedor (SKU)**.
- **[Oficial]** El SKU correcto es la característica "SKU" de la publicación. Existe otro campo más viejo de uso interno; no son equivalentes ni combinables. Cuando la publicación tiene el SKU cargado, también aparece en las órdenes.
- Consecuencia: si el cliente carga el código de barras del producto como SKU en cada publicación, el sistema puede proponer el vínculo solo.

### 1.5 Stock

- **[Oficial]** Con stock 0 la publicación se pausa sola por falta de stock, y vuelve a activarse al cargar unidades.
- **[Oficial]** Para un vendedor sin depósitos múltiples ni depósito de Mercado Libre, el stock se actualiza sobre la publicación. Mercado Libre lo replica a las demás publicaciones del mismo producto.
- **[Oficial]** En el esquema por ubicaciones, cada actualización de stock lleva un número de versión. Si la versión quedó vieja, Mercado Libre rechaza el cambio y hay que volver a leer.
- **[Oficial]** Mercado Libre descuenta su propia cantidad disponible al vender. El sistema no tiene que restar dos veces: manda siempre el **valor absoluto** calculado desde su propio stock.

### 1.6 Órdenes y envíos

- **[Oficial]** Estados de una orden: confirmada, pago requerido, pago en proceso, pago parcial, **pagada**, devolución parcial, cancelación pendiente y **cancelada**.
- **[Oficial]** Toda compra pertenece a un **paquete de compra**, que agrupa una o más órdenes (un carrito con varios productos) y un solo envío.
- **[Oficial]** Cada ítem de la orden trae el precio unitario y el cargo por venta que cobra Mercado Libre.
- **[Oficial]** **Alerta de fraude:** después de aprobado el pago, Mercado Libre puede marcar la orden con riesgo de fraude. La mercadería **no se despacha** y la orden se cancela.
- **[Oficial]** Tipos de logística de Mercado Envíos: despacho en sucursal, colecta, puntos de entrega, envío en el día a cargo del vendedor y depósito de Mercado Libre.
- **[Oficial]** La etiqueta de envío se descarga en PDF cuando el envío está listo para despachar. Con depósito de Mercado Libre el vendedor no imprime etiquetas.
- **[Oficial]** Cada envío tiene una **fecha y hora límite de despacho**. Despachar tarde afecta la reputación y la exposición de las publicaciones.
- **[Oficial]** Si el comprador cancela y la etiqueta todavía no se imprimió, la venta se cancela y se avisa al vendedor.
- **[Oficial]** La dirección de entrega sale del envío, no de los datos de facturación. Pueden ser distintas.
- **[Oficial]** Las órdenes se pueden buscar por fecha y estado, y se conservan 12 meses.

### 1.7 Facturas

- **[Oficial]** Datos fiscales del comprador: nombre o razón social, tipo y número de documento (DNI o CUIT), situación fiscal (Monotributo, IVA Responsable Inscripto, IVA Exento), domicilio fiscal, y si pidió factura con IVA discriminado. Ingresos Brutos solo si compró con CUIT y lo informó.
- **[Oficial]** Algunos campos pueden venir vacíos; hay que tolerarlo.
- **[Oficial]** Mercado Libre ya no informa el tipo de factura. Su regla "CUIT → factura A, DNI → factura B" es para vendedores responsables inscriptos. **Nuestro cliente es monotributista y emite siempre factura C.**
- **[Oficial]** La factura propia se sube al paquete de compra: **un solo PDF, de hasta 1 MB**. Se puede borrar y volver a subir.
- **[Oficial]** Al subirla, Mercado Libre avisa al comprador por su cuenta y por email. **No hay que mandar mensajes propios avisando**: se exponen a ser observados.
- **[Oficial]** Las restricciones para subir facturas según el tipo de logística figuran para Chile y Brasil, no para Argentina.
- **[Oficial]** Existe el Facturador de Mercado Libre (emisión a cargo de Mercado Libre). **No se usa** (decisión 0005).

### 1.8 Fuentes

- [Crear una aplicación](https://developers.mercadolibre.com.ar/es_ar/crea-una-aplicacion-en-mercado-libre-es) (actualizada 06/08/2026)
- [Realizar pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas) (30/12/2025)
- [Notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) (03/11/2026)
- [Publicar productos](https://developers.mercadolibre.com.ar/es_ar/publica-productos) (09/01/2026)
- [User Products](https://developers.mercadolibre.com.ar/es_ar/user-products) (17/06/2026)
- [Imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes) (24/03/2026)
- [Identificadores de productos](https://developers.mercadolibre.com.ar/es_ar/identificadores-de-productos)
- [Tipos de publicación](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos)
- [Costos por vender](https://developers.mercadolibre.com.ar/es_ar/comision-por-vender) (03/09/2026)
- [Stock distribuido](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido)
- [Órdenes](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas)
- [Packs](https://developers.mercadolibre.com.ar/es_ar/gestion-packs)
- [Envíos](https://developers.mercadolibre.com.ar/es_ar/envios) y [Mercado Envíos 2](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2)
- [Atributos de envío y dimensiones](https://developers.mercadolibre.com.ar/es_ar/items-atributos-de-envio-y-dimensiones) (14/08/2026)
- [Datos de facturación](https://developers.mercadolibre.com.ar/es_ar/facturacion) (16/06/2026) y [preguntas frecuentes](https://developers.mercadolibre.com.ar/es_ar/facturacion-billing-info) (14/08/2026)
- [Cargar y obtener facturas](https://developers.mercadolibre.com.ar/es_ar/cargar-factura) (16/03/2026)
- [Validar datos de vendedores](https://developers.mercadolibre.com.ar/es_ar/validar-datos-de-vendedores)
- [Autenticación y tokens](https://developers.mercadolibre.com.ar/gestion-de-identidades-y-accesos-oauth-y-tokens)

---

## 2. Factura electrónica (ARCA)

### 2.1 Qué comprobante corresponde

- El cliente es **monotributista, categoría B, venta de cosas muebles** (constancia vigente del 04/11/2026 al 04/12/2026, inicio de actividades 01/11/2026).
- **[Secundaria]** Un monotributista emite siempre **factura C**, a cualquier comprador. La nota de crédito es también clase C.
- **[Oficial]** El servicio web de ARCA para comprobantes A, B, C y M sin detalle de ítems es el que corresponde. Manual del desarrollador vigente: versión 4.7.
- **[Secundaria]** En la factura C el total va como importe neto y no hay IVA.

### 2.2 Qué hay que tener en ARCA

- **[Oficial]** Un **certificado digital** emitido por ARCA para autenticarse. El de producción se gestiona con "Administración de Certificados Digitales", con clave fiscal.
- **[Oficial]** El certificado se asocia al servicio de facturación desde el "Administrador de Relaciones de Clave Fiscal".
- **[Oficial]** Existe la alternativa de **delegar** el servicio web a otro CUIT.
- **[Secundaria]** Un **punto de venta** nuevo, habilitado para servicios web. No sirve el que se usa para facturar a mano en la web de ARCA. El nombre exacto de la opción para monotributo hay que verlo en la cuenta del cliente.
- **[Oficial]** El ambiente de pruebas de ARCA tiene certificados propios, que el programador gestiona con su clave fiscal de persona física. **La spec 023 se puede desarrollar y probar con el CUIT del desarrollador, sin esperar el trámite del cliente.**
- **[Secundaria]** El acceso se obtiene con un permiso temporal que dura 12 horas. Pedir otro mientras el anterior sigue vigente da error, así que hay que guardarlo y reutilizarlo.

### 2.3 Qué pedirle al contador

El contador dijo que habilita el servicio web. Para que sirva al sistema hace falta, en este orden:

1. **Definir a nombre de quién queda el certificado.** Dos caminos:
   - *Certificado del cliente (recomendado):* el desarrollador genera la clave privada y el pedido de certificado; el contador lo sube a ARCA y devuelve el certificado. La clave privada nunca sale del lado del desarrollador ni se manda por mail. Queda todo a nombre del cliente, igual que la aplicación de Mercado Libre.
   - *Delegación:* el cliente delega el servicio de facturación al CUIT del desarrollador. Es más rápido, pero ata la facturación del cliente al desarrollador.
2. **Asociar el certificado al servicio de facturación electrónica** en el Administrador de Relaciones.
3. **Dar de alta un punto de venta para servicios web** y avisar el número.
4. **Confirmar los datos del encabezado de la factura:** razón social, domicilio comercial, número de Ingresos Brutos y fecha de inicio de actividades.

### 2.4 Reglas que afectan a las specs

- **[Oficial]** El código QR es obligatorio en los comprobantes electrónicos. Para monotributistas que emiten por servicio web rige desde el 1 de junio de 2021. La especificación está publicada por ARCA.
- **[Secundaria]** El comprobante impreso lleva además el número de autorización (CAE) y su vencimiento.
- **[Secundaria]** **Condición frente al IVA del comprador:** obligatoria por la RG 5616/2024. Según notas profesionales, desde el **1/12/2026** ARCA rechaza las facturas que no la informen. Para un consumidor final se informa "Consumidor Final".
- **[Secundaria]** **Identificar al consumidor final** es obligatorio solo desde $10.000.000 por operación. Por debajo, la factura puede salir a "Consumidor Final" sin datos.
- **[Secundaria]** Si el comprador necesita la factura para deducir gastos, hay que identificarlo con CUIT sin importar el monto.
- **[A probar]** Cuántos días hacia atrás se puede fechar una factura de productos. La propuesta de la spec 023 es fecharla siempre el día en que se emite.
- La numeración la da ARCA, correlativa por punto de venta y tipo de comprobante. El sistema no elige números.

### 2.5 Tope del monotributo

- **[Secundaria]** Categoría B, vigente desde el 1/8/2026: hasta **$17.595.182,74 por año**, unos $1.466.000 por mes. Se actualiza en febrero y agosto.
- Todo lo facturado suma: órdenes de Mercado Libre (siempre facturadas) y ventas de mostrador facturadas.
- Vendiendo por Mercado Libre ese tope se alcanza rápido. Conviene que el contador lo sepa antes de arrancar.
- **Decisión del cliente (2026-11-10):** el sistema muestra el acumulado y avisa una vez al cruzar el 80 %, solo como advertencia para informar al contador. Pasarse del tope no bloquea nada: lo resuelve el contador.

### 2.6 Fuentes

- [Servicios web de factura electrónica](https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [Certificados](https://www.arca.gob.ar/ws/documentacion/certificados.asp)
- [Autenticación y autorización](https://arca.gob.ar/ws/documentacion/wsaa.asp)
- [Código QR: vigencia y aplicación](https://www.arca.gob.ar/fe/qr/vigencia-y-aplicacion.asp) y [especificaciones](https://www.arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf)
- [Resolución General 5616/2024](https://www.argentina.gob.ar/normativa/nacional/norma-407369/texto)
- [Condición frente al IVA desde diciembre (iProfesional)](https://www.iprofesional.com/impuestos/464104-nuevo-requisito-arca-puede-trabar-emision-facturas)
- [Monto para identificar al consumidor final (Contadores en Red)](https://contadoresenred.com/facturacion-a-partir-de-que-monto-se-debe-identificar-al-consumidor-final-en-2026/)
- [Escalas del monotributo (Infobae, 15/07/2026)](https://www.infobae.com/economia/2026/07/15/monotributo-hasta-cuanto-se-puede-facturar-por-mes-sin-exceder-las-nuevas-categorias/)

---

## 3. Puntos de choque con el sistema actual

| Tema | Cómo es hoy | Qué cambia | Spec |
|---|---|---|---|
| Venta y caja | Toda venta exige una caja abierta y se cobra en efectivo o transferencia. | Las ventas de Mercado Libre llegan a cualquier hora y las cobra Mercado Libre. No pasan por la caja. Toca la regla 11 de la constitución. | 022 |
| Usuario de la operación | Cada venta y cada movimiento de stock tienen un usuario. | Las órdenes entran solas: hace falta un usuario "Sistema". | 022 |
| Stock negativo | Permitido a propósito. | Hacia Mercado Libre se publica 0 como mínimo. | 021 |
| Datos del producto | Nombre, marca, rubro, una foto, código de barras. | Mercado Libre pide categoría, características, más fotos, descripción y medidas del paquete. | 020 |
| Código de barras generado | El sistema genera uno para los productos sin código de origen. | No es un código universal válido: no se manda a Mercado Libre. | 020 |
| Precio | Una sola lista. | Precio propio para Mercado Libre, por la comisión. | 020 |
| Ticket | Documento interno con la leyenda "no válido como factura". | Sigue igual. La factura es un comprobante aparte. | 023 |
| Tareas programadas | Una por día (plan gratuito). | Alcanza para recuperar avisos, con margen justo. Se compensa con controles al usar el sistema. | 019, 021, 022 |

---

## 4. Qué confirma la prueba técnica

Necesita una cuenta de Mercado Libre con los datos del titular validados. Se hace con la cuenta del desarrollador (decisión 2026-11-11): la aplicación de desarrollo vive ahí y la definitiva se registra en la cuenta del cliente al salir a producción.

1. Vigencia real de la autorización y de su renovación.
2. Cómo se publica un producto en el modelo nuevo para un vendedor recién creado, y qué pasa con el título.
3. Qué características y qué código universal piden las categorías reales de los productos del cliente.
4. Tiempo de respuesta al recibir avisos desde Vercel en São Paulo, contra el límite de 500 ms.
5. Recorrido completo de una compra de prueba: aviso, orden, paquete de compra, envío, etiqueta.
6. Datos fiscales que devuelve Mercado Libre para un comprador con DNI.
7. Subida de un PDF de factura al paquete de compra y cómo lo ve el comprador.
8. Cancelación de una compra antes del despacho.

En paralelo, y sin depender del cliente: emitir una factura C de prueba en el ambiente de pruebas de ARCA con el CUIT del desarrollador.
