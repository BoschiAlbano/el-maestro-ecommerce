# Plan 011 — Analíticas y exportación

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

Sin tablas nuevas. Todo se calcula sobre lo que ya existe: `Sale`, `SaleItem`, `CashShift`, `CashMovement`, `Product`, `Order` (specs 004-009). Esta spec es de solo lectura — ninguna acción escribe nada.

## 2. Arquitectura de datos: por qué `SaleItem`, no `Sale`

Cuando se filtra por producto, marca o rubro, el total/ticket promedio/evolución tienen que reflejar solo la porción de cada venta que corresponde a ese filtro — no el total completo de una venta que además tenga otros ítems sin relación. Por eso la unidad base de las métricas de ingresos es `SaleItem` (con su `quantity` y `unitSalePrice`, uniendo `Sale` para fecha/empleado/turno y `Sale.order` para canal), no `Sale.total`. Sin ningún filtro de producto/marca/rubro, sumar los `SaleItem` de una venta da el mismo resultado que su `total`, así que no hay inconsistencia.

- **Ventas anuladas (`Sale.voidedAt` no nulo) se excluyen de todo** — no suman a ningún total, ranking ni comparación.
- **Medio de pago**: una venta con pago dividido (efectivo + transferencia, spec 008) puede aparecer en el filtro de ambos medios a la vez — se decide no prorratear, por simplicidad (`docs/PROJECT.md` no pide ese nivel de detalle).
- **Canal**: una venta sin pedido vinculado (`Sale.orderId` nulo) se agrupa como "Mostrador"; el resto usa `Order.channel` tal cual se escribió (texto libre, spec 009 — sin normalizar mayúsculas/minúsculas en esta spec).
- **"Productos sin movimiento"** respeta los filtros de marca/rubro (tiene sentido preguntar "qué productos de esta marca no se vendieron"), pero no un filtro de producto puntual (no aporta nada filtrar "sin movimiento" a un solo producto elegido) — si hay un producto elegido, esta sección no se muestra.
- **Valorización de stock** es siempre del stock **actual**, sin importar el rango de fechas elegido — no existe un historial de stock por fecha para calcular "valorización al 1/5" (`StockMovement` registra cambios, no fotos del total en cada momento pasado). Se documenta así para que no se espere que cambie con el filtro de fechas.
- **Período anterior de comparación**: mismo largo que el rango elegido, desplazado hacia atrás esa misma cantidad de días — no específicamente "el mes calendario anterior", para que funcione con cualquier rango custom, no solo con meses completos.
- **Agrupar por día** tiene que usar la fecha en horario de Tucumán, no UTC (constitución, regla 9) — una venta a las 23:30 hora Argentina puede ser ya el día siguiente en UTC.

## 3. `src/lib/analytics.ts` (funciones puras, con tests)

- `toTucumanDateKey(date: Date): string` — fecha `YYYY-MM-DD` en `America/Argentina/Tucuman`, para agrupar por día sin el corrimiento de UTC.
- `computePreviousPeriod(from: Date, to: Date): { from: Date; to: Date }` — desplaza el rango hacia atrás su propio largo.
- `computeTicketPromedio(total: number, count: number): number` — `count === 0` devuelve 0, no `NaN`.
- `computeMarginSummary(items: { unitSalePrice: number; unitCost: number; quantity: number }[]): { totalMargin: number; marginPct: number }` — `marginPct` con guarda contra total vendido cero.
- `computeStockValuation(products: { currentStock: number; purchasePrice: number }[]): number`
- `groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]>` — agrupador genérico reusado para empleado/turno/canal/producto/marca/rubro; el total y el conteo de cada grupo se calculan con `reduce` sobre el array ya agrupado, sin otra función aparte por dimensión.

## 4. `src/lib/analytics-data.ts` (consulta compartida, no pura)

`server-only`. Expone `loadAnalyticsData(filters, currentUser): Promise<AnalyticsData>`, usada por la pantalla y por las dos rutas de exportación — así la lógica de filtros vive en un solo lugar.

