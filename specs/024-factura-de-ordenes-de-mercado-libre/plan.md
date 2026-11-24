# Plan 024 — Factura de órdenes de Mercado Libre

> Cómo se construye lo que dice `spec.md`. Casi todo existe: la venta de cada compra (spec 022) y la facturación con ARCA (spec 023). Esta spec los une con un botón «Preparar envío», lee los datos fiscales del comprador de Mercado Libre, sube el PDF a la compra y suma la impresión en 10 × 15.

## 0. Prueba técnica

Hecha el 2026-11-20; el detalle está en `prueba-tecnica.md`. Lo que define de este plan:

1. **Datos fiscales:** `GET /orders/billing-info/MLA/{buyer.billing_info.id}` con `x-version: 2` trae nombre, apellido, documento (`DNI` o `CUIT`), tipo de contribuyente (`05` Consumidor Final) y domicilio.
2. **La emisión de la spec 023 sirve tal cual** sobre la venta de Mercado Libre (`issueInvoiceForExistingSale`).
3. **Subida:** `POST /packs/{pack_id}/fiscal_documents`, campo `fiscal_document`, con el PDF A4 de la spec 023 (16 KB). Sin paquete, `pack_id` es el número de la orden. La lista responde 404 cuando no hay nada cargado.
4. **Un solo archivo por compra, sin borrar ni reemplazar:** la nota de crédito no se sube, y solo se sube una factura autorizada y confirmada.
5. **Se corrigió la cancelación en la spec 022** (el envío se cancela antes que la orden).

## 1. Modelo de datos

**`Invoice`, campos nuevos**

| Campo | Tipo | Nota |
|---|---|---|
| `receiverAddress` | `String?` | Domicilio fiscal del comprador, cuando Mercado Libre lo informa (RF-4). Se imprime en el comprobante. Las facturas del local no lo usan. |
| `receiverEdited` | `Boolean @default(false)` | El usuario corrigió a mano los datos que informó Mercado Libre (RF-8). |

`origin` ya existe (spec 023, `LOCAL` o `MERCADO_LIBRE`): las facturas de órdenes se crean con `MERCADO_LIBRE` (RF-22).

**`MercadoLibreOrder`, campos nuevos**

| Campo | Tipo | Nota |
|---|---|---|
| `invoiceUploadedAt` | `DateTime?` | Cuándo se subió la factura a Mercado Libre (RF-15). |
| `mlFiscalDocumentId` | `String?` | El id que devolvió Mercado Libre al subirla. |
| `invoiceUploadError` | `String?` | Último error al subir (RF-14). |
| `preparedAt`, `preparedByUserId` | | Quién preparó el envío y cuándo. |

El estado de la factura de la orden (RF-15) se calcula, no se guarda: sin factura, pendiente de autorización, emitida sin subir, emitida y subida, o «ya tenía una cargada en Mercado Libre».

**Sin enums nuevos.** `NotificationType` no cambia: el aviso de despachadas sin factura es calculado (RF-23).

**Migración contra la base de la nube**, con copia previa y reiniciando `pnpm dev` después.

## 2. Rutas y pantallas

| Ruta | Cambio |
|---|---|
| `/ordenes/[id]` | Botón principal **«Preparar envío»**: ventana con los datos del comprador para confirmar o corregir, emisión, subida, y las dos impresiones (factura y etiqueta, en 10 × 15 o A4). Estado de la factura y reintentos. La etiqueta sola sigue (RF-18). |
| `/ordenes` | Filtro y columna por estado de la factura (RF-21). |
| `GET /ordenes/[id]/factura?formato=10x15\|a4` | La factura de la orden para imprimir (RF-17). |
| `/comprobantes` | Filtro y columna Origen (RF-22). |

## 3. Lógica de servidor

En `src/lib/mercadolibre/orders/`, con la regla de siempre: la decisión es pura y con pruebas.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `billing-read.ts` (pura) | Lee la respuesta de `billing-info` con `zod` y la traduce al comprador de la factura: tipo y número de documento, nombre (o razón social), condición frente al IVA por el código del tipo de contribuyente, y domicilio en una línea. |
| `invoice-receiver.ts` (pura) | Decide el comprador final (RF-5 a RF-7): identificado, Consumidor Final por monto bajo, o «faltan datos» con el motivo. Usa `receiverError` de la spec 023 para el monto que obliga a identificar. |
| `invoice-state.ts` (pura) | El estado de la factura de una orden (RF-15) y si «Preparar envío» está disponible (RF-2). |
| `orders-api.ts` | Suma `getBillingInfo`, `listFiscalDocuments` (404 = vacía) y `uploadFiscalDocument`. |
| `order-invoice.ts` | Preparar envío, subir y reintentar; la nota de crédito al cancelar. |

