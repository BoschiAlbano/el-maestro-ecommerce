# Tareas 023 — Facturación electrónica (ARCA)

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (credenciales o pantalla); el resto se hace en el código.

## Preparación y prueba técnica

- [x] **T-001** **(D)** Prueba técnica A-1 a A-13 (plan, sección 0) en homologación, con el certificado y la clave del desarrollador leídos de una carpeta fuera del repositorio.
  - Hecho cuando: cada verificación tiene su resultado anotado en `prueba-tecnica.md`, y el plan está corregido si algo difiere.
  - Hecha el 2026-11-11: las 13 verificaciones tienen resultado en `prueba-tecnica.md`. Hallazgos que cambiaron el plan: el rechazo de ARCA llega como éxito con `Resultado: "R"`, el permiso temporal bloquea el certificado si se pierde (y un certificado nuevo lo destraba), y el plazo de 5 días se confirmó. **Sin poder verificar en homologación:** que ARCA rechace un CUIT inexistente y el escaneo con un celular.

- [x] **T-002** Dependencias: `@arcasdk/core`, `qrcode`, `node-forge` y sus tipos.
  - Hecho cuando: instaladas, y linter, tipos y pruebas siguen pasando.
  - Hecho el 2026-11-11: `@arcasdk/core` 2.0.2, `qrcode` 1.5.4, `node-forge` 1.4.3 y sus tipos. Los tipos de la biblioteca confirman lo que suponía el plan: certificado y clave como texto, almacenamiento propio del permiso temporal (`ticketStorage` con guardar, leer y borrar), emisión con número explícito (`createVoucher`), consulta de un comprobante (`getVoucherInfo`) y condiciones frente al IVA (`getIvaReceptorTypes`). Falta verlo funcionar contra ARCA (T-001).

- [x] **T-003** Cifrado en un módulo común: mover `token-crypto.ts` de la spec 019 a `src/lib/secret-box.ts`, sin cambiar su comportamiento. `ARCA_ENCRYPTION_KEY` en `.env.example`.
  - Hecho cuando: las pruebas de la spec 019 pasan sin cambios de lógica.
  - Hecho el 2026-11-11: `src/lib/secret-box.ts` (`encryptSecret`, `decryptSecret`). `token-crypto.ts` de la spec 019 quedó como un alias, y sus 8 pruebas pasan sin tocarlas. `ARCA_ENCRYPTION_KEY` en `.env.example` y generada en `.env.development.local`.

## Base de datos

- [x] **T-004** Migración: `fiscal_config`, `arca_credentials`, `arca_tickets`, `invoices`, sus enums, y las restricciones a mano (fila única, una factura por venta, una nota de crédito por factura, números sin repetir).
  - Hecho cuando: aplica en la base local, el esquema y la base quedan sin diferencias, y la base rechaza una segunda factura para la misma venta.
  - Hecho el 2026-11-11: `prisma/migrations/20261111230000_add_invoicing`. Aplicada en la base local, sin diferencias con el esquema. Probadas en la base, en una transacción deshecha, las seis restricciones: segunda factura para la misma venta (rechazada; aceptada si la primera está descartada), autorizado sin número, nota de crédito sin factura, segunda nota de crédito, número repetido y segunda fila de configuración. **No está aplicada en la base del cliente.**

## Lógica pura (con pruebas)

- [x] **T-005** `documentos.ts`: validar CUIT (dígito verificador) y DNI.
  - Hecho cuando: Vitest cubre válidos, dígito incorrecto, largo incorrecto y formatos con guiones o puntos.
  - Hecho el 2026-11-11: `src/lib/facturacion/documentos.ts`, 12 pruebas.

- [x] **T-006** `certificate.ts`: leer un certificado (CUIT, vencimiento), comprobar que corresponde a una clave y armar el pedido de certificado.
  - Hecho cuando: Vitest cubre certificado vigente, vencido, clave que no corresponde, archivo que no es un certificado, y un pedido generado que se puede leer de vuelta con el CUIT y la razón social.
  - Hecho el 2026-11-11: `src/lib/facturacion/certificate.ts`, 23 pruebas con certificados de mentira. El pedido que genera se revisó además con `openssl`: titular `C=AR, O=…, CN=…, serialNumber=CUIT …`, clave de 2048 bits, firma válida. ARCA lo aceptó (A-13).

