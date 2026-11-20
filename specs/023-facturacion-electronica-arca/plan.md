# Plan 023 — Facturación electrónica (ARCA)

> Cómo se construye lo que dice `spec.md`: una tabla de comprobantes con estados, una capa propia que habla con ARCA (hoy implementada con `@arcasdk/core`), la opción de facturar dentro del cobro que ya existe, y el comprobante en PDF A4 y en 58 mm con su QR.
>
> Datos de la plataforma y de las bibliotecas: `docs/investigacion/2026-11-10-mercado-libre-y-arca.md` (sección 2) y `docs/investigacion/2026-11-10-tecnologias.md` (sección 3).

## 0. Prueba técnica previa

**Hecha el 2026-11-11.** Resultados completos en `prueba-tecnica.md`.

Se hace antes de escribir el código de emisión, en el **ambiente de pruebas de ARCA (homologación) con las credenciales del desarrollador**. No depende del cliente ni de su contador. Si algún resultado difiere de lo supuesto, se corrige este plan antes de seguir.

| N.º | Verificación | Qué define |
|---|---|---|
| A-1 | Crear el cliente de `@arcasdk/core` pasándole el certificado y la clave como texto (no como rutas de archivo) y consultar el estado del servicio. | Que la biblioteca sirve sin disco, con el certificado guardado en la base. |
| A-2 | Conectar con Node 24 a los servidores de homologación. | Si aparece el error de cifrado que reportan otras bibliotecas. |
| A-3 | Darle a la biblioteca un almacenamiento propio del permiso temporal (`ticketStorage`: guardar, leer, borrar) y ver que lo reutiliza en la segunda llamada. | Forma del permiso para guardarlo en la base, y su vencimiento. |
| A-4 | Consultar los puntos de venta y el último número autorizado de factura C. | Que el punto de venta de prueba admite factura C. **Si el CUIT del desarrollador no es monotributista en homologación, puede que solo deje emitir A o B**: en ese caso se prueba con B y se anota la diferencia. |
| A-5 | Consultar las condiciones frente al IVA del comprador para comprobantes C. | Los códigos que se ofrecen en la pantalla (Consumidor Final, Responsable Inscripto, Monotributo, Exento). |
| A-6 | Emitir una factura C a Consumidor Final sin identificar. | Datos exactos del pedido y forma de la respuesta (número, código de autorización, vencimiento, observaciones). |
| A-7 | Emitir una factura C con DNI y otra con CUIT. | Tipos de documento y validaciones de ARCA. |
| A-8 | Emitir la nota de crédito C de una de esas facturas. | Cómo se asocia a la factura original. |
| A-9 | Consultar un comprobante que existe y uno que no. | Cómo distinguirlos: es la base del control de duplicados. |
| A-10 | Emitir con fecha de hace 5 días y de hace 6. | Hasta cuántos días atrás acepta ARCA una factura de productos (pregunta abierta 2 de la spec). |
| A-11 | Provocar errores: CUIT inexistente, número repetido, total que no cierra. | Códigos y textos de error, para traducirlos a mensajes claros. |
| A-12 | Armar el QR de una factura emitida y escanearlo. | Dirección y datos vigentes del QR (la especificación oficial está en el sitio de ARCA). |
| A-13 | Generar una clave y un pedido de certificado como lo va a hacer el sistema, y obtener con él un certificado de homologación. | Que ARCA acepta el pedido que genera el sistema (formato, largo de la clave y datos del titular). Es la base del RF-2b. |

**Qué cambió en este plan por los resultados:**

