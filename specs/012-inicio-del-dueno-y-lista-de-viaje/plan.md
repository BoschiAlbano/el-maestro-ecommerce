# Plan 012 — Inicio del dueño y lista de viaje

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

Sin tablas nuevas. Todo se calcula sobre `CashShift`, `CashMovement` (spec 007), `Order`, `OrderItem` (spec 009) y `Product` (spec 004) ya existentes. Solo lectura.

## 2. `src/lib/travel-list.ts` (función pura, con tests)

```ts
computeTravelList(
  products: { id: string; name: string; currentStock: number; minStock: number }[],
  committed: Map<string, number>, // de computeCommittedQuantities, specs/009
): { id: string; name: string; available: number; suggested: number }[]
```

Por cada producto, `available = currentStock - (committed.get(id) ?? 0)`. Si `available < minStock`, entra a la lista con `suggested = minStock - available` (siempre positivo). Esta es la única regla: unifica "bajo stock" y "comprometido en pedidos" (spec.md, sección 5) — tanto la alerta del inicio como la lista de viaje completa usan la misma función, la alerta solo muestra el conteo.

## 3. `src/lib/home-data.ts` (consulta, no pura, `server-only`)

`loadHomeData(currentUser)` devuelve solo lo que el usuario tiene permiso de ver (el resto queda `null`):

- **Caja** (si "ver" en Caja): turno abierto ahora (`CashShift` con `closedAt: null`, con sus movimientos) y `computeExpectedCash` (spec 007) si hay uno; además, el neto de **todos** los `CashMovement` de hoy (horario de Tucumán — mismos helpers de fecha que `src/lib/analytics.ts`, sección 2 del plan 011: `toTucumanDateKey` + `tucumanMidnightUtc` + `addDaysToDateKey` para el rango `[hoy, mañana)`), sin importar a qué turno pertenezcan.
- **Pedidos** (si "ver" en Pedidos): `prisma.order.count({ where: { status: "PENDIENTE" } })`.
- **Inventario** (si "ver" en Inventario): productos activos (con filtro opcional de marca/rubro, a pedido del cliente tras la implementación — ver nota post-cierre en `tasks.md`) + `OrderItem` de pedidos pendientes (igual consulta que `/inventario`, spec 009) → `computeCommittedQuantities` → `computeTravelList` → de ahí sale tanto el conteo para la alerta del inicio (siempre sin filtro) como la lista completa de `/lista-de-viaje` (con filtro). El comprometido se calcula siempre sobre todos los productos — el filtro solo decide qué se muestra, no cambia cuánto hay realmente comprometido de cada uno.

## 4. Rutas y pantallas

| Ruta | Qué hace | Quién accede |
|---|---|---|
| `/` | Inicio: estado de caja + resumen de hoy, pedidos pendientes, alerta de stock — cada sección solo si hay permiso | Según cada sección (spec.md, sección 6) |
| `/lista-de-viaje` | Lista completa con cantidad sugerida, botón "Copiar" (texto) y link a exportar | Permiso "ver" en Inventario |
| `/lista-de-viaje/exportar` | Descarga un `.xlsx` de la lista (una sola hoja: producto, disponible, mínimo, sugerida) | Permiso "ver" en Inventario |

## 5. Copiar como texto

Un botón de cliente (`navigator.clipboard.writeText`) arma el texto en el propio componente a partir de la lista ya cargada por el servidor (sin otra consulta): `"<cantidad> x <producto>"` por línea; si la lista está vacía, el texto dice que no hay nada para comprar (spec.md, sección 7).

## 6. Permisos

Sin módulo nuevo — reusa Caja, Pedidos e Inventario, cada sección gateada por su propio "ver" (spec.md, sección 6). `/lista-de-viaje` y su exportación piden "ver" en Inventario — no se exige el permiso "exportar" de la matriz: es una lista de compra interna, no uno de los reportes de Analíticas.

## 7. Pruebas

- **Unitarias**: `computeTravelList` — producto por encima del mínimo (no entra), por debajo sin comprometido, por debajo con comprometido que lo empuja más abajo, disponible negativo (sugerida más alta, sin tope).
- **E2E**: diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas").

## 8. Riesgos y decisiones

- **La alerta del inicio y la lista de viaje completa comparten la misma función** (`computeTravelList`) — evita que el conteo de la alerta y el detalle de la lista puedan desincronizarse por tener dos cálculos distintos.
- **El resumen de "caja de hoy" cuenta todos los movimientos del día, no solo los del turno abierto** — si hubo más de un turno hoy (cerrado y vuelto a abrir), igual se refleja completo (spec.md, sección 4, RF-2).
- **Sin PDF para la lista de viaje** — decisión ya tomada en `spec.md`, sección 10.