- [x] **T-007** `fiscal-config.ts` e `invoice-policy.ts`: qué falta para facturar; si una venta se puede facturar; si hay que identificar al comprador; nota de crédito o descartar.
  - Hecho cuando: Vitest cubre los casos del plan, sección 6.
  - Hecho el 2026-11-11: `fiscal-config.ts`, `invoice-policy.ts` y `fechas.ts` (fechas fiscales en horario de Tucumán). Pruebas en `politica.test.ts`: lo que falta para facturar, identificación justo en el monto, plazo justo en el borde y con plazo 0, y la decisión al anular. El código de «Consumidor Final» (5) queda por confirmar en A-5.

- [x] **T-008** `voucher.ts` y `qr.ts`: pedido a ARCA y dirección del QR.
  - Hecho cuando: Vitest cubre Consumidor Final, DNI, CUIT, nota de crédito asociada y la fecha en horario de Tucumán cerca de la medianoche; el QR coincide con el formato confirmado en A-12.
  - Hecho el 2026-11-11: `voucher.ts` y `qr.ts`, 16 pruebas. El QR se probó con el **ejemplo oficial de la especificación de ARCA** (`QRespecificaciones.pdf`): da exactamente el mismo texto en Base64. Pedido a ARCA según los tipos de la biblioteca (`CondicionIVAReceptorId`, `CbtesAsoc` con `Tipo 11`, tipo 11 y 13). ARCA aceptó el pedido (A-6 a A-8) y el QR decodifica idéntico con un lector independiente (A-12).

- [x] **T-009** `accumulated.ts`: acumulado de 12 meses y cruce del 80 %.
  - Hecho cuando: Vitest cubre facturas menos notas de crédito, comprobantes de prueba excluidos y el cruce exacto.
  - Hecho el 2026-11-11: `accumulated.ts`. Pruebas en `politica.test.ts`: facturas menos notas de crédito, comprobantes de prueba excluidos, borde de los 12 meses y cruce exacto del 80 % (no vuelve a avisar una vez pasado).

## Conexión con ARCA

- [x] **T-010** `gateway.ts` (interfaz), `arcasdk-gateway.ts` y `ticket-storage.ts`, con el pedido del permiso bajo bloqueo (plan, sección 3.3b).
  - Hecho cuando: contra homologación consulta el estado y el último número, la segunda llamada reutiliza el permiso guardado en `arca_tickets`, dos procesos que lo piden a la vez piden uno solo, y el error `alreadyAuthenticated` se traduce a un mensaje claro sin reintentar en ciclo.
  - Hecho el 2026-11-11: `gateway.ts`, `arcasdk-gateway.ts`, `ticket-storage.ts` (cifrado, con la base inyectada), `ticket-repo.ts` (Prisma) y `ensure-ticket.ts`. 17 pruebas (`ticket.test.ts`): guardar y leer, nada en claro en la base, permiso vencido o de otro CUIT, ambientes separados, clave de cifrado distinta (lanza en lugar de pedir otro permiso), y cuatro procesos a la vez piden el permiso una sola vez. **Probado contra ARCA en homologación con el gateway real:** estado, último número, emisión autorizada, consulta del comprobante emitido y de uno inexistente (`null`), número repetido (vuelve como rechazo `10016` de numeración, no como excepción), y el permiso rechazado por ARCA (`already_authenticated`, a los 10 a 12 segundos) y por clave de cifrado distinta (`storage`).
  - **Empaquetado (resuelto el 2026-11-11):** con una ruta temporal que importaba la sesión con ARCA, `pnpm build` incluye la biblioteca y el build de producción corrió contra la base local y ARCA sin tocar `next.config.ts` (la ruta se borró). **Hallazgo:** la primera llamada tardó **7,7 segundos** (arranque en frío) y las siguientes 80 a 160 ms. Ver el riesgo 14 del plan.
  - Reemplazar o quitar el certificado de un ambiente borra su permiso guardado (hecho en T-011).
- [x] **T-011** `arca-credentials.ts` y las acciones del certificado (generar pedido, subir certificado, subir par existente, quitar), solo Dueño y con auditoría.
  - Hecho cuando: un certificado inválido se rechaza con su motivo; la clave privada queda cifrada en la base y ninguna acción la devuelve.
  - Hecho el 2026-11-11: `credential-service.ts` (con la base y el cifrado inyectados, 25 pruebas), `credential-repo.ts`, `fiscal-data.ts`, `fiscal-schema.ts` (14 pruebas, incluye montos escritos como en Argentina: `17.595.182,74`), `arca-session.ts` y las acciones solo-Dueño de `facturacion-actions.ts` (datos del emisor, generar pedido, subir certificado con o sin clave, quitar, cambiar de ambiente, probar conexión). **Probado con la base local real y ARCA en homologación:** el certificado de `afip/` se carga con su clave (cifrada: la base no contiene `PRIVATE KEY` en claro, tampoco la auditoría), el estado que ve la pantalla no incluye la clave, se abre una sesión con ARCA y se reutiliza el permiso guardado, un pedido para producción no toca el certificado de pruebas, y con otra clave de cifrado del servidor lo dice con un mensaje claro. Las acciones no tienen pantalla todavía: se prueban en T-016.