1. **Un rechazo de ARCA no es una excepción.** Llega como éxito con `Resultado: "R"`. La interpretación vive en `arca-result.ts`, con las respuestas reales como casos de prueba, y el servicio de emisión nunca debe suponer que «no lanzó» quiere decir «autorizó».
2. **El código 10016 sirve para dos motivos** (número y fecha): se distinguen por el texto. El de número se resuelve volviendo a consultar el último autorizado; el de fecha, no.
3. **El vencimiento de la autorización es la fecha del comprobante más 10 días.**
4. **La lista de puntos de venta de ARCA no sirve para validar el punto de venta** (en homologación dio «sin resultados»). Se valida con una consulta del último número.
5. **`getVoucherInfo` devuelve `null` si el comprobante no existe**, y no devuelve la condición IVA del comprador. El control de duplicados compara con total, documento y fecha.
6. **Un certificado nuevo es un emisor nuevo.** Confirmado: desbloquea la facturación y no comparte permiso con el anterior.
7. **El permiso guardado se reutiliza entre instancias.** Confirmado el mecanismo de la sección 3.3b.
8. **Plazo para facturar una venta pasada: 5 días.** Confirmado por ARCA (rango de 5 días antes a 5 días después), no solo propuesto.

Los resultados se anotan en `prueba-tecnica.md`, como en la spec 019. Para la prueba, el certificado y la clave del desarrollador se leen de sus archivos, en una carpeta fuera del repositorio; no se pegan en el chat. Cuando exista la pantalla, se cargan por ahí.

## 1. Modelo de datos

### Tablas nuevas

**`FiscalConfig` → `fiscal_config`.** Fila única (`id` fijo, con restricción en la base, igual que `ml_connections`). Datos del emisor y parámetros (RF-1, RF-6, RF-9).

| Campo | Tipo | Nota |
|---|---|---|
| `razonSocial`, `cuit`, `domicilioComercial`, `iibb` | `String` | Vacíos hasta que el Dueño los carga. |
| `inicioActividades` | `DateTime?` | Solo la fecha. |
| `puntoDeVenta` | `Int?` | |
| `topeAnual` | `Decimal(14,2)?` | Tope de la categoría del monotributo, cargado a mano (RF-6). |
| `montoIdentificacion` | `Decimal(14,2)` | Desde qué total hay que identificar al comprador. Por defecto 10.000.000 (RF-9). |
| `diasParaFacturar` | `Int` | Hasta cuántos días después de la venta se puede facturar. Por defecto 5 (RF-16; lo confirma el contador). |
| `updatedAt` | `DateTime` | |

La condición frente al IVA del emisor no es un campo: es siempre "Responsable Monotributo" (decisión 0005).