### 3.2 Preparar envío (RF-1 a RF-12)

**Al abrir la ventana** (Server Action `loadInvoiceDraft`, con «editar» en Mercado Libre):

1. Rechaza si la orden tiene riesgo de fraude, está cancelada o ya salió, o si faltan los datos fiscales del emisor (`loadInvoicingAvailability`, spec 023) (RF-2).
2. Si la venta ya tiene una factura vigente, no arma otra: muestra esa y sus impresiones (sección 7: preparar dos veces).
3. Consulta los archivos cargados en la compra en Mercado Libre. **Si ya hay una factura que no subió el sistema** (por ejemplo, del Facturador de Mercado Libre), no emite nada y lo explica: emitir otra sería facturar dos veces en ARCA (regla de transición).
4. Lee de Mercado Libre los datos fiscales vigentes (spec, sección 7: se usan los del momento de preparar) y `invoice-receiver` arma la propuesta.
5. Muestra: comprador, documento, condición, domicilio, total y el detalle. Si faltan datos y el monto obliga a identificar, lo dice y deja cargarlos (RF-7).

**Al confirmar** (Server Action `prepareShipment`):

1. Vuelve a validar el permiso y los pasos 1 y 3.
2. Emite con `issueInvoiceForExistingSale` (spec 023), con `origin: MERCADO_LIBRE`, el domicilio y la marca de «corregido a mano» si el usuario cambió algo (RF-8). Si ARCA no responde, la factura queda pendiente con su reintento de la spec 023 (RF-12).
3. Si quedó autorizada: sube la factura (3.3).
4. Guarda `preparedAt` y devuelve el estado para mostrar las dos impresiones.

**El total y el detalle** (RF-9 a RF-11): la factura es por el total de la venta, que ya es solo lo de los productos (spec 022). El detalle de una venta de Mercado Libre sale de los ítems de la orden (`ml_order_items`), no de los de la venta, para que un producto «sin vincular» también figure con su título (spec, sección 7). Se ajusta `loadInvoiceView` para eso.

**Plazo para facturar:** vale la regla de la spec 023 (`diasParaFacturar`); si una orden se prepara después del plazo, el sistema lo explica como en el local.

### 3.3 Subir a Mercado Libre (RF-13, RF-14)

`uploadOrderInvoice(orderId)`:

1. Solo con la factura **autorizada**.
2. Consulta los archivos cargados en la compra. Si ya hay uno: no sube nada, guarda la marca «ya tenía una factura cargada» y lo informa (spec, sección 7; regla de transición). Si el que está es el que subió el sistema (mismo id), es un éxito.
3. Arma el PDF A4 (el mismo de la spec 023) y lo sube. Si pesa más de 1 MB, no lo sube y lo informa como error.
4. Bien: guarda `invoiceUploadedAt` y el id. Error: guarda `invoiceUploadError`; queda «emitida, sin subir».

**Reintentos:** botón «Reintentar subida» en la orden, y en la pasada diaria (spec 019), después de buscar órdenes, para las órdenes con factura autorizada sin subir. Una factura que estaba pendiente y se autoriza después (reintento de la spec 023) se sube en ese mismo momento.

**Para no subir dos veces** con dos clics o dos procesos: la subida se reclama con una actualización condicional (`invoiceUploadedAt` vacío y sin una subida en curso), como las cancelaciones de la spec 022.

### 3.4 Impresión (RF-17, RF-18)

- **Factura en 10 × 15** *(decisión del cliente)*: un documento de `@react-pdf/renderer` del tamaño de la etiqueta, con los mismos datos que el A4 de la spec 023 (emisor, comprador, detalle, total, CAE y QR) y la leyenda de prueba en homologación. Se reutiliza `InvoiceView`.
- **Factura en A4**: la de la spec 023, como alternativa.
- **Etiqueta**: la de la spec 022. Si la factura todavía no está autorizada, la etiqueta se puede imprimir igual con la advertencia «la orden todavía no tiene factura» (RF-18).

En la ventana de «Preparar envío», al terminar, quedan dos botones: «Imprimir factura» e «Imprimir etiqueta», los dos en 10 × 15.

### 3.5 Cancelación de una orden facturada (RF-19, RF-20)

En `cancelPurchase` (spec 022), dentro de la misma transacción que anula la venta, se aplica la decisión de la spec 023 (`decideOnVoid`): factura autorizada → `createCreditNoteInTx`; pendiente → verificar en ARCA y descartar. Después de la transacción, `authorizeAfterSale` intenta autorizar la nota de crédito sin frenar nada. La nota de crédito **no se sube** a Mercado Libre (prueba técnica).

### 3.6 Seguimiento (RF-21 a RF-23)