- [x] **T-012** `invoice-service.ts`: autorizar con bloqueo y control de duplicados.
  - Hecho cuando: con ARCA simulado hay pruebas de intento anterior ya autorizado (se recupera), número tomado por otro, y dos autorizaciones simultáneas con números correlativos; y contra homologación se emite una factura real de prueba.
  - Hecho el 2026-11-11: `invoice-service.ts` (26 pruebas con un ARCA simulado que se comporta como el real), `invoice-store.ts` e `invoices.ts`. **Probado con la base local real y ARCA en homologación:** una factura queda pendiente dentro de la transacción y se autoriza después (número, código de 14 dígitos, vencimiento a 10 días, foto del emisor); autorizarla otra vez no emite otra; la nota de crédito sale asociada con su propia numeración y la base rechaza una segunda; **una respuesta perdida real** (ARCA autorizó, el sistema no se enteró) se recupera en el reintento sin emitir una factura de más; una venta anulada con la factura sin emitir se descarta; **tres facturas simultáneas** salen con números correlativos 77, 78 y 79 (el bloqueo en la base funciona); y con la clave de cifrado equivocada el comprobante queda pendiente con el motivo, sin lanzar.
  - **Dos errores reales que las pruebas detectaron y se corrigieron:** las fechas de comprobante (sin hora, medianoche UTC) se convertían a Tucumán y salían un día corridas en el QR, en la factura asociada de cada nota de crédito y en el acumulado; ahora hay una regla explícita (`dateOnly` para fechas de la base, `fiscalDate` para momentos). Y el simulador numeraba igual todos los tipos, cuando en ARCA cada tipo tiene su numeración.

## Integración con ventas y pedidos

- [x] **T-013** `confirmSale` y `deliverOrderItems` con factura opcional: el comprobante pendiente se crea en la transacción de la venta y se autoriza después.
  - Hecho cuando: una venta con factura queda autorizada; con ARCA simulado caído, la venta se confirma y la factura queda pendiente.
  - Hecho el 2026-11-11. **Probado con las acciones reales, la base local y ARCA en homologación:** una venta con factura a Consumidor Final queda autorizada (número, CAE de 14 dígitos); sin factura no crea comprobante; con datos de comprador inválidos devuelve el error y **no se vende**; con ARCA inaccesible (clave de cifrado equivocada) la venta se confirma, la factura queda pendiente con el motivo y «Reintentar» la autoriza; una entrega de pedido con seña que cubre todo sale facturada por el total de la entrega ($900 con seña de $1.000: la seña no se descuenta). La ventana de cobro de la entrega también se abre cuando no hay nada que cobrar, para poder pedir la factura.
- [x] **T-014** `voidSale`: nota de crédito, o descartar la factura pendiente tras el control de duplicados.
  - Hecho cuando: anular una venta facturada emite la nota de crédito, y la anulación no depende de ARCA.
  - Hecho el 2026-11-11. **Probado igual que T-013:** anular una venta facturada emite la nota de crédito asociada (autorizada, numeración propia); anular con la factura pendiente y ARCA caída **no espera por ARCA** (la venta queda anulada y el comprobante pendiente, con aviso en pantalla), y al volver ARCA el reintento resuelve: sin intento previo se descarta (nunca existió en ARCA).
- [x] **T-015** Facturar una venta ya hecha y reintentar un comprobante pendiente.
  - Hecho cuando: respeta el plazo de la configuración y rechaza ventas anuladas o ya facturadas.
  - Hecho el 2026-11-11. Acciones `issueInvoiceForSale`, `retryInvoice` (permiso de crear ventas, validado en el servidor) y `warmUpInvoicing`. **Probado:** facturar una venta hecha sin factura sale autorizada con la fecha de hoy y una segunda factura para la misma venta se rechaza («Esta venta ya tiene una factura»). Las reglas de plazo y de venta anulada están cubiertas por las pruebas unitarias de `invoice-policy`.
## Interfaz