- `filters`: `{ from: Date; to: Date; employeeId?: string; productId?: string; brandId?: string; rubroId?: string; channel?: string; paymentMethod?: PaymentMethod }`.
- Trae `SaleItem` del rango (con `sale`, `sale.shift`, `sale.order`, `sale.cashMovements`, `product.brand`, `product.rubro`), aplicando los filtros como `where` de Prisma donde se puede (fecha, empleado, producto/marca/rubro) y en JS donde no (canal "Mostrador", medio de pago por línea de pago).
- Repite la misma consulta para el período anterior (`computePreviousPeriod`).
- Trae `CashShift` cerrados en el rango, para las diferencias de caja por empleado.
- Trae `Product` activos (con filtro de marca/rubro si corresponde) para "sin movimiento" y valorización.
- Si `currentUser` no tiene el permiso especial "ver costos y márgenes", `margin` y `stockValuation` del resultado vienen `null` — ni se calculan.

## 5. Rutas y pantallas

| Ruta | Qué hace | Quién accede |
|---|---|---|
| `/analiticas` | Filtros + resumen + evolución diaria + agrupaciones + top/sin-movimiento + margen/valorización (si corresponde) + diferencias de caja + botones de exportar | Permiso "ver" en Analíticas |
| `/analiticas/exportar/excel` | Descarga un `.xlsx` con una hoja por sección, mismo filtro que la pantalla (query string) | Permiso "exportar" en Analíticas |
| `/analiticas/exportar/pdf` | Descarga un resumen de una página (indicadores principales, sin las tablas completas) | Permiso "exportar" en Analíticas |

Los filtros viajan en la URL (`searchParams`) para que los links de exportación lleven el mismo filtro que está viendo el dueño en pantalla, sin un formulario aparte.

## 6. Excel — hojas del workbook (ExcelJS, ya una dependencia del proyecto desde la spec 004)

"Resumen", "Ventas por empleado", "Ventas por turno", "Ventas por canal", "Productos más vendidos", "Productos sin movimiento", y "Diferencias de caja" siempre. Solo si quien exporta tiene el permiso especial: "Márgenes" (total), "Margen por producto", "Margen por marca", "Margen por rubro" y "Valorización de stock".

## 7. PDF — resumen de una página (`@react-pdf/renderer`, dependencia nueva)

Encabezado con el rango de fechas, los indicadores de RF-2 (total, cantidad, ticket promedio, comparación), el top 5 de productos más vendidos, el margen total si corresponde, y el total de diferencias de caja. No repite las tablas completas (eso es lo que tiene el Excel).

## 8. Permisos

| Acción | Quién puede |
|---|---|
| Ver `/analiticas` (sin margen ni valorización) | Permiso "ver" en Analíticas |
| Ver margen y valorización dentro de `/analiticas` | Permiso "ver" en Analíticas + permiso especial "ver costos y márgenes" |
| Exportar (Excel o PDF) | Permiso "exportar" en Analíticas (el margen/valorización solo se incluye si además tiene el permiso especial) |

## 9. Pruebas

- **Unitarias**: todas las funciones de `src/lib/analytics.ts` — `toTucumanDateKey` puntualmente con una fecha que cruza medianoche en UTC pero no en Tucumán (y viceversa), `computePreviousPeriod` con rangos de distinto largo, `computeTicketPromedio`/`computeMarginSummary` con conteos/totales en cero.
- **E2E**: diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas").

## 10. Riesgos y decisiones

- **`SaleItem`, no `Sale`, como unidad base de las métricas de ingresos** — es lo único que permite que un filtro de producto/marca/rubro dé un total correcto (sección 2).
- **La valorización de stock no respeta el filtro de fechas** — es una foto del stock actual, no hay con qué reconstruir el stock a una fecha pasada sin agregar algo nuevo (fuera de alcance).
- **Se agrega `@react-pdf/renderer`** como dependencia nueva para el PDF — se valida en la implementación que sea compatible con React 19 (el proyecto ya está en esa versión); si no lo es, se reconsidera por `pdf-lib` (más manual, sin esa dependencia de React).
- **Pago dividido cuenta en los dos medios de pago al filtrar** — no se prorratea el monto entre efectivo y transferencia; decisión por simplicidad, documentada en `spec.md` y acá.
- **El canal no se normaliza** (mayúsculas, espacios) — es texto libre desde la spec 009; si en el uso real esto ensucia demasiado el agrupado, se evalúa una spec de normalización aparte.
