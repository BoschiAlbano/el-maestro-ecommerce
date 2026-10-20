# Plan 014 — Caja del día

> Cómo se construye lo que dice `spec.md`. Sin tablas ni dependencias nuevas: todo se calcula leyendo lo que ya existe (spec 007 y 008).

## 1. Modelo de datos

**Sin cambios en Prisma ni migraciones.** Todo sale de `CashShift`, `CashMovement` y `Sale`:

- Movimientos del día: `CashMovement` con `createdAt` entre la medianoche de Tucumán de la fecha pedida y la del día siguiente (`tucumanMidnightUtc` / `addDaysToDateKey`, ya en `src/lib/analytics.ts`).
- Ventas del día: `Sale` con `createdAt` en el mismo rango (`voidedAt` distingue las anuladas).
- Turnos del día: los que tienen movimientos ese día **o** se abrieron ese día (un turno abierto sin movimientos igual aparece).
- Cobrado por ventas: los movimientos del día con `saleId` (el cobro suma, la devolución por anulación resta). Las ventas no guardan su medio de pago; el ledger es la única fuente.

## 2. Lógica (`src/lib/cash-day.ts`, pura y con pruebas)

- `parseDayKey(raw, todayKey)`: fecha `AAAA-MM-DD` válida y no futura; si no, hoy.
- `summarizeDay(movements)`: reutiliza `summarizeShift(0, …)` de `cash-shift.ts` — con monto inicial 0 el "esperado" es justamente el efectivo neto, y trae ingresos/egresos/neto por medio.
- `summarizeSales(sales)`: cantidad y monto de activas y de anuladas.
- `collectedBySales(movements)`: neto cobrado por efectivo y por transferencia, solo de movimientos con `saleId`.

## 3. Rutas y componentes

| Ruta | Qué hace | Permiso |
|---|---|---|
| `/caja/dia` | Resumen del día (`?fecha=AAAA-MM-DD&pagina=N`) | "ver" en Caja |

- `src/app/(app)/caja/dia/page.tsx`: Server Component. Estado actual (turno abierto de ahora), tres paneles (Efectivo, Transferencias, Ventas), desglose por turno, movimientos del día paginados con `TablePagination`.
- `src/app/(app)/caja/dia/day-picker.tsx`: selector de fecha (día anterior / siguiente / hoy / input de fecha).
- Reutiliza `Panel` y `StatCard` (`stat-card.tsx`), `computeExpectedCash` y `TablePagination`.
- Accesos (RF-9): botón "Caja del día" en `/caja` (con y sin turno abierto) y link en la fila "Hoy" del inicio.

## 4. Permisos

Validación en el servidor al cargar la página (`hasPermission(CAJA, "ver")`), igual que `/caja`. El link a "Ver venta" de un movimiento solo aparece con permiso "ver" en Ventas. Sin permisos nuevos.

## 5. Decisiones y riesgos

- **Totales sobre el día completo, lista paginada en memoria.** Se traen todos los movimientos del día para calcular los totales y se corta la página para la tabla. Un día tiene del orden de cientos de movimientos como mucho; si eso creciera, se pasan los totales a `aggregate` y la lista a `skip`/`take`.
- **Efectivo esperado/contado/diferencia del desglose son del turno entero**, no solo del día (RF-4); por eso el desglose trae todos los movimientos de cada turno, no solo los del día.
- **Zona horaria:** el rango del día se arma con la medianoche de Tucumán (UTC-3 fijo), igual que Analíticas y el inicio.