- [x] **T-016** Pestaña "Facturación" en Configuración: datos del emisor, certificado, probar conexión, tope.
  - Hecho cuando: muestra qué falta para facturar; el Dueño carga los datos y el certificado; otro rol solo ve.
  - Hecho el 2026-11-11 (código, tipos y compilación; **falta verla en pantalla, ver T-025**). Pestaña «Facturación»: estado (lista lo que falta), datos del emisor, un bloque de certificado por ambiente (generar pedido y descargarlo, subir certificado, subir certificado con su clave, quitar), cambio de ambiente con confirmación y «Probar conexión». La ve quien tiene permiso «ver»; todo lo editable y los certificados son solo del Dueño (cada acción lo vuelve a validar en el servidor).
- [x] **T-017** Bloque "Factura" en la ventana de cobro (ventas y pedidos).
  - Hecho cuando: aparece solo si se puede facturar, y exige los datos del comprador desde el monto configurado.
  - Hecho el 2026-11-11 (código y pruebas del armado del pedido; **falta verlo en pantalla, ver T-025**). Bloque «Emitir factura» en el cobro (viene apagado, aparece solo si se puede facturar), Consumidor Final o identificar al comprador, y obliga a identificar desde el monto configurado; al tildarlo se adelanta la conexión con ARCA. 8 pruebas del armado y la validación.
- [x] **T-018** `invoice-dialog.tsx` e impresión de 58 mm con QR.
  - Hecho cuando: tras cobrar con factura se ve e imprime el comprobante; si quedó pendiente, muestra el motivo, "Reintentar" y el ticket.
  - Hecho el 2026-11-11. `InvoiceDialog` + HTML de 58 mm con QR (34 mm, ~5 puntos por módulo) que es el mismo en pantalla y en la impresora. **Visto en un navegador** con una factura real de homologación (leyenda de prueba arriba y abajo, datos del emisor, comprador, ítems, CAE y QR). Pendiente: ventana abierta tras cobrar (T-025) e impresión física en la térmica.
- [x] **T-019** PDF A4 del comprobante.
  - Hecho cuando: trae todos los datos del RF-20, pesa muy por debajo de 1 MB, y en homologación lleva la leyenda de prueba.
  - Hecho el 2026-11-11. PDF A4 en `/comprobantes/[id]/pdf` (permiso de ver ventas; 409 si el comprobante no está emitido). **Generado con comprobantes reales de homologación: ~16 KB**, con fuentes estándar, QR y leyenda de prueba. Falta abrirlo en un visor (T-025).
- [x] **T-020** Panel de factura en el detalle de la venta.
  - Hecho cuando: muestra el estado y permite emitir, reintentar, imprimir y descargar.
  - Hecho el 2026-11-11 (código y compilación; **falta verlo en pantalla, ver T-025**). Panel «Facturación» en el detalle de la venta: comprobantes con estado, «Ver» (imprimir/PDF), «Reintentar» si quedó pendiente, y «Facturar esta venta» (o el motivo por el que no se puede, por ejemplo pasaron los días).
- [x] **T-021** `/comprobantes`: lista, filtros, total, exportación a Excel y acumulado contra el tope.
  - Hecho cuando: filtra por fecha, tipo, estado y origen; el acumulado solo lo ve el Dueño.
  - Hecho el 2026-11-11 (código, 9 pruebas de los filtros y compilación; **falta verlo en pantalla, ver T-025**). `/comprobantes` (solo Dueño): filtros por fecha, estado, tipo y ambiente; totales (facturado, notas de crédito, neto); acumulado de 12 meses contra el tope; aviso de pendientes; exportación a Excel con los mismos filtros (las notas van en negativo). **Cambio respecto de lo planeado:** el filtro por *origen* se suma con la spec 024, cuando existan comprobantes de Mercado Libre; hoy todo es de mostrador y un filtro con una sola opción sería ruido.
- [x] **T-022** Campanita: comprobantes pendientes, certificado por vencer y aviso del tope.
  - Hecho cuando: aparecen y desaparecen solos según el estado; el del tope se crea una sola vez al cruzar el 80 %.
  - Hecho el 2026-11-11. Avisos en vivo en la campanita, solo para el Dueño: comprobantes pendientes y certificado por vencer (desde 30 días; también «vence hoy» y «ya venció»); desaparecen solos al resolverse. El aviso del tope (80 %) se crea una sola vez al cruzar el umbral (T-012). 4 pruebas.
## Cierre

