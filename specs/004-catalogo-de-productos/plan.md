# Plan 004 — Catálogo de productos

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`Brand`**: `id`, `name` (único). Opcional en `Product` (`brandId` nullable) — no todos los productos tienen una marca clara que valga la pena categorizar.
- **`Rubro`**: `id`, `name`, `parentId` (relación a sí mismo, nullable — `null` = rubro de primer nivel, con valor = subrubro). `@@unique([name, parentId])`: el mismo nombre de subrubro puede existir bajo rubros padre distintos. La profundidad de 2 niveles (rubro → subrubro, nunca subrubro de subrubro) se controla en la Server Action, no en el schema.
- **`Product`**: `name`, `brandId?`, `rubroId` (obligatorio — todo producto se clasifica), `barcode` (único, siempre tiene valor — generado o de origen), `barcodeIsGenerated` (bool, para distinguirlo en la interfaz), `photoUrl?` (URL de Supabase Storage), `purchasePrice`/`salePrice` (`Decimal(12,2)`, nunca `Float` — constitución regla 6), `minStock` (Int, se completa con `Setting.stockMinimoDefault` si no se especifica al crear), `active` (default `true`).
- **`ProductPriceHistory`**: `productId`, `purchasePrice`, `salePrice` (los dos valores vigentes en ese momento, no solo el que cambió — más simple de leer), `changedByUserId` (FK a `User`), `createdAt`. Se inserta una fila cada vez que se guarda un producto con `purchasePrice` o `salePrice` distinto al anterior.

