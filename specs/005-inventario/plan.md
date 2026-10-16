# Plan 005 — Inventario

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`Product.currentStock`** (`Int`, default `0`): se agrega al modelo existente. Es un valor cacheado, no calculado al vuelo con un `SUM` — se actualiza siempre dentro de la misma transacción que crea el movimiento que lo cambia, nunca por separado (ver sección 7). Sin restricción `>= 0` a nivel de base: el negativo está permitido (`spec.md`, sección 5 y 7).
- **`StockMovementType`** (enum): `INGRESO`, `VENTA`, `AJUSTE`, `MERMA`. Dos tipos separados para ajuste y merma (no uno solo) pensando en la spec 011, que va a querer reportar mermas aparte de ajustes comunes — comparten la misma pantalla igual (sección 4).
- **`StockMovement`**: `id`, `productId` (FK `Product`), `type` (`StockMovementType`), `quantity` (`Int`, con signo: positivo suma, negativo resta — no una cantidad siempre positiva con un campo de dirección aparte), `reason` (`String?`, obligatorio en la Server Action para `AJUSTE`/`MERMA`, no para `INGRESO`/`VENTA` que van a traer su propio contexto desde las specs 006/008), `userId` (FK `User`, quién lo generó), `createdAt`. Sin `sourceType`/`sourceId` todavía — se agrega cuando las specs 006/008 necesiten enlazar un movimiento a su ingreso o venta de origen; no inventar ese campo ahora sin un consumidor real.
- No se agrega una tabla de auditoría aparte para los movimientos: `StockMovement` ya es en sí mismo el registro de quién/cuándo/por qué cambió el stock (mismo criterio que `ProductPriceHistory` en la spec 004 — ver plan 004, sección 7).

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/inventario` | Stock actual por producto, aviso de bajo stock | Permiso "ver" en Inventario |
| `/inventario/[productId]` | Historial de movimientos del producto + ajuste manual puntual | Ver: permiso "ver". Ajustar: "editar" + permiso especial "ajustar stock" |
| `/inventario/conteo` | Conteo físico: cantidades editables → previsualizar diferencias → confirmar | Permiso "editar" en Inventario + permiso especial "ajustar stock" |

## 3. Lógica de servidor

- `src/lib/stock.ts`: `registerStockMovement(tx, { productId, type, quantity, reason, userId })` — crea la fila en `StockMovement` y actualiza `Product.currentStock` (`increment`/`decrement` según el signo de `quantity`) en la misma transacción `tx`. Es la única forma de cambiar `currentStock` en todo el código; las specs 006 y 008 la importan en vez de escribir su propia lógica (RF-6).
- `src/lib/stock-count.ts`: `computeCountAdjustments(products, countedByProductId)` — función **pura** (sin Prisma, testeable con Vitest) que compara el stock registrado contra lo contado y devuelve solo las diferencias (producto, cantidad registrada, cantidad contada, delta). Si `countedByProductId` no tiene un producto o el valor coincide con el registrado, no aparece en el resultado.
- `src/app/(app)/inventario/actions.ts`:
  - `adjustStock(productId, { type: "AJUSTE" | "MERMA", quantity, reason })` — exige permiso "editar" en Inventario + especial "ajustar stock"; motivo obligatorio; llama `registerStockMovement` dentro de una transacción.
- `src/app/(app)/inventario/conteo/actions.ts`:
  - `previewCount(formData)` — solo lectura: parsea las cantidades contadas del formulario, llama `computeCountAdjustments`, devuelve las diferencias. No escribe nada (mismo criterio que `previewImport` de la spec 004).
  - `confirmCount(diffs)` — recibe las diferencias ya calculadas (como argumento serializable, no releyendo el formulario — mismo patrón que `confirmImport`), exige el mismo permiso que `adjustStock`, y dentro de **una sola transacción** llama `registerStockMovement` por cada diferencia con `type: "AJUSTE"` y motivo `"Conteo físico"`.

## 4. Componentes

- `InventoryTable` (stock actual + badge de bajo stock cuando `currentStock <= minStock`, calculado en JS después de traer los productos — sin índice ni consulta SQL especial, mismo criterio de escala que el resto de la app, ~200 productos sin paginación).
- `StockMovementHistory` (tabla de movimientos de un producto: tipo, cantidad, motivo, usuario, fecha).
- `AdjustStockForm` (select Ajuste/Merma, cantidad, motivo — Merma siempre resta, Ajuste puede sumar o restar).
- `PhysicalCountForm` (lista editable con un casillero de cantidad contada por producto, prellenado con el stock registrado — así solo hay que tocar los que cambiaron) + `CountDiffPreview` (tabla de diferencias antes de confirmar, mismo wizard de dos pasos que la importación de productos).

## 5. Permisos

Primer uso real del módulo `INVENTARIO` de la matriz (existe desde la spec 002, sin nada que lo ejerciera) y del permiso especial "ajustar stock" (idem, existe desde la spec 002). Mismo patrón que "cambiar precios" en la spec 004: el permiso de módulo ("editar") habilita la pantalla, el permiso especial habilita la acción sensible encima.

## 6. Pruebas

- **Unitarias (Vitest):** `registerStockMovement` (incrementa/decrementa `currentStock` según el signo, permite negativo); `computeCountAdjustments` (solo devuelve diferencias reales, ignora productos sin cambio, maneja productos no contados).
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas"). Verificación de los criterios de aceptación por revisión manual mientras tanto.

## 7. Riesgos y decisiones

- **`currentStock` cacheado, no calculado al vuelo.** Se evaluó calcular el stock sumando `StockMovement` cada vez (`SUM` agrupado por producto) en lugar de cachear un campo en `Product`. Se descartó: la pantalla de inventario y la alerta de bajo stock se consultan seguido, y con el tiempo cada producto puede acumular muchos movimientos (conteos periódicos, cada venta futura); un campo cacheado que se actualiza atómicamente en la misma transacción que el movimiento (vía `registerStockMovement`) es más simple de leer y no tiene riesgo de desincronizarse si siempre se escribe por ese único camino.
- **Ajuste y merma comparten pantalla y Server Action**, aunque son tipos distintos en el esquema. Evita duplicar un formulario casi idéntico; si la spec 011 necesita distinguirlos en reportes, ya están separados en `StockMovementType`.
- **Sin `sourceType`/`sourceId` en `StockMovement` todavía.** Se va a necesitar cuando las specs 006/008 generen movimientos de tipo `INGRESO`/`VENTA` y quieran enlazarlos a su ingreso/venta de origen (para, por ejemplo, poder anular una venta y revertir su movimiento). No se agrega ahora sin un consumidor real — se agrega en la spec que lo necesite, como una migración aditiva.
- **Conteo físico sin bloqueo de concurrencia.** Si dos personas confirman un conteo casi al mismo tiempo, el último pisa el ajuste del anterior (aceptado en `spec.md`, sección 7, dado un solo puesto y dos empleados). No se agrega un mecanismo de bloqueo optimista en esta spec.
- **`confirmCount` no confía en el delta calculado en `previewCount`.** Recibe las diferencias ya calculadas como argumento (mismo patrón que `confirmImport` de la spec 004), pero dentro de la transacción vuelve a leer el stock actual de cada producto y recalcula el delta contra la cantidad contada, no contra el delta viejo. Si se confiara en el delta de la previsualización y el stock cambiara entre medio (otro ajuste, en el futuro una venta), el resultado final quedaría mal — lo que importa en un conteo físico es a qué cantidad contada se quiere llegar, no un delta fijo. Si para ese momento el stock ya coincide con lo contado, no genera movimiento.
- **Evitado a propósito: el mismo bug del campo ausente de la spec 004.** El formulario de ajuste oculta el selector de "dirección" cuando el tipo es Merma (siempre resta), así que ese campo no viaja en el `FormData`. Se hizo `direction` opcional en el esquema de Zod y se convirtió el `null` ausente a `undefined` antes de parsear — el mismo tipo de bug que hizo que un usuario sin "cambiar precios" viera una advertencia falsa en la spec 004 (ver plan 004, sección 7), esta vez detectado al escribir el código, no por un test.
