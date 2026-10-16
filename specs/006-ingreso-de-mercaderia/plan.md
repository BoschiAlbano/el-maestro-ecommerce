# Plan 006 — Ingreso de mercadería

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`StockEntry`**: `id`, `supplierName` (`String?`, texto libre), `userId` (FK `User`, quien lo registró), `createdAt`. Sin un campo de fecha editable aparte: `createdAt` es "la fecha" del ingreso (spec.md, RF-1) — simplificación consciente, igual criterio que `AuditLog`/`ProductPriceHistory` (la fecha es cuándo se hizo la acción, no un dato de negocio que se pueda retocar).
- **`StockEntryItem`**: `id`, `stockEntryId` (FK `StockEntry`, `onDelete: Cascade`), `productId` (FK `Product`), `quantity` (`Int`, positivo), `purchasePrice` (`Decimal(12,2)`, el precio unitario pagado en ese ítem — mismo tipo que `Product.purchasePrice`, constitución regla 6), `salePrice` (`Decimal(12,2)?`, opcional — agregado el 2026-10-16 a pedido del cliente: si se carga, también actualiza `Product.salePrice` al confirmar).
- `Product` recibe la relación inversa `stockEntryItems StockEntryItem[]` (mismo criterio que `priceHistory`/`stockMovements`).
- No hay un enum nuevo: el tipo de movimiento de stock que generan los ítems ya existe (`StockMovementType.INGRESO`, spec 005).

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/ingresos` | Historial de ingresos | Permiso "ver" en Ingreso de mercadería |
| `/ingresos/nuevo` | Carga de un ingreso (proveedor + lista de ítems) | Permiso "crear" en Ingreso de mercadería + permiso especial "cambiar precios" |
| `/ingresos/[id]` | Detalle de un ingreso (sus ítems) | Permiso "ver" en Ingreso de mercadería |

## 3. Lógica de servidor

- `src/app/(app)/ingresos/actions.ts`: `createStockEntry(items, supplierName)` — recibe los ítems ya armados del lado del cliente como argumento serializable (no un `FormData` con una lista dinámica codificada a mano — mismo criterio que `confirmImport`/`confirmCount`, más simple que inventar una convención de nombres `productId_0`, `productId_1`, etc.).
  - Exige permiso "crear" en Ingreso de mercadería **y** el permiso especial "cambiar precios"; si falta el segundo, se rechaza entero — a diferencia de editar un producto (spec 004), acá no hay "la otra mitad" del ingreso para guardar sin precio, porque el ingreso completo gira alrededor de actualizar el costo.
  - Valida cada ítem (producto exista, cantidad entera positiva, precio no negativo) antes de escribir nada.
  - En **una sola transacción** (constitución, integridad de datos): crea el `StockEntry`, y por cada ítem, en el orden en que llegó: crea el `StockEntryItem`, llama `registerStockMovement(tx, { productId, type: "INGRESO", quantity, userId })` (spec 005), y si el precio de compra del ítem difiere del `purchasePrice` actual del producto **o** trae un precio de venta distinto del `salePrice` actual, actualiza `Product` (ambos campos) e inserta una fila en `ProductPriceHistory` con los dos precios vigentes (mismo criterio que `updateProduct`, spec 004). Si el ítem no trae precio de venta, se usa el vigente sin cambiarlo. Si el mismo producto aparece en dos ítems del mismo ingreso, el último ítem procesado es el que queda como precio final (`spec.md`, sección 7) — no hay nada especial que lo evite, es simplemente el orden normal de la transacción.

## 4. Componentes

- `StockEntryForm` (cliente): estado local con la lista de ítems (agregar/quitar fila; cada fila con un `Select` de producto activo, cantidad y precio), un campo de proveedor (texto libre, opcional), y un botón "Confirmar ingreso" que llama a `createStockEntry` directo (sin pasar por un `<form action>`, igual que `ImportWizard`/`CountWizard`).
- `StockEntryList` / tabla de detalle: reutiliza `Table` de siempre, nada nuevo.

## 5. Permisos

Primer uso real del módulo `INGRESO_MERCADERIA` de la matriz (existe desde la spec 002, sin nada que lo ejerciera). Reutiliza el permiso especial "cambiar precios" ya probado en la spec 004, ahora desde un segundo punto de entrada — hay que acordarse de exigirlo acá también, no solo en `productos/actions.ts`.

## 6. Pruebas

- **Unitarias:** no hay lógica pura nueva que amerite su propio módulo testeable — `createStockEntry` es sobre todo orquestación de Prisma (validación con Zod, transacción) sin un cálculo equivalente al de `computeCountAdjustments` o `generateBarcode`. La pieza con lógica real (`registerStockMovement`) ya tiene sus tests desde la spec 005.
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas"). Verificación de los criterios de aceptación por revisión manual mientras tanto.

## 7. Riesgos y decisiones

- **Selector de producto como `<Select>` simple, sin búsqueda.** Con ~200 productos activos, un desplegable largo no es ideal, pero es consistente con el resto de la app (los selectores de marca/rubro tienen el mismo problema a menor escala) y no se justifica construir un combobox con búsqueda solo para esta pantalla. Si se vuelve un problema real de uso, se revisita como una mejora transversal (afectaría también `/productos` y otras pantallas), no un parche puntual acá.
- **Ítems del ingreso como argumento directo a la Server Action, no `FormData`.** Evita inventar una convención de campos indexados (`productId_0`, `cantidad_0`, ...) para una lista de largo variable; React Server Actions aceptan cualquier argumento serializable cuando se llaman como función desde el cliente, no solo `FormData` de un `<form>`.
- **Sin fecha editable en el ingreso.** `createdAt` es la fecha; si el dueño carga una compra unos días después de recibirla, el ingreso queda fechado el día que lo cargó, no el día real de la compra. Aceptado como simplificación — corregirlo requeriría un campo de fecha de negocio separado de `createdAt`, que no se pidió.
- **Bug real, encontrado probando esta pantalla a mano, que resultó estar en TODA la app desde la spec 002: el `<Select>` (Base UI) muestra el valor crudo en vez de la etiqueta cuando no se le pasa el prop `items`.** Al armar el selector de producto de esta spec con un valor controlado, el trigger mostraba literalmente el id (o el sentinela `__unselected__`) en vez del nombre — Base UI's `Select.Value` solo resuelve la etiqueta del ítem elegido si `Select.Root` recibe `items={...}` (un mapa valor→etiqueta); sin eso, siempre muestra el valor crudo, esté montado o no el contenido del desplegable. Se probó manualmente en el navegador y se confirmó que el mismo problema ya existía, sin que nadie lo hubiera notado, en: marca/rubro de `/productos/nuevo` y `/productos/[id]` (spec 004), los filtros de marca/rubro de `/productos` (spec 004), el "Subrubro de" de `/rubros` (spec 004), el rol de `/usuarios/nuevo` y `/usuarios/[id]` (spec 002), y los filtros de usuario/acción de `/configuracion/auditoria` (spec 003) — en todos esos casos, el desplegable mostraba un UUID (o el nombre técnico de la acción) en vez del nombre legible, tanto al editar un valor ya guardado como al elegir uno nuevo en la sesión. Se corrigió agregando `items` a cada uno de esos `<Select>`, y se verificó a mano en el navegador (no es parte del alcance de esta spec, pero el bug era lo bastante extendido como para no dejarlo para después). **Lección para specs futuras:** cualquier `<Select>` nuevo cuyo `value` no sea exactamente igual a lo que tiene que mostrarse (es decir, casi siempre) necesita `items={{ valor: "Etiqueta", ... }}` en el `<Select>`, o el trigger va a mostrar el valor crudo.
- **Precio de venta opcional por ítem (2026-10-16).** `createStockEntry` ahora recibe `salePrice?: number` por ítem; si viene, entra en la misma comparación/transacción que el precio de compra (una sola fila de `ProductPriceHistory` por ítem con los dos precios vigentes, no dos filas separadas). `StockEntryItem.salePrice` queda `null` cuando no se cargó, para que el detalle del ingreso pueda mostrar "—" en vez de confundirlo con "se puso en cero".
- **El detalle de un ingreso (`/ingresos/[id]`) oculta el precio de compra sin el permiso especial "ver costos y márgenes".** Se notó al agregar el precio de venta a la pantalla: el precio de compra ya se mostraba sin ese chequeo, lo cual no es coherente con la constitución (regla 17) ni con el criterio ya usado en el catálogo (spec 004) y en `/inventario`. El precio de venta se sigue mostrando siempre (no es un dato de costo).