- `/ordenes`: filtro «Factura» (sin factura, pendiente, sin subir, subida) y una marca por fila.
- `/comprobantes`: columna y filtro Origen (Local, Mercado Libre) sobre `Invoice.origin`. El acumulado contra el tope ya suma todas las facturas.
- Campanita: aviso calculado «Hay N órdenes despachadas sin factura subida», para quien ve el módulo Mercado Libre.

## 4. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Preparar envío, corregir datos, reintentar | `requirePermission(MERCADO_LIBRE, "editar")` | `prepareShipment`, `retryOrderInvoice` |
| Ver e imprimir la factura de una orden | `requirePermission(MERCADO_LIBRE, "ver")` | `/ordenes/[id]/factura` |
| Nota de crédito por cancelación | Ninguna: la emite el sistema | `cancelPurchase` |
| Comprobantes | Los de hoy (spec 023, solo el Dueño) | `/comprobantes` |

## 5. Pruebas

**Unitarias (Vitest):**

- `billing-read`: la respuesta real de la prueba técnica (DNI, Consumidor Final), una con CUIT y Responsable Inscripto o Monotributo (armada), una sin documento.
- `invoice-receiver`: identificado, Consumidor Final por monto bajo, faltan datos con monto alto, datos corregidos.
- `invoice-state`: cada estado y la disponibilidad del botón (fraude, cancelada, despachada, sin datos del emisor).
- El detalle de la factura desde un carrito y con un ítem sin vincular.
- La decisión de nota de crédito al cancelar (se reutiliza la de la spec 023).
- El documento de 10 × 15: una página del tamaño correcto.

**Manuales, con las cuentas de prueba y ARCA en homologación:** preparar una orden (factura, subida, impresiones), un carrito con una sola factura, ARCA sin responder (pendiente y etiqueta con advertencia), la subida fallida y su reintento, preparar dos veces, cancelar una orden facturada (nota de crédito, sin subir), y la factura en Comprobantes con origen Mercado Libre.

**E2E:** pendiente para la pasada de endurecimiento.

## 6. Riesgos y decisiones

1. **Lo subido no se corrige.** Por eso el usuario confirma antes, solo se sube lo autorizado, y la subida se reclama para no hacerla dos veces.
2. **Comprador con CUIT sin probar** en la prueba técnica: los códigos de tipo de contribuyente se mapean con la tabla de ARCA (spec 023) y se confirman con la primera venta real a un comprador con CUIT.
3. **El domicilio en la factura** solo se agrega a las de Mercado Libre; las del local siguen sin domicilio, como decidió la spec 023.
4. **Regla de transición:** si el cliente sigue usando el Facturador de Mercado Libre, la compra ya tiene una factura: el sistema lo ve antes de emitir y no factura (3.2, paso 3). Si el Facturador la carga justo entre la emisión y la subida, la del sistema queda emitida en ARCA sin subir y se anula con una nota de crédito desde Comprobantes; por eso hay que desactivar el Facturador antes de la fecha de inicio (spec, sección 5).
5. **El plazo para facturar** de la spec 023 también aplica a las órdenes; con despachos en 1 a 3 días no debería molestar.

## 7. Preguntas abiertas

Ninguna para construir. Las preguntas 8 (plazo de Mercado Libre para subir la factura) y 9 (desactivar el Facturador) se resuelven antes del arranque del cliente, y las del contador tienen propuesta.

## 8. Cambio 2026-11-24: facturar una orden que ya salió (spec, sección 10)

*(Aprobado el 2026-11-24.)*

- **`invoice-state.ts`:** `prepareAvailability` suma el caso de la orden **despachada o entregada** (`SHIPPED`, `DELIVERED`) sin factura: disponible en modo «facturar» (RF-1b). `NOT_DELIVERED` y `CANCELLED` siguen sin disponibilidad, igual que el riesgo de fraude y la factura de otro medio (RF-2b). Devuelve el modo (`prepare` o `invoice`) para que la pantalla elija el botón.
- **`order-invoice.ts`:** `loadInvoiceDraft` revisa el plazo para facturar con `invoiceBlocker` (spec 023) antes de consultar a Mercado Libre, así la orden explica el motivo sin emitir nada (RF-2b). `prepareShipment` emite y sube igual en los dos modos; `preparedAt` se guarda solo al preparar un envío.
- **Pantalla `/ordenes/[id]`:** en una orden despachada o entregada sin factura, el botón **«Facturar»** abre la misma ventana con el título «Facturar la compra» y, al terminar, solo la impresión de la factura.
- **Pruebas unitarias:** la disponibilidad en cada estado y modo. **Manual:** la compra con retiro en el local de la prueba técnica de la spec 025, entregada sin factura, se factura desde la orden en el modo de pruebas de ARCA y el aviso desaparece.