- [x] **T-023** Reinicio del sistema (spec 017): borra los comprobantes, advierte con claridad si hay reales autorizados (cantidad, qué se pierde y qué no), conserva configuración, certificado y permiso.
  - Hecho cuando: el resumen previo destaca los comprobantes reales, hay pruebas de los dos casos y el cambio está anotado en la spec 017.
  - Hecho el 2026-11-11. `invoices` entra en las tablas que vacía el reinicio; el resumen suma la fila de comprobantes y, con reales emitidos, una advertencia fuerte (cuántos, que **no se anulan en ARCA**, qué se pierde —la copia y el acumulado—, qué no —la numeración, el emisor y el certificado— y que conviene bajar el Excel); aviso aparte para los pendientes. El certificado cargado por otro Dueño pasa a quien reinicia (si no, borrar al usuario fallaría). **Probado en la base local dentro de una transacción que se revirtió:** comprobantes y ventas quedan en 0, `fiscal_config`, `arca_credentials` y `arca_tickets` se conservan, y borrar a un usuario que cargó el certificado no falla. Nota agregada en la spec 017. 5 pruebas nuevas.
- [x] **T-024** Anotar en las specs 008 y 009 la opción de facturar; guía de uso corta para el cajero en la verificación manual.
  - Hecho cuando: las dos specs describen el cambio con su fecha.
  - Hecho el 2026-11-11. Notas con fecha en las specs 008 (venta de mostrador) y 009 (entrega con seña; la seña no se factura aparte), y guía corta en `docs/guia-facturacion.md` (mostrador, qué hacer si ARCA no responde, facturar una venta hecha, anular, pedidos, y lo del Dueño).
- [x] **T-025** **(D)** Verificación manual en homologación de todos los criterios de aceptación.
  - Hecho cuando: cada criterio tiene su resultado anotado.
  - **QR escaneado con un celular (2026-11-12):** abre la «Constatación de Comprobantes con CAE» de ARCA con **todos los campos ya cargados y correctos** (CUIT del emisor, CAE, fecha, tipo 11, punto de venta y número, importe y documento del receptor 99/0): ARCA leyó el QR completo. Al consultar da error, esperable en homologación: esa consulta pública mira los comprobantes reales y el CAE de prueba no existe ahí. La confirmación final llega con la primera factura real.
  - **Hecha el 2026-11-12:** el cliente recorrió todas las pantallas y flujos a mano (cobro con y sin factura, comprobante, pendiente y reintento, detalle de la venta, anulación con nota de crédito, `/comprobantes`, Configuración, reinicio) y todo quedó bien. Observaciones que salieron del recorrido: (1) comprobantes pendientes de pruebas con total $0 daban un mensaje confuso → ahora el motivo exacto y el cobro rechaza facturar $0; (2) la nota de crédito se imprime desde «Ver» del panel Facturación, sin ventana automática (decidido); (3) un corte de red de la campanita tumbaba la pantalla → ahora la tolera.
  - Estado previo a esa revisión, con lo comprobado sin pantalla: Ya comprobado SIN pantalla (acciones reales + base local + ARCA en homologación, y pruebas unitarias): factura autorizada con número y CAE, sin factura sin comprobante, comprador identificado, entrega con seña por el total, ARCA caída → venta hecha y factura pendiente → Reintentar la emite, respuesta perdida recuperada sin duplicar, facturar después desde el detalle (y no dos veces), anulación con nota de crédito, anulación sin esperar a ARCA, tres facturas simultáneas correlativas, reinicio con comprobantes, comprobante de 58 mm visto con QR, PDF generado. **Falta verlo con los ojos** (el cliente lo revisa a mano, ver `AGENTS.md`): pestaña Facturación (cargar datos, generar pedido, subir certificado, rechazos con su motivo, un rol que no es Dueño solo ve), ventana de cobro (aparece solo si se puede facturar, exige datos desde el monto), ventana del comprobante tras cobrar (imprimir, PDF, pendiente con «Reintentar» y «Ver ticket»), panel del detalle de la venta, `/comprobantes` (filtros, totales, Excel), campanita, y el reinicio con aviso fuerte. El recorrido está en `docs/guia-facturacion.md`. Además: el escaneo del QR con un celular y la impresión física en la térmica de 58 mm.
- [ ] **T-026** Probar la conexión con ARCA desde un despliegue de Vercel (plan, sección 8, riesgo 1). **Pendiente de despliegue.**
  - Hecho cuando: "Probar conexión" responde bien desde el sitio publicado, o está decidida la alternativa.
  - **Estado (2026-11-11): pendiente de despliegue.** Lo ya comprobado: el build de producción incluye la biblioteca de ARCA y corre contra homologación sin tocar `next.config.ts` (T-010). Falta medir en Vercel el arranque en frío (en local, 7,7 s la primera llamada contra 80–160 ms las siguientes) y confirmar que el plan gratuito no corta la función (riesgo 14).

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas").
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`). — 2026-11-11: 515 pruebas pasando, 0 errores de tipos y de linter, build de producción correcto con las rutas nuevas.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada», con T-026 como pendiente de despliegue.
