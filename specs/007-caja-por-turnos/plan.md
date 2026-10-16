# Plan 007 — Caja por turnos

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`PaymentMethod`** (enum): `EFECTIVO`, `TRANSFERENCIA`. Nada de tarjeta ni QR (`docs/PROJECT.md`, sección 6).
- **`CashMovementType`** (enum): `INGRESO`, `EGRESO`.
- **`CashShift`**: `id`, `openingAmount` (`Decimal(12,2)`), `openedByUserId` (FK `User`), `openedAt`; `closedAt` (`DateTime?`), `countedCash` (`Decimal(12,2)?`), `difference` (`Decimal(12,2)?`), `differenceReason` (`String?`), `closedByUserId` (`String?`, FK `User`). Un turno está abierto mientras `closedAt` sea `null`.
- **`CashMovement`**: `id`, `shiftId` (FK `CashShift`, `onDelete: Cascade`), `type` (`CashMovementType`), `amount` (`Decimal(12,2)`, positivo — el signo lo da `type`, igual criterio que separar tipo de signo en vez de mezclarlos, pero acá sin el truco de `StockMovement.quantity` con signo porque no hace falta sumar/restar en una sola cuenta cacheada, sección 7), `concept` (`String`), `paymentMethod` (`PaymentMethod`), `transferReference` (`String?`, exactamente 4 dígitos, obligatorio solo si `paymentMethod` es `TRANSFERENCIA`), `userId` (FK `User`), `createdAt`. Es el único lugar donde se registra un pago en todo el sistema (spec.md, sección 2 y 10) — las specs 008/009 van a crear filas acá, nunca inventar su propio registro de pagos. Sin `sourceType`/`sourceId` todavía: se agrega cuando esas specs necesiten enlazar un movimiento a su venta o seña de origen (mismo criterio que `StockMovement`, spec 005).
- No hay campo cacheado de "efectivo esperado" en `CashShift`: se calcula sumando los `CashMovement` en efectivo del turno cada vez que hace falta (pantalla de caja abierta, previsualización y confirmación del cierre). A diferencia de `Product.currentStock` (spec 005), un turno tiene pocos movimientos (se abre y cierra seguido, no acumula años de historia), así que no se justifica cachear ni hay riesgo de desincronización que evitar.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/caja` | Turno abierto: totales, movimientos, alta de movimiento manual, cerrar turno. Si no hay turno abierto: abrir uno. | Permiso "ver" en Caja (abrir/registrar necesitan "crear"; cerrar necesita "editar" + "cerrar caja") |
| `/caja/historial` | Lista de turnos cerrados | Permiso "ver" en Caja |
| `/caja/historial/[id]` | Detalle de un turno cerrado, con sus movimientos y un botón de impresión (CSS de navegador, mismo criterio que etiquetas/tickets) | Permiso "ver" en Caja |

## 3. Lógica de servidor

- `src/lib/cash.ts`: `registerCashMovement(tx, { shiftId, type, amount, concept, paymentMethod, transferReference, userId })` — crea la fila en `CashMovement`. Mecánica pura (sin validar reglas de negocio, eso lo hace la Server Action que la llama), mismo rol que `registerStockMovement` de la spec 005.
- `src/lib/cash-shift.ts`: `computeExpectedCash(openingAmount, movements)` — función **pura**: `openingAmount` + ingresos en efectivo − egresos en efectivo de la lista de movimientos (ignora transferencia). Testeable sin Prisma.
- `src/app/(app)/caja/actions.ts`:
  - `openShift(openingAmount)` — exige "crear" en Caja; rechaza si ya hay un turno sin `closedAt`.
  - `registerMovement(type, amount, concept, paymentMethod, transferReference?)` — exige "crear" en Caja; rechaza si no hay turno abierto; si `paymentMethod` es transferencia, exige `transferReference` de 4 dígitos (y lo ignora/rechaza si se manda con efectivo). Llama `registerCashMovement` dentro de una transacción (por ahora de un solo paso, pero transaccional desde ya para cuando la spec 008 necesite sumar el movimiento de stock/venta en el mismo paso).
  - `previewClose(countedCash)` — exige "editar" en Caja + "cerrar caja"; solo lectura: calcula `computeExpectedCash` y la diferencia, no escribe nada (mismo patrón de previsualización que `previewImport`/`previewCount`).
  - `confirmClose(countedCash, differenceReason?)` — mismo permiso; vuelve a calcular la diferencia dentro de la transacción (no confía en lo que mandó la previsualización, mismo motivo que `confirmCount` en la spec 005); si la diferencia no es cero y no hay motivo, rechaza; si no, marca `closedAt`/`countedCash`/`difference`/`differenceReason`/`closedByUserId`.

## 4. Componentes

- `OpenShiftForm` (monto inicial).
- `CashMovementForm` (tipo, monto, concepto, medio de pago — `<Select>` con el prop `items` desde el primer uso, no como el bug encontrado en la spec 006 — y el campo de referencia que aparece solo si el medio es transferencia).
- `ShiftSummary` (efectivo esperado, totales por medio, lista de movimientos del turno abierto).
- `CloseShiftWizard` (dos pasos: previsualizar diferencia → confirmar, con motivo si hace falta — mismo wizard de dos pasos que la importación de productos y el conteo físico).
- `ShiftHistoryTable` / detalle con botón "Imprimir" (`window.print()`, sin librería de PDF).

## 5. Permisos

Primer uso real del módulo `CAJA` de la matriz (existe desde la spec 002, sin nada que lo ejerciera) y del permiso especial "cerrar caja" (idem). Mismo patrón que "ajustar stock" (spec 005): el permiso de módulo habilita la pantalla/acción general, el permiso especial habilita cerrar en particular.

## 6. Pruebas

- **Unitarias:** `computeExpectedCash` (solo cuenta efectivo, ingresos suman, egresos restan, transferencia se ignora, maneja una lista vacía de movimientos).
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas"). Verificación de los criterios de aceptación por revisión manual mientras tanto.

## 7. Riesgos y decisiones

- **Sin campo cacheado para el efectivo esperado**, a diferencia de `Product.currentStock`. Un turno de caja tiene un ciclo de vida corto (se abre y cierra todos los días) y pocos movimientos por turno — calcularlo al vuelo es simple y no acumula riesgo de desincronización. Si en el futuro esto se vuelve una pantalla de alto tráfico (muchos movimientos por turno), se puede revisar.
- **`CashMovement.amount` siempre positivo, con el signo dado por `type`** — a diferencia de `StockMovement.quantity` (con signo), porque acá no hay una sola cuenta corriente cacheada que necesite sumar directo un número con signo; sumar/restar según el tipo al calcular el efectivo esperado es igual de simple y el monto en pantalla (en un resumen o ticket) se lee mejor siempre positivo.
- **Único ledger de pagos (`CashMovement`), sin excepciones.** El cliente aclaró que la caja tiene que controlar todos los pagos del sistema, no solo los manuales, y que una venta puede repartirse en varias formas de pago. Por eso no se diseña un campo "medio de pago" en la futura tabla de ventas (spec 008): cada parte de un cobro es su propio `CashMovement`, enlazado al turno. Las specs 008/009 van a reusar `registerCashMovement` igual que la 006 reusa `registerStockMovement`.
- **Sin `sourceType`/`sourceId` en `CashMovement` todavía.** Se va a necesitar cuando las specs 008/009 quieran enlazar un movimiento a la venta o seña que lo generó (para, por ejemplo, poder rastrear de dónde vino un ingreso). No se agrega ahora sin un consumidor real — mismo criterio que `StockMovement` en la spec 005.
