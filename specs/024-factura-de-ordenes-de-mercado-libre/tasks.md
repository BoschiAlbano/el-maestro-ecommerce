# Tareas 024 — Factura de órdenes de Mercado Libre

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (cuentas de prueba o revisión manual); el resto se hace en el código.

## Preparación

- [x] **T-001** **(D)** Prueba técnica (plan, sección 0) con las cuentas de prueba y ARCA en homologación.
  - Hecho cuando: cada punto tiene resultado en `prueba-tecnica.md` y el plan lo tiene en cuenta.
  - Hecha el 2026-11-20: datos fiscales por `billing-info` v2, emisión con la spec 023, subida del PDF y cancelación con la factura subida (no se puede borrar ni reemplazar). Encontró y se corrigió un error de cancelación de la spec 022 (commit `268549b`, en el PR).

## Base de datos

- [x] **T-002** Migración: `receiverAddress` y `receiverEdited` en `invoices`; `invoiceUploadedAt`, `mlFiscalDocumentId`, `invoiceUploadError`, `preparedAt` y `preparedByUserId` en `ml_orders`. Copia previa.
  - Hecho cuando: aplica en la base de la nube, sin diferencias con el esquema.

## Lógica pura (con pruebas)

- [x] **T-003** `billing-read.ts` e `invoice-receiver.ts`: datos fiscales de Mercado Libre al comprador de la factura, y la decisión entre identificar, Consumidor Final o «faltan datos».
  - Hecho cuando: Vitest cubre la respuesta real de la prueba técnica, una con CUIT, una sin documento, y los montos bajo y alto.
- [x] **T-004** `invoice-state.ts`: estado de la factura de una orden y disponibilidad de «Preparar envío».
  - Hecho cuando: Vitest cubre cada estado y cada motivo para no estar disponible.

## Servidor

- [x] **T-005** `orders-api.ts`: datos fiscales, archivos cargados (404 = ninguno) y subida.
  - Hecho cuando: con la compra de la prueba técnica, lee los datos y la factura cargada.
- [x] **T-006** Facturación (spec 023): emitir con origen, domicilio y la marca de corregido; el detalle de una venta de Mercado Libre desde los ítems de la orden; el domicilio en el comprobante.
  - Hecho cuando: las pruebas de la spec 023 siguen pasando y el detalle de un carrito trae los dos productos.
- [x] **T-007** `order-invoice.ts`: `loadInvoiceDraft`, `prepareShipment`, `uploadOrderInvoice` (reclamada, sin subir dos veces), reintento, subida al autorizarse una factura pendiente y en la pasada diaria.
  - Hecho cuando: preparar una orden de prueba emite, sube y no se puede repetir; una compra con factura ya cargada no se factura.
  - Hecha el 2026-11-20. El PDF A4 pasó a `src/lib/facturacion/invoice-pdf.tsx` para usarlo desde la subida. La subida se dispara desde `authorizeInvoiceById` (al autorizarse, también una pendiente) y en la pasada diaria; reconoce como propio el archivo cargado con el mismo id o el mismo nombre (Mercado Libre guarda el nombre). La prueba de punta a punta queda para T-013: las órdenes de prueba guardadas están canceladas.
- [x] **T-008** Factura en 10 × 15 (`@react-pdf/renderer`) y la ruta `/ordenes/[id]/factura`, con A4 como alternativa.
  - Hecho cuando: Vitest arma una página de 10 × 15 y la factura de la prueba se ve completa, con QR.
  - Hecha el 2026-11-20: `invoice-pdf.test.ts` y la factura 91 de la prueba técnica en 10 × 15.
- [x] **T-009** Nota de crédito al cancelar una orden facturada, dentro de la cancelación de la spec 022.
  - Hecho cuando: cancelar una orden facturada emite la nota de crédito, y una pendiente se verifica y se descarta.
  - Hecha el 2026-11-20, con la misma decisión que la anulación del local (`decideOnVoid`). La factura 91 de la prueba técnica (venta anulada con la factura autorizada) se regularizó con la nota de crédito C nº 7, en homologación. La cancelación de punta a punta queda para T-013.
- [x] **T-010** Campanita: órdenes despachadas sin factura subida.
  - Hecho cuando: Vitest cubre el aviso.

## Pantallas

- [x] **T-011** `/ordenes/[id]`: «Preparar envío» (ventana con confirmación y corrección), estado de la factura, reintentos e impresiones; `/ordenes`: filtro y marca de factura; `/comprobantes`: columna y filtro Origen.
  - Hecho cuando: se prepara una orden de prueba de punta a punta desde la pantalla.
  - Hecha el 2026-11-20 en el código (tipos, linter, build y pruebas). Se sumó el estado «Anulada con nota de crédito» para las órdenes canceladas después de facturar, y el filtro de estado «Despachadas», al que lleva el aviso de la campanita. La prueba de punta a punta desde la pantalla queda para T-013.

## Documentación

- [x] **T-012** Notas en las specs 022 y 023, y la sección de factura en la guía del dueño.
  - Hecho cuando: cada documento tiene su nota con fecha.
  - Hecha el 2026-11-20: specs 022 (RF-16 y RF-19) y 023 (RF-20 y RF-24), `docs/guia-mercado-libre.md` (sección «Factura de las órdenes») y `docs/guia-facturacion.md`.

## Verificación final

- [x] **T-013** **(D)** Verificación manual con las cuentas de prueba y ARCA en homologación, siguiendo el plan, sección 5.
  - Hecha el 2026-11-20. El cliente preparó un carrito de dos productos (factura C nº 92, subida y vista desde el comprador), imprimió factura y etiqueta, lo preparó dos veces y lo canceló (nota de crédito C nº 8). Sobre una segunda compra, un script cortó ARCA y después la subida, solo en su proceso: pendiente → autorizada (C nº 93) → «emitida, sin subir» → subida con el reintento.
- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas").
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-20)».
