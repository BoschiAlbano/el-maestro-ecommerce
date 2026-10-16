# Tareas 004 — Catálogo de productos

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `Brand`, `Rubro` (con subrubros), `Product`, `ProductPriceHistory`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/lib/barcode.ts` (`generateBarcode`) con pruebas unitarias.
  - Hecho cuando: los tests cubren dígito verificador correcto, prefijo 20-29, longitud 13, y que reintenta ante una colisión. — Los tests encontraron un bug real (generaba 11 dígitos en vez de 12 antes del verificador, por un loop de 9 en vez de 10). 8 casos, incluye el ejemplo real de un EAN-13 conocido (Kinder Chocolate) para el cálculo del verificador.
- [x] **T-003** CRUD de marcas (`/marcas`).
  - Hecho cuando: se puede crear, editar y borrar una marca; no se puede borrar una con productos asociados. — Una sola pantalla (alta + lista con edición/borrado inline), más liviano que 3 páginas separadas para una entidad de un solo campo.
- [x] **T-004** CRUD de rubros y subrubros (`/rubros`).
  - Hecho cuando: se puede crear un rubro, crear un subrubro debajo de uno de primer nivel, y no se puede crear un tercer nivel ni borrar uno con productos o subrubros.
- [x] **T-005** CRUD de productos (`/productos`, `/productos/nuevo`, `/productos/[id]`) con historial de precio.
  - Hecho cuando: se puede crear/editar/desactivar un producto; cambiar el precio genera una fila en `ProductPriceHistory`; un usuario sin "ver costos y márgenes" no ve precio de compra ni margen en ningún lado. — Implementado también el matiz del permiso especial "cambiar precios" (separado de "editar"): si falta, se guarda el resto del formulario y el precio queda como estaba, con un aviso. Un test E2E encontró un bug real (`brandId` con el valor sentinela `"__none__"` sin traducir, ver riesgo en `plan.md`), ya arreglado.
- [x] **T-006** Búsqueda y filtros en `/productos` (nombre, código, marca, rubro).
  - Hecho cuando: cada filtro (solo y combinado) devuelve los resultados esperados. — Filtros por formulario `GET` (searchParams), mismo patrón que la auditoría de la spec 003. Probado con E2E real: búsqueda por nombre y filtro por rubro, cada uno aislando correctamente los resultados.
- [x] **T-007** Fotos de producto (bucket de Supabase Storage + subida).
  - Hecho cuando: se puede subir una foto al crear/editar un producto, y queda visible en la ficha. — Bucket creado con `pnpm setup:storage` (script reproducible, `scripts/setup-storage.ts`), público de solo lectura. Validación de tipo (JPG/PNG/WEBP) y tamaño (5 MB) antes de subir. No se borra la foto vieja al subir una nueva (simplificación aceptada, ver riesgo en `plan.md`). Probado con E2E real subiendo un archivo.
- [x] **T-008** Importación masiva (`/productos/importar`): plantilla, previsualización de errores, confirmación.
  - Hecho cuando: una planilla con filas válidas e inválidas mezcladas señala las inválidas (y por qué) antes de guardar nada; al confirmar, solo se crean las válidas. — `exceljs` lee `.xlsx` y `.csv` con una sola librería. Marca y rubro/subrubro se crean solos si no existen (necesario para una carga inicial de ~200 productos sin tener que precrear todo a mano). Encontrado y corregido un problema real de fondo: `@@unique([name, parentId])` no protege rubros de primer nivel porque Postgres no compara NULL=NULL (ver riesgo en `plan.md`) — se corrigió con `findFirst`/`findUnique` explícito en vez de `upsert` por la clave compuesta, tanto acá como en `/rubros`. El primer test E2E con un fixture estático dejó datos duplicados al correrlo dos veces — se pasó a generar el CSV con un sufijo único por corrida, en memoria (`setInputFiles({ buffer })`), en vez de un archivo fijo en disco.
- [x] **T-009** Etiquetas imprimibles (`/productos/etiquetas`).
  - Hecho cuando: se puede elegir uno o más productos y se genera una hoja A4 imprimible con código de barras, nombre y precio de cada uno. — Se eligió dibujar el código de barras de verdad (no solo los dígitos) con `jsbarcode` en el cliente (EAN-13 para los de 13 dígitos, UPC para 12, CODE128 como repliegue para cualquier otro largo — por si el producto trae un código de origen que no es EAN-13), porque la etiqueta tiene que poder leerse con un lector en el futuro (spec 008). Impresión por CSS de navegador (`window.print()` + clase `print:hidden`), sin librería de PDF, mismo criterio que se dejó pendiente para el ticket de 58mm. Probado con E2E real verificando que el SVG del código se dibuja.
- [x] **T-010** Navegación: agregar "Productos" (y accesos a marcas/rubros/importar/etiquetas desde ahí), visible según permiso en Catálogo.
  - Hecho cuando: un usuario sin permiso "ver" en Catálogo no ve la entrada. — Mismo patrón que "Configuración" (`requiresPermission`, no `ownerOnly`). Marcas/Rubros/Importar/Etiquetas quedan como botones dentro de `/productos`, no como entradas de nav aparte.
- [x] **T-011** Pruebas E2E del flujo completo.
  - Hecho cuando: Playwright cubre alta de producto (con y sin código propio), búsqueda/filtros, importación con errores, cambio de precio reflejado en el historial, desactivación, ocultamiento de costos sin permiso, e impresión de etiqueta. — 9 tests en `productos.spec.ts`, los 15 de la suite completa pasan. Se encontró y corrigió una suposición incorrecta en el test de historial de precios: `updateProduct` redirige a `/productos` al guardar (no se queda en la ficha), así que había que volver a navegar a la URL del producto después de editar.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [x] Pruebas E2E. — Hechas en su momento (`pnpm test:e2e`, 17 tests), antes de la decisión de diferir el E2E a una pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] Los criterios de aceptación de las specs 001-003 siguen cumpliéndose (la suite completa incluye los tests de esas specs; los 17 tests E2E y los 33 unitarios pasan).
- [x] `docs/PROJECT.md` actualizado (estado de la spec).

**Nota post-cierre (2026-10-15, durante la spec 006):** se encontró y corrigió un bug real en los `<Select>` de marca/rubro de esta spec (`/productos/nuevo`, `/productos/[id]`, los filtros de `/productos`, y el "Subrubro de" de `/rubros`) — mostraban el id crudo en vez del nombre porque les faltaba el prop `items` de Base UI. Ver el detalle completo en `specs/006-ingreso-de-mercaderia/plan.md`, sección 7.

**Nota post-cierre (2026-10-16, pedido del cliente tras revisar las specs 005/006):** el alta de producto (`/productos/nuevo`) ahora permite crear una marca o un rubro nuevo sin salir del formulario ("+ Crear nueva marca"/"+ Crear nuevo rubro" dentro del mismo `<Select>`, con un `quickCreateBrand`/`quickCreateRubro` que crea y selecciona de una) y tiene un campo opcional de stock inicial (ver `specs/005-inventario/spec.md`, sección 10, para el detalle de stock). El rubro nuevo queda siempre de primer nivel; para un subrubro hay que seguir usando `/rubros`.