No hay campo de stock en `Product` (constitución regla 7 y `spec.md` sección 5): las cantidades son de la spec 005.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/productos` | Lista, búsqueda y filtros | Permiso "ver" en Catálogo |
| `/productos/nuevo` | Alta de producto | Permiso "crear" en Catálogo |
| `/productos/[id]` | Edición, historial de precio, activar/desactivar | Permiso "editar"/"anular" en Catálogo |
| `/productos/importar` | Importación masiva (subir, previsualizar errores, confirmar) | Permiso "crear" en Catálogo |
| `/productos/etiquetas` | Elegir productos e imprimir etiquetas | Permiso "exportar" en Catálogo |
| `/marcas` | Lista y alta/edición de marcas | Permiso "editar" en Catálogo |
| `/rubros` | Lista y alta/edición de rubros y subrubros | Permiso "editar" en Catálogo |

## 3. Lógica de servidor

- `src/lib/barcode.ts`: `generateBarcode(tx)` — EAN-13 con prefijo `20`-`29` (rango GS1 de uso interno), 10 dígitos secuenciales/aleatorios + dígito verificador (algoritmo estándar mod-10 con pesos 1-3). Reintenta con otro código si choca contra uno existente (`spec.md`, sección 7).
- `src/app/(app)/productos/actions.ts`: `createProduct` (genera código si no viene, usa `Setting.stockMinimoDefault` si no se especifica `minStock`), `updateProduct` (compara precios viejos vs. nuevos; si cambian, inserta `ProductPriceHistory` en la misma transacción), `setProductActive`.
- `src/app/(app)/marcas/actions.ts` y `.../rubros/actions.ts`: CRUD con el mismo criterio de borrado que los roles (spec 002): bloqueado si tiene productos (o, para rubros, si tiene subrubros) asociados.
- `src/app/(app)/productos/importar/actions.ts`: `previewImport` (parsea el archivo, devuelve filas válidas/inválidas con el motivo de cada error, no escribe nada) y `confirmImport` (crea los productos válidos en una sola operación). Columnas de la plantilla: nombre, marca, rubro, subrubro, código de barras (opcional), precio de compra, precio de venta, stock mínimo (opcional). **Sin columna de cantidad de stock** — eso es la spec 005.
- Fotos: bucket de Supabase Storage `product-photos`, creado una sola vez con un script usando `createAdminClient()` (no hay forma de crearlo por SQL/Prisma). Subida desde una Server Action que valida tipo (`image/jpeg`, `image/png`, `image/webp`) y tamaño antes de subir.

## 4. Componentes

- `ProductTable` (con precio de compra/margen ocultos si falta `verCostosMargenes`), `ProductForm`, `BrandSelect`/`RubroSelect` (rubro con desplegable dependiente de subrubro), `PriceHistoryTable`, `ImportWizard` (subir → previsualizar errores → confirmar, tres pasos), `LabelSheet` (hoja A4 imprimible, CSS de impresión, sin librería de PDF — usa la impresión del navegador, mismo criterio que el ticket de 58 mm).

## 5. Permisos

Primer uso real de la fila "Catálogo" de la matriz (ya existía desde la spec 002, sin nada que la ejerciera) y de la primera verificación real de `verCostosMargenes` en una pantalla con datos de verdad. Todo componente que muestre `purchasePrice` o un margen calculado lo hace condicionalmente, nunca lo manda al cliente si no corresponde (ni siquiera oculto por CSS — si no tiene permiso, el Server Component no incluye el dato en el HTML/RSC payload).

## 6. Pruebas

- Unitarias (Vitest): el algoritmo de `generateBarcode` (dígito verificador correcto, prefijo en rango 20-29, longitud 13); el parser de la planilla de importación (filas válidas e inválidas, mensajes de error esperados).
- E2E (Playwright): crear un producto (con y sin código de barras propio); buscar/filtrar; importar una planilla con filas mezcladas y confirmar que señala los errores antes de guardar nada; cambiar un precio y verlo en el historial; desactivar un producto; un usuario sin "ver costos y márgenes" no ve el precio de compra; imprimir una etiqueta.

## 7. Riesgos y decisiones

- **Librería para leer Excel/CSV:** a confirmar en la tarea de importación — `exceljs` puede leer tanto `.xlsx` como `.csv` con una sola dependencia (a verificar); si no, se suma `papaparse` solo para CSV.
- **Marca opcional, rubro obligatorio.** Decisión propia (no estaba explícito en `docs/PROJECT.md`): forzar marca en todos los productos agrega fricción sin necesidad real; el rubro sí, porque hacen falta reportes y filtros por rubro más adelante (spec 011).
- **Bucket de Supabase Storage creado por script, no por Prisma.** Storage no es parte del esquema de Postgres que maneja Prisma — se crea una vez con la API admin de Supabase. Documentar el paso exacto cuando se implemente, para que quede reproducible si hace falta recrear el proyecto.
- **Precios con 2 decimales en la base** (`Decimal(12,2)`), aunque los montos *calculados* (totales de venta, vuelto) se redondean al peso entero (constitución, regla 6) — la regla de redondeo aplica a cálculos, no obliga a que el precio cargado a mano sea un entero.
- **Bug real con el valor sentinela `"__none__"` del `Select` de marca.** El formulario usa `"__none__"` para "sin marca" (Radix/Base UI no permite `value=""`), pero la Server Action lo recibía tal cual y lo mandaba como `brandId` a Prisma — rompía con `Foreign key constraint violated` porque `"__none__"` no es un id real. Mismo tipo de bug que el de `parentId` en rubros; esta vez lo encontró el primer test E2E de creación de producto, no la revisión de código. Al usar un valor sentinela en un `Select` opcional, siempre traducirlo a `undefined`/`null` en el parseo del lado del servidor, nunca asumir que "está vacío" se refleja como string vacío.
- **No se borra la foto vieja de Storage al subir una nueva.** Simplificación consciente: el costo de almacenamiento de fotos huérfanas es bajo para ~200 productos, y borrar requiere guardar el path interno (no solo la URL pública) para poder referenciarlo después. Si se vuelve un problema real, se agrega un `storagePath` al modelo y se borra el archivo viejo en `updateProduct`.
- **`@@unique([name, parentId])` en `Rubro` no evita rubros de primer nivel duplicados.** Postgres no considera dos `NULL` "iguales" para un `UNIQUE constraint`, así que esa restricción solo protege subrubros de verdad (donde `parentId` siempre tiene un valor real) — dos rubros de primer nivel con el mismo nombre pasarían sin error. Se descubrió al tipar el `upsert` por la clave compuesta: Prisma ni siquiera deja pasar `parentId: null` ahí (el tipo generado para la clave compuesta es `string`, no `string | null`), señal de que la propia herramienta sabe que esa combinación no es una forma válida de buscar por unicidad. Se corrigió a mano con un `findFirst`/`findUnique` + `create` explícito, tanto en `rubros/actions.ts` (alta y edición) como en la importación. No se agregó un índice único parcial (`WHERE "parentId" IS NULL`) a nivel SQL por ahora — la protección queda a nivel aplicación, aceptable para una herramienta interna sin acceso directo a la base fuera de la app.
- **Librería de Excel/CSV: `exceljs` solo, confirmado.** Lee ambos formatos con una sola dependencia, como estaba previsto. Los tipos de su API para `.xlsx.load()` no coinciden exactamente con `@types/node@24` (son la misma clase `Buffer` en runtime, pero distinta forma de tipos) — se usó un `as any` puntual y comentado, no una tipificación floja general.
- **Bug real: un usuario sin "cambiar precios" veía la advertencia de precio en cada guardado, aunque nunca tocara el precio.** `purchasePrice`/`salePrice` se deshabilitan en el formulario para quien no tiene ese permiso especial (specs/004, sección 7) — y un `<input disabled>` no viaja en el `FormData` al enviar el formulario. Como el esquema los pedía obligatorios con `z.coerce.number()`, el campo ausente (`null`) se convertía en `0` (`Number(null) === 0`), y `updateProduct` comparaba ese `0` contra el precio existente, creyendo (equivocadamente) que habían intentado poner el precio en cero — mostraba la advertencia de "no tenés permiso para cambiar el precio" en cualquier edición, no solo cuando correspondía. El resultado final seguía siendo seguro (el precio nunca se tocaba), pero el aviso era ruido en cada guardado. Encontrado al escribir el primer test E2E real de este permiso (T-011), no por revisión de código. Se corrigió haciendo `purchasePrice`/`salePrice` opcionales en el esquema y tratando "ausente" distinto de "0": `updateProduct` ahora solo considera que *intentaron* cambiar el precio si ambos campos llegaron de verdad. `createProduct` sigue exigiéndolos (ya exige el permiso especial antes de llegar a parsear, así que siempre están presentes ahí). Se agregó un test E2E que fuerza el campo deshabilitado desde JS (`el.disabled = false`) para confirmar que, si alguien se saltea la interfaz, el servidor sigue bloqueando el cambio de precio igual.
