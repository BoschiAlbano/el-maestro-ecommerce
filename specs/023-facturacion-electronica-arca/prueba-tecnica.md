# Prueba técnica 023 — resultados

> Tarea T-001. Se corrió contra el ambiente de pruebas (homologación) de ARCA, con credenciales del desarrollador que están en una carpeta fuera del repositorio. **Este archivo no lleva el CUIT ni ninguna credencial.**
>
> Los scripts fueron temporales y viven fuera del repositorio. Leen el certificado de la carpeta del desarrollador y nunca imprimen la clave ni el permiso temporal.

## Estado (2026-11-11)

**Hecha.** Las 13 verificaciones tienen resultado. Tres quedan con una salvedad que no se puede cerrar en homologación (ver «Lo que no se pudo verificar»).

## Resultados

| Paso | Resultado | Coincide con lo supuesto |
|---|---|---|
| Certificado y clave | El certificado es de homologación (emisor «Computadores Test»), vigente por dos años, con el CUIT en el titular como `serialNumber=CUIT …`. Mi lector (`certificate.ts`) lo interpreta bien, también con saltos de línea de Windows (CRLF) y extensión `.crt`. | Sí |
| A-1 Cliente con el certificado y la clave como texto | Funciona: `new Arca({ cuit, cert, key, production: false, ticketStorage })`, sin rutas ni archivos. | Sí |
| A-2 Node 24 | Conecta sin error de cifrado. Estado del servicio en `OK`. | Sí |
| A-3 Permiso guardado y reutilizado | Con un almacenamiento propio (`get`, `save`, `delete`), una **segunda instancia reutiliza el permiso guardado** y no pide otro: el registro muestra `get → encontrado` y ningún `save`. Dura **12 horas**. Se guarda como `{ header, credentials }` con `ticket.toLoginCredentials()` y se reconstruye con `AccessTicket.create(...)`. `getServerStatus` no necesita permiso. | Sí |
| A-4 Puntos de venta y último número | `getSalesPoints` da **602 «Sin resultados»** aunque el punto de venta 1 existe: no hay que usar esa lista para validar el punto de venta. `getLastVoucher(1, 11)` funciona. **Homologación acepta factura C** para este CUIT. | Sí, con una salvedad |
| A-5 Condiciones frente al IVA | Tabla para clase C: **1** Responsable Inscripto, **6** Responsable Monotributo, **13** Monotributista Social, **16** Monotributo Trabajador Independiente Promovido, **4** Sujeto Exento, **7** Sujeto No Categorizado, **8** Proveedor del Exterior, **9** Cliente del Exterior, **10** IVA Liberado, **15** IVA No Alcanzado, **5** Consumidor Final. Tipos de documento: **80** CUIT, **96** DNI, **99** Doc. (otro). Comprobantes: **11** Factura C, **13** Nota de Crédito C. | Sí (los códigos coinciden con lo que ya usa `iva-conditions.ts`) |
| A-6 Factura C a Consumidor Final | **Autorizada.** Código de autorización de 14 dígitos; **vencimiento = fecha del comprobante + 10 días**. Documento 99, número 0. | Sí |
| A-7 Con DNI y con CUIT | **Autorizadas las dos.** | Sí |
| A-8 Nota de crédito C | **Autorizada**, asociada a la factura con `CbtesAsoc` (`Tipo 11`, punto de venta, número y CUIT del emisor). La numeración de las notas de crédito es propia (tipo 13). | Sí |
| A-9 Consultar un comprobante | Uno que existe devuelve número, fecha, total, tipo y número de documento, código de autorización y resultado `A`. **No devuelve la condición IVA del comprador.** Uno que **no existe devuelve `null`**, no un error 602 como decía la documentación de la biblioteca: el código tiene que aceptar las dos formas. | Parcial |
| A-10 Antigüedad de la fecha | Para productos, ARCA acepta **entre 5 días antes y 5 días después de hoy** (error 10016 con «CbteFch debe estar comprendido en el rango N-5 y N+5»). **Hace 5 días: aprobada. Hace 6 días: rechazada.** Confirma el plazo de 5 días del RF-16. | Sí |
| A-11 Errores | Ver abajo. | Sí |
| A-12 QR | El QR de la factura se codificó, se convirtió en imagen y **se decodificó con un lector independiente** (`jsQR`): idéntico a la dirección original. Versión 13, 69 módulos por lado. A 4 puntos por módulo mide unos 39 mm a 203 dpi y cabe en el papel de 58 mm; a 5 puntos ocupa los 48 mm útiles. La dirección es la de la especificación oficial y la prueba reproduce su ejemplo. No se escaneó con un celular. | Sí, con una salvedad |
| A-13 Pedido de certificado generado por el sistema | **ARCA lo aceptó** en el portal de pruebas (WSASS) con el pedido que generó `certificate.ts`. ARCA reescribió el titular a `CN=<alias>, serialNumber=CUIT …` y descartó la organización: el CUIT sigue yendo en `serialNumber`, que es lo que lee el sistema. Después hay que **autorizar el certificado al servicio `wsfe`** en el mismo portal. | Sí |

