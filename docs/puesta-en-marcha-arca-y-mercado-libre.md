# Puesta en marcha: lo que necesitamos para ARCA y Mercado Libre

**Fecha:** 24 de noviembre de 2026

El sistema ya factura con ARCA y vende por Mercado Libre: todo está probado con cuentas de prueba. Para usarlo de verdad faltan los datos y las gestiones de esta lista. Está separada en dos partes: una para el **contador** (ARCA) y otra para el **dueño** (Mercado Libre). Al final está el orden de los pasos del día del arranque.

Reemplaza a «Mercado Libre y factura electrónica: qué necesitamos de ustedes» (11 de noviembre): las preguntas de ese documento que ya se respondieron están resumidas en la sección «Ya resuelto».

## Ya resuelto

- **Envío:** Mercado Envíos, despachando en un correo o una sucursal de Mercado Libre, y además retiro en el local.
- **Impresión:** la etiqueta y la factura de cada envío salen por la impresora de etiquetas de 10 × 15 cm.
- **Factura de Mercado Libre:** se emite con el botón «Preparar envío», al armar el paquete, y se sube sola a la compra.
- **Publicaciones nuevas:** Clásica por defecto (se puede elegir Premium, con cuotas sin interés), garantía del vendedor de 30 días.
- **Precio:** uno solo, igual en el local y en Mercado Libre.
- **Stock:** se publica el stock completo, sin reserva.
- **Aviso de despacho:** 4 horas antes de que venza el plazo.
- **Reportes:** filtro Local / Mercado Libre, y el margen descuenta lo que cobra Mercado Libre.

## Parte 1: para el contador (ARCA)

El cliente es monotributista, categoría B. El sistema emite **factura C** por servicio web: siempre en las ventas de Mercado Libre, y en el local cuando el cajero lo elige.

### Gestiones

**1. Certificado digital, a nombre del cliente.**
El dueño descarga desde **Configuración → Facturación** el pedido de certificado (un archivo) y se lo envía. Usted lo carga en «Administración de Certificados Digitales» con la clave fiscal del cliente y le devuelve el certificado; el dueño lo sube al sistema. La clave privada no sale nunca del sistema.

- [ ] Certificado emitido y devuelto

**2. Asociar el certificado al servicio «Facturación Electrónica» (wsfe).**
Desde el «Administrador de Relaciones de Clave Fiscal».

- [ ] Hecho

**3. Punto de venta nuevo para servicios web.**
Exclusivo para el sistema: no sirve el que se usa para facturar desde la página de ARCA.

- [ ] Número del punto de venta: __________

**4. Datos del encabezado de la factura.**

- [ ] Razón social, tal como debe figurar: ______________________
- [ ] Domicilio comercial (una constancia dice Av. Belgrano 2852 y la otra 2872): ______________________
- [ ] Número de inscripción en Ingresos Brutos (la constancia de Convenio Multilateral lo trae vacío): ______________________
- [ ] Fecha de inicio de actividades (tenemos 01/11/2026): ______________________
- [ ] Tope anual de la categoría para el aviso del 80 % (tenemos $17.595.182,74, de fuentes no oficiales): ______________________

### Consultas

Donde hay una propuesta, alcanza con responder «ok».

1. **Actividad.** Figuran venta al por menor por internet, expendio de comidas y peluquería, pero no la venta al por menor en local. ¿Hay que sumarla para facturar el mostrador?
2. **Factura opcional en el mostrador.** El cajero decide en cada venta si emite factura o solo el ticket interno. ¿Es compatible con las obligaciones del cliente?
3. **Seña.** La seña de un pedido se cobra sin comprobante y la factura se emite al entregar, por el total. ¿Es correcto?
4. **Facturar una venta de días anteriores.** Sale con la fecha del día en que se emite. *Propuesta:* hasta 5 días después de la venta.
5. **Formato impreso.** ¿Es válido entregar la factura en el rollo de 58 mm del mostrador, y en una etiqueta de 10 × 15 cm dentro del paquete de Mercado Libre? Ambas llevan todos los datos, el código de autorización y el QR; en Mercado Libre, el PDF oficial le llega al comprador por la plataforma.
6. **Importe en Mercado Libre.** *Propuesta:* el precio de los productos, sin el envío que el comprador le paga a Mercado Libre.
7. **Cupones de Mercado Libre.** Si Mercado Libre le hace un descuento al comprador con un cupón propio, ¿se factura el precio publicado o lo que pagó el comprador?
8. **Compradores con CUIT.** Como monotributista se emite factura C en todos los casos. ¿Hace falta alguna aclaración en el comprobante? *Propuesta:* no.
9. **Datos del comprador.** Entendemos que la condición frente al IVA es obligatoria en toda factura y que identificar al consumidor final solo es obligatorio desde $10.000.000 por operación. ¿Es correcto?
10. **Mientras tanto.** Hasta el arranque, ¿con qué se facturan las ventas de Mercado Libre: el Facturador de Mercado Libre o la página de ARCA? Desde el arranque, ese medio se deja de usar.

## Parte 2: para el dueño (Mercado Libre)

### Gestiones

**1. Cuenta de vendedor validada, a nombre del negocio, con Mercado Envíos activo.**

- [ ] Hecho

**2. En qué dirección va a quedar el sistema.**
La dirección web definitiva (el dominio). Mercado Libre la necesita para conectar la cuenta y mandar los avisos.

- [ ] Dirección: ______________________

**3. Una sesión juntos para conectar la cuenta (unos 30 minutos).**
Se registra el sistema dentro de su cuenta de Mercado Libre, para que quede a su nombre. Usted ingresa con su contraseña: no hace falta compartirla. En esa sesión:

- se crea la aplicación del sistema en su cuenta de desarrollador de Mercado Libre, con la dirección de retorno y la de avisos (las armamos con la dirección del punto 2) y los avisos de publicaciones, precios, órdenes y envíos;
- se cargan sus datos en el servidor del sistema;
- se conecta la cuenta desde **Configuración → Mercado Libre**.

- [ ] Día y hora: ______________________

**4. El día del arranque.**
Desde ese día el sistema registra las compras de Mercado Libre, descuenta el stock y factura. Las compras anteriores no se cargan.

- [ ] Fecha: ______________________

**5. Publicaciones que ya tiene en Mercado Libre.**
Para que el sistema las reconozca solas:

- el mismo **SKU** en la publicación y en el producto del sistema (o que coincida el código de barras);
- una publicación por producto, sin variantes de color o talle;
- sin el depósito de Mercado Libre (Full).

- [ ] Revisado

**6. Primeros productos para publicar desde el sistema.**
De cada uno: fotos nítidas con fondo claro (mínimo 500 × 500 píxeles), una descripción, y alto, ancho, largo y peso **del paquete embalado**.

- [ ] Lista: ______________________

## El día del arranque, en orden

1. **Reiniciar el sistema:** se borran los datos de prueba y queda el usuario del dueño.
2. **ARCA:** cargar los datos del emisor y el certificado real, y pasar de modo de pruebas a modo real.
3. **Mercado Libre:** conectar la cuenta y cargar la fecha de inicio de las compras.
4. **Facturador de Mercado Libre:** apagarlo (o dejar de facturar por la página de ARCA). Si los dos facturan a la vez, cada venta sale con dos facturas.
5. **Control:** revisar con Mercado Libre una publicación, sin publicarla, para confirmar que su cuenta acepta el mismo formato que la de prueba.
6. **Productos:** cargar el catálogo y el stock inicial, y vincular las publicaciones.