**`Invoice` → `invoices`.** Un registro por factura o nota de crédito.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id` | |
| `kind` | `InvoiceKind` | `FACTURA_C` o `NOTA_CREDITO_C`. |
| `status` | `InvoiceStatus` | `PENDING`, `AUTHORIZED` o `DISCARDED`. |
| `environment` | `FiscalEnvironment` | `HOMOLOGACION` o `PRODUCCION`. Un comprobante de prueba nunca se confunde con uno real. |
| `origin` | `InvoiceOrigin` | `LOCAL` o `MERCADO_LIBRE` (el segundo lo usa la spec 024). |
| `saleId` | `String` | Relación a `Sale`. |
| `relatedInvoiceId` | `String?` | En una nota de crédito, la factura que anula. |
| `pointOfSale` | `Int` | El vigente al pedirla. |
| `number` | `Int?` | Lo asigna ARCA; vacío mientras está pendiente. |
| `attemptedNumber` | `Int?` | El número con el que se intentó la última vez (sección 3.3). |
| `cae`, `caeExpiresAt`, `issueDate` | | Vacíos mientras está pendiente. |
| `total` | `Decimal(12,2)` | El total de la venta. |
| `receiverDocType` | `ReceiverDocType` | `NONE`, `DNI` o `CUIT`. |
| `receiverDocNumber`, `receiverName` | `String?` | |
| `receiverIvaCondition` | `Int` | Código de ARCA. |
| `emitterSnapshot` | `Json?` | Datos del emisor al autorizarse: una reimpresión muestra lo que se emitió, aunque después cambie la configuración. |
| `attempts`, `lastError` | | RF-12. |
| `requestedByUserId` | `String` | |
| `createdAt`, `authorizedAt` | `DateTime` | |

Restricciones, en SQL a mano porque Prisma no las expresa:

- **Una factura por venta** (RF-14): índice único sobre `saleId` para `kind = FACTURA_C` y `status <> DISCARDED`.
- **Una nota de crédito por factura:** índice único sobre `relatedInvoiceId` con `status <> DISCARDED`.
- **Sin números repetidos:** único sobre `environment`, `pointOfSale`, `kind`, `number`.

El detalle de productos no se copia: sale de `SaleItem`, que ya es inmutable (constitución, regla 8).

**`ArcaTicket` → `arca_tickets`.** El permiso temporal de ARCA (12 horas), por servicio y ambiente. Se guarda cifrado con el mismo mecanismo que la autorización de Mercado Libre. Vercel no tiene disco, y pedir un permiso nuevo con uno vigente da error.

**`ArcaCredential` → `arca_credentials`.** El certificado cargado desde Configuración (RF-2b a RF-2e). Una fila por ambiente, para poder tener el de pruebas y el real sin pisarse.

| Campo | Tipo | Nota |
|---|---|---|
| `environment` | `FiscalEnvironment @id` | `HOMOLOGACION` o `PRODUCCION`. |
| `certificatePem` | `String?` | El certificado. Es público: va sin cifrar. Vacío mientras hay un pedido sin completar. |
| `privateKeyEnc` | `String` | La clave privada, **cifrada**. Nunca sale del servidor. |
| `pendingKeyEnc`, `pendingCsrPem` | `String?` | Clave y pedido generados que todavía esperan su certificado. No reemplazan al certificado en uso hasta que llega el nuevo. |
| `cuit` | `String?` | Leído del certificado. |
| `expiresAt` | `DateTime?` | Leído del certificado, para el aviso de vencimiento (RF-5). |
| `uploadedByUserId`, `uploadedAt` | | RF-2e. |

`fiscal_config` suma `environment`: cuál de los dos certificados se usa para facturar.

### Enums que se amplían

- `NotificationType`: `TOPE_FACTURACION` (RF-27).
- `AuditAction`: `FISCAL_CONFIG_UPDATED` y `ARCA_CERTIFICATE_UPDATED`. El primero no lo pide la spec, pero cambiar el CUIT o el punto de venta es una acción sensible (constitución, regla 13). El segundo es el RF-2e.

Los avisos de "comprobantes pendientes" (RF-19) y "certificado por vencer" (RF-5) no se guardan: se calculan en vivo, como el de stock bajo (spec 013).

### Reinicio del sistema (spec 017)

Pregunta abierta 12 de la spec. **Decisión 2026-11-11, a pedido del desarrollador: el reinicio se permite también con comprobantes reales, con una advertencia fuerte** (había propuesto negarlo; no hay una razón técnica para hacerlo).

- Los comprobantes de **homologación** se borran con el resto, sin más aviso.
- Si hay comprobantes **reales autorizados**, el resumen previo al borrado (spec 017, RF-3) los destaca con su cantidad y dice, en palabras, qué se pierde: la lista de comprobantes del sistema y el acumulado contra el tope del monotributo, que vuelve a cero y deja de ser fiable. Y qué **no** se pierde: las facturas siguen existiendo en ARCA, que se pueden descargar desde "Comprobantes en línea", y la numeración sigue sola, porque el sistema consulta a ARCA el último número autorizado.
- El resumen sugiere exportar antes la lista de comprobantes a Excel (RF-26). Es una sugerencia, no un requisito.
- La confirmación es la de siempre (contraseña y frase): no se pide una segunda.
- `fiscal_config`, `arca_credentials` y `arca_tickets` se conservan, como la configuración. **Conservar `arca_tickets` es importante** (sección 3.3b): perder el permiso temporal bloquea la facturación hasta 12 horas.

## 2. Rutas y pantallas

| Ruta | Qué es | Quién accede |
|---|---|---|
| `/configuracion`, pestaña "Facturación" | Datos del emisor, estado de la conexión con ARCA, tope (RF-1 a RF-6). | Ver: permiso "ver" en Configuración. Editar y probar conexión: solo Dueño. |
| Cobro de `/ventas` y de la entrega de `/pedidos/[id]` | Opción "con factura" dentro de la ventana de cobro que ya existe (RF-7 a RF-9). | El mismo permiso que permite vender o entregar. |
| `/ventas/historial/[id]` | Panel de la factura: estado, emitir, reintentar, imprimir (RF-12, RF-15). | "Ver" en Ventas; emitir y reintentar, "crear" en Ventas. |
| `/comprobantes` | Lista con filtros, total del período y acumulado contra el tope (RF-24 a RF-27). | "Ver" en Ventas. El acumulado, solo Dueño. |
| `GET /comprobantes/[id]/pdf` | PDF A4 del comprobante (RF-20, RF-21). | "Ver" en Ventas. |
| `GET /comprobantes/exportar` | Excel de la lista filtrada (RF-26). | "Exportar" en Ventas. |

## 3. Lógica de servidor

Todo en `src/lib/facturacion/`. Lo que decide es puro y con pruebas; lo que toca ARCA o la base queda en módulos finos.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `documentos.ts` (pura) | Validar CUIT (dígito verificador) y DNI. |
| `fiscal-config.ts` (pura) | Qué falta para poder facturar (RF-4). |
| `invoice-policy.ts` (pura) | ¿Se puede facturar esta venta? (anulada, ya facturada, fuera de plazo). ¿Hay que identificar al comprador? ¿Corresponde nota de crédito o descartar? |
| `voucher.ts` (pura) | Arma el pedido a ARCA a partir del comprobante: tipo, documento, importes, fecha en horario de Tucumán, asociación de la nota de crédito. |
| `qr.ts` (pura) | Arma la dirección del QR. |
| `accumulated.ts` (pura) | Acumulado de 12 meses y cruce del 80 % (RF-27). |
| `gateway.ts` | **Interfaz propia** hacia ARCA: `emit`, `findVoucher`, `lastNumber`, `status`, `receiverConditions`. El resto del sistema solo conoce esto. |
| `arcasdk-gateway.ts` | La implementación con `@arcasdk/core`. Es el único archivo que importa la biblioteca. |
| `ticket-storage.ts` | Almacenamiento del permiso temporal sobre `arca_tickets`, cifrado. |
| `certificate.ts` (pura) | Lee un certificado (CUIT, vencimiento), comprueba que corresponda a una clave privada y arma el pedido de certificado. Usa `node:crypto` y `node-forge`. |
| `arca-credentials.ts` | Guarda y lee el certificado de `arca_credentials`, con la clave privada cifrada. Falla cerrada si falta el certificado o la clave de cifrado. |
| `invoice-service.ts` | Pedir, autorizar y reintentar comprobantes (secciones 3.2 a 3.4). |

### 3.2 Pedir la factura al cobrar (RF-7 a RF-12)

`confirmSale` y `deliverOrderItems` reciben un dato opcional con la factura pedida y el comprador.

1. Se valida el comprador: formato del documento y obligación de identificarlo según el total (RF-9).
2. **Dentro de la misma transacción de la venta** se crea el comprobante en estado `PENDING`. La intención de facturar se guarda junto con la venta, todo o nada (constitución, regla 10).
3. **Después de la transacción** se pide la autorización a ARCA, con un tiempo máximo de 10 segundos.
4. La acción devuelve la venta y el estado de la factura. Si ARCA no respondió o rechazó, la venta ya está hecha y la factura queda pendiente con su motivo (RF-12).

La venta nunca espera a ARCA para confirmarse (RF-10).

### 3.3 Autorizar un comprobante, sin duplicar (RF-11, RF-13)

ARCA exige números correlativos por punto de venta y tipo. Dos emisiones a la vez chocarían, y una respuesta perdida podría dejar una factura autorizada que el sistema no registró. `authorize(invoiceId)` resuelve las dos cosas:

1. Abre una transacción y toma la fila de `fiscal_config` con `SELECT … FOR UPDATE`. **Se emite de a un comprobante por vez** (mismo mecanismo que la renovación de Mercado Libre en la spec 019).
2. Vuelve a leer el comprobante. Si ya está autorizado, termina.
3. **Control de duplicados:** si el comprobante tiene `attemptedNumber`, consulta ese número en ARCA. Si existe y coincide en total, documento del comprador y fecha, lo marca autorizado con esos datos: el intento anterior había funcionado.
4. Consulta el último número autorizado y calcula el siguiente.
5. Guarda `attemptedNumber` en una escritura aparte, **confirmada antes de llamar a ARCA**, para que sobreviva a una caída en el medio.
6. Pide la autorización.
   - **Aprobado:** guarda número, código de autorización, vencimiento, fecha y la foto del emisor. Estado `AUTHORIZED`.
   - **Rechazado o sin respuesta:** queda `PENDING`, con el motivo traducido y un intento más.
7. Fuera de la transacción: si el acumulado cruzó el 80 % del tope, crea el aviso (RF-27).

Reintentar (botón) es volver a llamar a `authorize`. No hay reintentos automáticos: un comprobante fiscal no se emite sin que alguien lo pida (sección 8, decisión 6).

### 3.3b El permiso temporal de ARCA (aprendido en la prueba técnica, 2026-11-11)

ARCA entrega un permiso temporal (TA) de 12 horas por certificado y servicio, y **normalmente no entrega otro mientras el anterior siga vigente**: responde `coe.alreadyAuthenticated`. Si el sistema pierde un permiso que ARCA todavía considera vigente, la facturación puede quedar bloqueada hasta que venza, hasta 12 horas. En la prueba técnica pasó con un permiso guardado solo en memoria.

**Cuánto se puede confiar en ese bloqueo:** en la prueba técnica ARCA rechazó el segundo permiso en 5 de 6 intentos desde procesos nuevos, y lo entregó una vez, sin que pudiera explicar por qué. No hay una regla que se pueda anunciar: el diseño no depende de que el bloqueo ocurra ni de que no ocurra. Se guarda el permiso siempre, y se tolera que ARCA lo entregue o lo rechace.

Por eso:

1. **El permiso se guarda siempre** en `arca_tickets` (cifrado), con el almacenamiento propio que acepta la biblioteca (`ticketStorage`), y se reutiliza en toda llamada.
2. **Pedir un permiso nuevo es una operación con bloqueo.** Si no hay uno vigente guardado, se toma la fila de `fiscal_config` con `SELECT … FOR UPDATE`, se vuelve a mirar el almacenamiento (otro proceso pudo haberlo guardado mientras se esperaba) y recién entonces se pide. Así dos procesos nunca lo piden a la vez.
3. **Guardarlo y pedirlo van juntos:** lo que no se guarda de inmediato es un permiso perdido. Se guarda dentro del mismo bloqueo, antes de usarlo.
4. **Si ARCA responde `alreadyAuthenticated`**, el sistema no reintenta en ciclo: relee el almacenamiento una vez y, si sigue vacío, lo explica con estas palabras: "ARCA tiene un permiso vigente que el sistema no tiene guardado, por ejemplo porque se restauró una copia de la base o se cambió la clave de cifrado. Se podrá volver a facturar cuando ese permiso venza, dentro de las próximas 12 horas." Las ventas siguen saliendo con ticket.
5. **La biblioteca tarda entre 10 y 12 segundos en rendirse** ante ese error, porque reintenta. Por eso el pedido de un permiso nuevo tiene su propio tiempo máximo, de 30 segundos (`ACQUIRE_TIMEOUT_MS`); con el de 10 segundos de las demás llamadas, el error se vería como una caída de red y el mensaje no explicaría qué pasó.
6. **Qué lo pierde:** restaurar una copia vieja de la base, cambiar `ARCA_ENCRYPTION_KEY` o borrar `arca_tickets` a mano. Por eso el reinicio del sistema y la rotación de claves lo cuidan (sección 8, riesgo 13).
7. **Un certificado nuevo debería ser un emisor nuevo para ARCA** (el error habla del «CEE», el computador emisor identificado por su certificado), y no compartir permiso con el anterior: reemplazar el certificado desbloquearía la facturación. A confirmar en A-13.

### 3.4 Anular una venta (RF-17, RF-18)

`voidSale` no cambia sus reglas ni espera a ARCA. Dentro de su transacción:

- Factura **autorizada**: crea la nota de crédito en `PENDING`. Después de la transacción se autoriza con 3.3.
- Factura **pendiente**: antes de descartarla corre el control de duplicados (3.3, paso 3). Si resulta que sí se había autorizado, crea la nota de crédito; si no, la marca `DISCARDED`.
- Sin factura: nada.

### 3.5 Configuración y conexión

- **Guardar datos fiscales:** solo Dueño. Valida el CUIT y registra `FISCAL_CONFIG_UPDATED`.
- **Probar conexión** (RF-3): estado del servicio y último número autorizado.
- **Certificado** (RF-2b a RF-2e), todas solo Dueño y con auditoría `ARCA_CERTIFICATE_UPDATED`:
  - `generateCertificateRequest(environment)`: crea una clave RSA de 2048 bits y el pedido de certificado con el CUIT y la razón social del emisor. Guarda la clave cifrada como pendiente y devuelve el pedido para descargar.
  - `uploadCertificate(environment, archivo)`: recibe el certificado que devolvió ARCA. Lo acepta solo si corresponde a la clave pendiente, está vigente y su CUIT es el del emisor. Recién entonces reemplaza al certificado en uso.
  - `uploadCertificateWithKey(environment, certificado, clave)`: para un par ya existente, con las mismas validaciones.
  - `removeCertificate(environment)`.
  - Ninguna acción devuelve la clave privada. Los archivos se validan por tamaño y forma antes de leerlos.
- **Modo real:** `fiscal_config.environment` solo puede pasar a `PRODUCCION` si el sistema corre en el sitio publicado. En homologación el PDF lleva la leyenda "COMPROBANTE DE PRUEBA, SIN VALIDEZ FISCAL".

## 4. Componentes

- **`payment-dialog.tsx`** (lo comparten ventas y pedidos): bloque "Factura" con el interruptor con/sin, y al activarlo, "Consumidor Final" o los datos del comprador. Solo aparece si se puede facturar (RF-4).
- **`invoice-dialog.tsx`**: después de cobrar con factura, muestra el comprobante con "Imprimir" (58 mm), "Descargar PDF" y "Nueva venta". Si quedó pendiente, muestra el motivo, "Reintentar" y la opción de imprimir el ticket (RF-12, RF-22).
- **`ticket-dialog.tsx`**: `printTicket` suma una imagen opcional al pie, para el QR en 58 mm.
- **`invoice-pdf.tsx`**: documento A4 con `@react-pdf/renderer`, como el de analíticas.
- **`fiscal-tab.tsx`**: pestaña de Configuración. Incluye el bloque "Certificado de ARCA": estado (CUIT, ambiente, vencimiento, quién lo cargó), "Generar pedido de certificado" con los pasos a seguir en ARCA y la descarga del pedido, "Subir certificado", y la alternativa de subir certificado y clave existentes.
- **Panel de factura** en el detalle de la venta.
- **`/comprobantes`**: tabla con `FilterForm` y `TablePagination`, como Auditoría.
- **Campanita:** pendientes y certificado por vencer (en vivo), y el aviso del tope.
- **Navegación:** "Comprobantes" junto a Ventas.

## 5. Permisos

| Acción | Verificación |
|---|---|
| Facturar al vender o entregar | Los `requirePermission` que ya tienen `confirmSale` y `deliverOrderItems`. |
| Facturar una venta ya hecha, reintentar | `requirePermission(VENTAS, "crear")`. |
| Ver y reimprimir comprobantes, PDF | `requirePermission(VENTAS, "ver")`. |
| Exportar | `requirePermission(VENTAS, "exportar")`. |
| Ver el acumulado contra el tope | `requireOwner`. |
| Editar datos fiscales, probar conexión | `requireOwner`. |
| Nota de crédito | Automática; la dispara `voidSale`, con sus permisos. |

## 6. Pruebas

**Unitarias:**

- CUIT y DNI: válidos, dígito verificador incorrecto, largo incorrecto.
- Qué falta en la configuración para facturar.
- Política: venta anulada, ya facturada, fuera de plazo, justo en el borde del plazo; identificación obligatoria justo en el monto.
- Pedido a ARCA: Consumidor Final, con DNI, con CUIT, nota de crédito asociada; fecha en horario de Tucumán cerca de la medianoche.
- Control de duplicados, con la interfaz de ARCA simulada: intento anterior autorizado (se recupera, no se emite otra), número tomado por otro comprobante (se emite con el siguiente), sin intento previo.
- Dos autorizaciones simultáneas: números correlativos, sin repetir.
- Anulación: factura autorizada (nota de crédito), pendiente no autorizada (se descarta), pendiente que sí estaba autorizada (nota de crédito).
- QR y acumulado, con el cruce del 80 %.

**Manuales, en homologación:** todos los criterios de aceptación de la spec, con una lista de pasos como la de la spec 019.

**E2E:** pendiente para la pasada de endurecimiento.

## 7. Entornos y configuración

**Dependencias nuevas:** `@arcasdk/core`, `qrcode` (con `@types/qrcode`) y `node-forge` (con `@types/node-forge`) para armar el pedido de certificado. `node-forge` ya viene instalada como dependencia de `@arcasdk/core`; se declara directa.

**Variables de entorno nuevas:** una sola.

| Variable | Contenido |
|---|---|
| `ARCA_ENCRYPTION_KEY` | 32 bytes en base64. Cifra la clave privada del certificado y el permiso temporal guardados en la base. |

El certificado, el CUIT, el punto de venta y los demás datos del emisor se cargan en Configuración (decisión 2026-11-11, sección 8, punto 12). El CUIT cargado tiene que ser el del certificado.

**Desarrollo:** homologación con las credenciales del desarrollador, sobre la base local (`docs/entorno-local.md`).

**Paso a producción:** el Dueño carga sus datos fiscales, genera el pedido de certificado desde el sistema, el contador lo presenta en ARCA y da de alta el punto de venta (`docs/pendientes-cliente-y-contador.md`), y el Dueño sube el certificado. Solo hay que definir `ARCA_ENCRYPTION_KEY` en Vercel.

## 8. Riesgos y decisiones

1. **Llegar a ARCA desde Vercel.** El sitio corre en São Paulo. No está confirmado que los servicios de ARCA respondan bien desde ahí, ni que no aparezca el error de cifrado con la versión de Node de Vercel. Se prueba con un despliegue apenas exista "Probar conexión". Si falla, las alternativas son cambiar opciones de conexión o mover solo esas llamadas a otra región.
2. **Biblioteca con un solo mantenedor.** Por eso la interfaz propia (`gateway.ts`): cambiarla por otra o por una implementación directa toca un solo archivo.
3. **Homologación con un CUIT que quizá no emite factura C** (A-4). *Resuelto el 2026-11-11:* el CUIT del desarrollador ya tiene 68 facturas C en el punto de venta 1 y homologación acepta el tipo 11.
4. **Llamada a ARCA dentro de una transacción con bloqueo** (3.3). Ocupa una conexión de base uno o dos segundos y hace esperar a un segundo cobro con factura simultáneo. Se acepta: hay un solo puesto de caja.
5. **ARCA lento al cobrar.** El cajero espera hasta 10 segundos; después la factura queda pendiente y sigue vendiendo.
6. **Sin reintentos automáticos.** Una factura pendiente se emite cuando alguien toca "Reintentar". Reintentar sola al día siguiente la emitiría con otra fecha sin que nadie lo decida.
7. **Preguntas al contador sin responder.** Las que cambian comportamiento quedaron como parámetros (`diasParaFacturar`, `montoIdentificacion`). El formato de 58 mm y la actividad registrada no cambian el código.
8. **Condición frente al IVA del comprador obligatoria desde el 1/12/2026.** Se manda desde el primer día.
9. **Vencimiento del certificado.** Aviso con 30 días (RF-5). Renovarlo es un trámite del contador.
10. **Reinicio del sistema** (sección 1): se permite con comprobantes reales, con una advertencia fuerte. Decisión 2026-11-11.
11. **Cifrado compartido.** Se reutiliza `token-crypto.ts` de la spec 019, con su propia clave. Con este tercer uso se mueve a un módulo común.
12. **Certificado cargado desde Configuración y no en variables de entorno** (decisión 2026-11-11, a pedido del desarrollador).
    - **A favor:** el certificado vence y se renueva sin el desarrollador ni un despliegue; el sistema valida al cargarlo que sea el correcto; y si el pedido se genera en el sistema, la clave privada nunca viaja por mail ni pasa por la máquina de nadie.
    - **El costo:** la clave privada queda en la base. Se mitiga con cifrado (la clave que la cifra está solo en el servidor, así que la base sola no alcanza para usarla), solo escritura, solo Dueño, auditoría y validación de los archivos.
    - **Lo que hay que cuidar:** las copias de seguridad de la base llevan la clave cifrada, y si se pierde `ARCA_ENCRYPTION_KEY` hay que cargar el certificado de nuevo.

13. **Perder el permiso temporal bloquea la facturación hasta 12 horas** (sección 3.3b). Dos medidas más allá de guardarlo: el mismo certificado **no se carga en dos entornos a la vez** (si el sistema local y el sitio publicado usan el mismo certificado, se pelean el permiso: cada uno invalida al otro), y las copias de seguridad de la base no se restauran sobre una base en uso sin avisar que puede bloquearse la facturación.
14. **El arranque en frío puede pasar el tiempo máximo del cobro** (medido el 2026-11-11 en el build de producción, en la máquina local): la primera llamada a ARCA tras un rato sin uso tardó **7,7 segundos**; las siguientes, entre 80 y 160 ms. El tiempo máximo de la llamada es de 10 segundos (sección 3.2): el primer cobro con factura después de un rato sin uso podría quedar pendiente solo por el arranque. En Vercel el arranque en frío puede ser más lento. Mitigaciones previstas, a medir en el despliegue (T-026):
    - **Calentar al elegir «con factura».** Al activar la opción en la ventana de cobro, la pantalla dispara en segundo plano una acción que abre la sesión y garantiza el permiso (`ensureTicket`). Cuando el cajero confirma, ya está caliente.
    - **Si la primera llamada de una función fría se pasa, no se pierde nada:** la factura queda pendiente y «Reintentar» la emite en caliente, en una fracción de segundo.
    - Si en Vercel resulta insuficiente, subir el tiempo máximo del primer intento o mantener la función caliente con la tarea diaria.

## 9. Preguntas abiertas

1. *(Resuelta 2026-11-11.)* Credenciales de homologación: certificado y clave en una carpeta del desarrollador, CUIT de persona física, punto de venta 1.
2. *(Resuelta 2026-11-11.)* Reinicio del sistema: se permite con una advertencia (sección 1).
3. Siguen abiertas las preguntas de la spec para el contador (sección 9 de `spec.md`). No frenan el desarrollo.