### A-11 — qué responde ARCA ante errores

**ARCA no lanza un error cuando rechaza.** Responde con éxito y `Resultado: "R"`; el motivo viene en `Errors.Err` o en las observaciones del comprobante. El código tiene que leer `Resultado`, no esperar una excepción. Está resuelto en `arca-result.ts`, con estas respuestas reales como casos de prueba.

| Caso | Resultado | Dónde viene el motivo |
|---|---|---|
| Número repetido o salteado | Rechazado, **10016** «el número o fecha no se corresponde con el próximo a autorizar» | `Errors.Err` |
| Fecha fuera de rango | Rechazado, **10016** (mismo código, otro motivo) | Observaciones |
| Total que no cierra | Rechazado, **10048** | Observaciones |
| Sin condición IVA del comprador | Rechazado, **10246** (RG 5616). Ya es obligatoria en homologación. | Observaciones |
| CUIT del comprador inexistente | **Autorizada.** Homologación no valida que el CUIT exista. | — |

## Lo que pasó con el permiso (hallazgo importante)

ARCA entrega un permiso temporal de 12 horas y **normalmente no entrega otro mientras el anterior siga vigente**. La primera corrida pidió uno y lo guardó solo en memoria; al terminar el proceso se perdió. La segunda corrida recibió:

> `coe.alreadyAuthenticated: El CEE ya posee un TA valido para el acceso al WSN solicitado`

Quedó bloqueado el certificado que se usaba. **Un certificado nuevo es un emisor nuevo para ARCA**: con el certificado que generó el sistema, ARCA entregó un permiso de inmediato. Consecuencias, ya incorporadas al plan (sección 3.3b y riesgo 13):

- El permiso **tiene que guardarse siempre**, antes de usarlo.
- Pedirlo es una operación **con bloqueo**, para que dos procesos no lo pidan a la vez.
- Perderlo (restaurar una copia vieja de la base, cambiar la clave de cifrado) **bloquea la facturación hasta 12 horas**.
- Reemplazar el certificado la desbloquea.
- El mismo certificado **no puede usarse en dos sistemas o entornos a la vez**: cada uno invalidaría el permiso del otro.
- La biblioteca tarda **entre 10 y 12 segundos** en rendirse ante ese error, porque reintenta.
- **No es una regla firme.** Con el certificado nuevo, ARCA rechazó un segundo permiso desde procesos nuevos en 4 de 4 intentos, pero una vez, antes, lo entregó sin objeciones aunque había uno vigente (el permiso anterior siguió sirviendo). No se pudo explicar. El diseño no depende de ninguna de las dos conductas.

## Lo que no se pudo verificar en homologación

1. **Que ARCA rechace un CUIT de comprador inexistente.** En homologación lo acepta. En producción puede rechazarlo; el sistema ya trata cualquier rechazo como factura pendiente con el motivo a la vista, y valida el dígito verificador antes de llamar.
2. **Escanear el QR con un celular.** Se decodificó con un lector independiente y la dirección coincide con la especificación. Falta verlo en papel con una impresora real.
3. **Que el sitio publicado llegue a ARCA desde Vercel.** Es la tarea T-026.

## Datos de la prueba

Los comprobantes de la prueba quedaron en homologación (facturas C y una nota de crédito, con números que siguen a las que ya había). No afectan a nada: homologación no tiene validez fiscal.
