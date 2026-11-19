# Plan 020 — Vincular y administrar publicaciones de Mercado Libre

> Cómo se construye lo que dice `spec.md`: un campo SKU en el producto, una tabla que une cada publicación con su producto, un solo precio que viaja en los dos sentidos y las acciones de estado. Se apoya en lo que dejó la spec 019: `mlFetch`, la cola de avisos con su registro `handlers.ts` y la pasada diaria.

## 0. Prueba técnica

Hecha el 2026-11-16 con la publicación de prueba; el detalle está en `prueba-tecnica.md`. Lo que define de este plan:

1. **Precio, SKU y estado se escriben con `PUT /items/{id}`**, en una sola llamada si hace falta, y Mercado Libre responde con la publicación ya cambiada. Mandar solo `SELLER_SKU` en `attributes` no borra las otras características.
2. **La búsqueda por SKU de Mercado Libre no sirve para proponer vínculos:** solo encuentra el SKU exacto, distingue mayúsculas y tarda en ver un cambio. Se traen todas las publicaciones y se compara en el sistema (sección 3.3).
3. **Los avisos no dicen qué cambió, no son uno por cambio y también llegan por los cambios del propio sistema.** Un cambio de precio hecho en la web llegó solo como tema `items`. Por eso hay una sola función que, ante `items` o `items_prices`, lee la publicación y la compara con lo guardado (sección 3.5).
4. **Finalizar no se probó** (irreversible). Se sigue la documentación: `{ status: "closed" }`.
5. **Variantes y catálogo no se pudieron ver.** Las variantes se detectan por `variations` no vacío y se excluyen (spec, sección 2). Una publicación de catálogo sin variantes se trata como cualquier otra.

## 1. Modelo de datos

**`Product`, campos nuevos** (spec 004)

| Campo | Tipo | Nota |
|---|---|---|
| `sku` | `String?` | Como lo escribió el usuario, sin espacios a los costados. |
| `skuKey` | `String? @unique` | El SKU en mayúsculas. Es lo que garantiza en la base que no se repita sin distinguir mayúsculas (RF-1). Lo calcula siempre `normalizeSku`; nunca se escribe a mano. |

Se usa una columna aparte y no un índice sobre `lower(sku)` porque Prisma no representa índices con expresiones y los borraría en la próxima migración.

**`ProductPriceHistory`, cambios** (RF-15)

| Campo | Cambio |
|---|---|
| `changedByUserId` | Pasa a ser opcional: un cambio que llega de Mercado Libre no tiene usuario. |
| `source` | Nuevo, `PriceChangeSource` (`USER` o `MERCADO_LIBRE`), por defecto `USER`. Las filas existentes quedan como `USER`. |

**Tabla nueva `MercadoLibreListing` → `ml_listings`**

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `mlItemId` | `String @unique` | Por ejemplo `MLA2279211711`. |
| `productId` | `String` | Relación a `Product`. Se conserva aunque la publicación se finalice, para mostrar de qué producto era. |
| `linkedProductId` | `String? @unique` | Igual a `productId` mientras la publicación está vigente; vacío al finalizarla. Es lo que garantiza en la base «un producto, una publicación vigente» sin un índice parcial. |
| `title`, `thumbnailUrl`, `permalink`, `categoryId` | `String` / `String?` | Referencia, tomada al vincular y en cada lectura (RF-8). |
| `status` | `MlListingStatus` | `ACTIVE`, `PAUSED`, `PAUSED_NO_STOCK`, `UNDER_REVIEW`, `CLOSED` (RF-12). |
| `mlStatus`, `mlSubStatus` | `String`, `String[]` | Lo que informó Mercado Libre, sin traducir, para el motivo y para diagnosticar. |
| `statusReason` | `String?` | Motivo en español, cuando Mercado Libre la pausa, la observa o la da de baja (RF-14). |
| `lastKnownPrice` | `Decimal @db.Decimal(12, 2)` | Último precio leído o enviado. |
| `lastKnownSku` | `String?` | Último SKU leído o enviado. |
| `skuConflict` | `String?` | El SKU que llegó de Mercado Libre y no se pudo tomar (RF-3). Se muestra en la pantalla hasta que se resuelve. |
| `pricePendingSince` | `DateTime?` | Hay un precio del sistema que todavía no llegó a Mercado Libre (RF-13). |
| `pausePendingSince` | `DateTime?` | El producto se desactivó y la pausa todavía no llegó a Mercado Libre (RF-18). |
| `lastSyncError` | `String?` | Último error al enviar, para mostrarlo. |
| `lastReadAt` | `DateTime?` | Última vez que se leyó de Mercado Libre. |
| `linkedAt`, `linkedByUserId` | | Relación a `User`. |
| `closedAt` | `DateTime?` | |
| `updatedAt` | `DateTime @updatedAt` | |

Índices por `status` y por `pricePendingSince`.

**Enums nuevos:** `PriceChangeSource`, `MlListingStatus`.

**Enums que se amplían** (cada uno en su migración):

- `ModuloNegocio`: `MERCADO_LIBRE` (sección 5).
- `AuditAction`: `ML_LISTING_LINKED`, `ML_LISTING_UNLINKED`, `ML_LISTING_PAUSED`, `ML_LISTING_ACTIVATED`, `ML_LISTING_CLOSED`.
- `NotificationType`: `ML_PUBLICACION`.

**Migraciones contra la base de la nube.** Se desarrolla sobre ella (`docs/entorno-local.md`): antes de cada migración, copia con `pg_dump`.

**Reinicio del sistema (spec 017):** `ml_listings` se suma a las tablas que se vacían (sus productos se borran). Las publicaciones siguen en Mercado Libre tal como están. El aviso del reinicio lo dice. Se anota en la spec 017.

## 2. Rutas y pantallas

| Ruta | Qué es | Quién accede |
|---|---|---|
| `/publicaciones` | Pantalla "Publicaciones" (RF-10 a RF-12, RF-16, RF-17). | Permiso "ver" en Mercado Libre. |
| `/publicaciones/vincular` | Pantalla "Vincular publicaciones" (RF-4 a RF-8). | Permiso "crear" en Mercado Libre. |
| `/productos/nuevo`, `/productos/[id]` | Campo SKU en la ficha (RF-1, RF-2); en `/productos/[id]`, además, el historial de precios con origen (RF-15) y el estado de su publicación, si tiene. | Los de hoy (spec 004). |

Ítem nuevo "Mercado Libre" en la navegación, con `requiresPermission: { module: MERCADO_LIBRE, action: "ver" }`. Migas de pan para las dos rutas.

## 3. Lógica de servidor

Todo en `src/lib/mercadolibre/`, con la misma regla de la 019: la decisión es pura y con pruebas; lo que toca red o base es una capa fina.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `sku.ts` (pura) | `normalizeSku(text)`: recorta y valida el RF-1 (letras, números, `-`, `_`, `.`, `/`, de 1 a 50, sin espacios). Devuelve `{ sku, skuKey }` o el error en español. |
| `listing-status.ts` (pura) | `mapListingStatus(status, subStatus)`: estado del RF-12 y motivo en español. `paused` con `out_of_stock` → pausada sin stock; `paused_by_seller` → pausada; `under_review` → observada; `closed` → finalizada. Lo que no se conoce se muestra tal cual. |
| `listing-read.ts` (pura) | `readListing(item)`: valida con `zod` la parte de la publicación que se usa (precio, estado, SKU de `SELLER_SKU`, código universal de `GTIN`, cantidad, variantes, logística, foto, enlace) y dice si se puede vincular (sin variantes, sin Full, no finalizada). |
| `link-proposal.ts` (pura) | `proposeLinks(listings, candidates)`: propuesta por SKU, código de barras y código universal (RF-5). |
| `link-preview.ts` (pura) | `buildLinkPreview(product, listing, reserve)`: qué cambia en la publicación al vincular (RF-8). |
| `listing-reconcile.ts` (pura) | `reconcile(stored, product, read)`: qué hacer con lo que se leyó de Mercado Libre (sección 3.5). |
| `listings-api.ts` | Llamadas: traer todas las publicaciones de la cuenta, traer varias por identificador (de a 20), leer una y `updateListing(id, cambios)` con `PUT /items/{id}`. |
| `listings.ts` | Lo que toca la base: vincular, deshacer, aplicar lo leído, marcar y enviar pendientes. |
| `price-sync.ts` | `markPricePending(tx, productIds)` y `pushPendingListings()` (sección 3.4). |
| `handlers.ts` | Registra `items` e `items_prices` con la función de la sección 3.5. |

### 3.2 SKU (RF-1 a RF-3)

- **Ficha del producto** (`createProduct`, `updateProduct`): campo nuevo, pasado por `normalizeSku`. Si `skuKey` ya existe, el error es «Ya hay otro producto con ese SKU.» (y la restricción única de la base lo garantiza aunque dos personas guarden a la vez).
- **Si el producto tiene publicación vigente y el SKU cambió:** primero se envía a Mercado Libre y recién después se guarda. Si Mercado Libre no responde, no se guarda nada y se muestra el error (spec, sección 7). Si cambian también otros campos, se guardan todos juntos después del envío.
- **SKU que llega de Mercado Libre** (sección 3.5): si pasa `normalizeSku` y nadie más lo usa, se guarda en el producto. Si no, queda en `skuConflict` y el producto conserva el suyo. El conflicto se borra cuando los dos lados vuelven a coincidir.

### 3.3 Vincular (RF-4 a RF-10)

**Cargar la pantalla** (Server Component, con `requirePermission(MERCADO_LIBRE, "crear")` y conexión vigente):

1. `GET /users/{id}/items/search` con `status=active`, `paused` y `under_review`, de a 50. Las finalizadas no se piden (spec, sección 7).
2. `GET /items?ids=…` de a 20, con los atributos que usa `readListing`.
3. Se descartan las ya vinculadas. Las que tienen variantes o son de Full quedan en una sección aparte, «No se pueden vincular», con el motivo.
4. Candidatos: una sola consulta de productos activos cuyo `skuKey` o `barcode` esté entre los SKU y códigos de las publicaciones.
5. `proposeLinks`, por publicación, en este orden: SKU de la publicación contra `skuKey`; si no hay, SKU de la publicación contra el código de barras de productos sin SKU; y código universal contra código de barras. Propuesta solo si hay **un único** producto y ese producto no aparece en otra propuesta ni tiene publicación vigente (RF-5, sección 7).
6. Para cada propuesta, `buildLinkPreview`: precio de hoy → precio de venta; cantidad de hoy → `max(0, stock − reserva)` (la reserva es 0 hasta la spec 021); SKU de hoy → SKU que queda. Si el producto no tiene SKU y la publicación sí, el SKU que queda es el de la publicación y se marca que el producto lo toma.

Con más de 1000 publicaciones, la búsqueda por páginas de Mercado Libre se corta; se cambia a `search_type=scan`. Para la cuenta del cliente no hace falta (riesgo 4).

**Vincular a mano:** la publicación sin propuesta tiene un buscador de productos (nombre, código o SKU) que reusa `searchProducts` (spec 009, pedidos) sumando el SKU; al elegir uno se muestra el mismo resumen de cambios.

**Server Action `linkListings(pairs)`**, de a una o todas juntas (RF-6):

1. `requirePermission(MERCADO_LIBRE, "crear")`. Sin conexión: error de la spec 019.
2. Por cada par, por separado (que una falle no frena a las otras):
   1. Vuelve a leer la publicación y el producto: el resumen que vio el usuario puede estar viejo. Si la publicación ya está vinculada, se finalizó, tiene variantes o el producto ya tiene publicación vigente, se rechaza con el motivo.
   2. Si el producto no tiene SKU y el de la publicación ya lo usa otro producto, se rechaza: «El SKU de la publicación es de otro producto.».
   3. `PUT /items/{id}` con `price`, `available_quantity` y, si corresponde, `SELLER_SKU`. Con cantidad 0, Mercado Libre la pausa por falta de stock.
   4. Con la respuesta, en una transacción: crea la fila de `ml_listings`, guarda el SKU en el producto si lo toma y registra `ML_LISTING_LINKED`.
3. Devuelve el resultado de cada una.

Si el envío anduvo y la transacción falla, la publicación quedó con los datos del sistema pero sin vínculo. Se informa y se puede volver a vincular: el envío no cambia nada la segunda vez.

**Deshacer (RF-9), `unlinkListing(id)`:** `requirePermission(MERCADO_LIBRE, "anular")`. Borra la fila y registra `ML_LISTING_UNLINKED`. No llama a Mercado Libre. La publicación vuelve a aparecer para vincular.

**Aviso de publicaciones activas sin vincular (RF-10):** al cargar `/publicaciones`, una consulta `status=active` con `limit=50`; las que no están en `ml_listings` se cuentan y se muestra el aviso con enlace a vincular. Si Mercado Libre no responde, la pantalla carga igual sin el aviso.

### 3.4 Precio del sistema a Mercado Libre (RF-13, RF-15)

El precio en el sistema nunca espera a Mercado Libre. Funciona como una bandeja de salida:

1. **Dentro de la misma transacción que cambia el precio** — `updateProduct` (ficha) y `createStockEntry` (ingreso de mercadería, spec 006) — se llama `markPricePending(tx, productIds)`: pone `pricePendingSince = now()` en las publicaciones vigentes de esos productos. Si la transacción falla, no queda nada marcado.
2. **Después de confirmar,** `after(() => pushPendingListings({ productIds }))` intenta enviar sin demorar la respuesta.
3. `pushPendingListings`: por cada publicación con `pricePendingSince` o `pausePendingSince`, lee el producto **en ese momento** (si cambió dos veces seguidas, va el último precio) y hace `PUT /items/{id}`. Bien: borra la marca, guarda `lastKnownPrice` y la respuesta. Error: deja la marca y guarda `lastSyncError`.
4. **Reintentos:** la pasada diaria (spec 019), cada procesamiento de avisos, y el botón «Reintentar envíos» de la pantalla de publicaciones. Una publicación con marca muestra «Precio pendiente de enviar» y el error.

Cada `PUT` lleva el precio completo, no una diferencia: enviarlo dos veces no cambia nada.

**Desactivar un producto (RF-18):** `setProductActive(false)` marca `pausePendingSince` en su publicación vigente activa y la envía igual que el precio. Reactivar el producto no reactiva la publicación.

### 3.5 Lo que llega de Mercado Libre (RF-3, RF-14, RF-15)

**Una sola función para los temas `items` e `items_prices`.** Saca el identificador del recurso (`/items/{id}` o `/items/{id}/prices`). Si la publicación no está vinculada, no hace nada. Si está, la lee con `GET /items/{id}` y aplica `reconcile`:

| Qué se leyó | Qué se hace |
|---|---|
| Precio igual al de venta del producto | Nada (incluye el aviso de un cambio propio). |
| Precio distinto y **sin** precio pendiente de enviar | Se cambió en Mercado Libre: pasa a ser el precio de venta del producto, con una fila en el historial con `source = MERCADO_LIBRE` y sin usuario. El precio de compra no cambia. |
| Precio distinto **con** precio pendiente | Es el envío propio que todavía no llegó: se mantiene el del sistema y se intenta enviar. |
| SKU distinto | Sección 3.2. |
| Estado distinto del guardado | Se actualiza `status`, `mlStatus` y el motivo. Una pausa propia ya quedó guardada al hacerla, así que su aviso no encuentra diferencia. |
| Cualquier cambio de los de arriba *(cambio 2026-11-16)* | Un aviso `ML_PUBLICACION` en la campanita, con todo lo que cambió en una sola frase por publicación (RF-14). Los cambios de estado hacia o desde «pausada sin stock» no avisan: los provoca el sistema al cambiar la cantidad (spec 021). Un envío propio pendiente no avisa. |
| Finalizada | `status = CLOSED`, `closedAt` y `linkedProductId` vacío: el producto queda libre (RF-17). |

Todo en una transacción por publicación. Correr la función dos veces con el mismo aviso no duplica nada: la segunda vez no encuentra diferencias.

**«Manda el último cambio» (spec, sección 5)** queda así: el sistema siempre compara contra lo que hay en Mercado Libre **ahora**, no contra lo que dice el aviso. La única excepción es un envío propio pendiente, que gana porque es más nuevo que lo que Mercado Libre muestra.

**Pasada diaria (spec 019, `runMaintenance`):** se suman dos pasos. Primero `pushPendingListings()`. Después se leen todas las publicaciones vigentes de a 20 y se aplica `reconcile` a cada una. Cubre los avisos que se perdieron (spec, sección 7).

### 3.6 Pausar, reactivar y finalizar (RF-16, RF-17)

Server Actions `pauseListing`, `activateListing` (permiso "editar" en Mercado Libre) y `closeListing` (permiso "anular", con confirmación en la interfaz):

1. Permiso y conexión.
2. `PUT /items/{id}` con el estado nuevo. Si Mercado Libre no responde, error y no se guarda nada (spec, sección 7).
3. Con la respuesta: actualiza la fila con `reconcile` y registra la acción en la auditoría.

Reactivar una publicación con cantidad 0 la deja «pausada sin stock»: lo informa Mercado Libre y el sistema lo muestra. Reactivar una finalizada no se ofrece.

## 4. Componentes

- **`product-form.tsx`** (spec 004): campo «SKU» con ayuda corta («Letras, números y guiones. Si el producto está en Mercado Libre, se cambia también ahí.»).
- **`/productos/[id]`**: la tabla de historial muestra «Mercado Libre» cuando no hay usuario. Si el producto tiene publicación: estado, enlace y fecha de vínculo.
- **`/publicaciones`**: tabla con foto, nombre, SKU, precio, stock y estado (con el motivo), enlace a Mercado Libre y acciones según el permiso. Filtro por estado y buscador por nombre, código o SKU, en la URL como en `/productos`. Marcas «Precio pendiente de enviar» y «SKU en conflicto». Aviso de publicaciones activas sin vincular. Botón «Reintentar envíos» cuando hay pendientes. Sin conexión: el mensaje de la spec 019 con enlace a Configuración.
- **`/publicaciones/vincular`**: lista de propuestas con el resumen de cambios (precio, cantidad y SKU, de → a) y «Vincular» por fila y «Vincular todas»; lista sin propuesta con buscador de producto; lista de las que no se pueden vincular con el motivo.
- **`permission-matrix.tsx`**: fila «Mercado Libre».
- **`notification-types.ts`**: `ML_PUBLICACION`, visible con permiso "ver" en Mercado Libre, con enlace a `/publicaciones`.

## 5. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Ver publicaciones | `requirePermission(MERCADO_LIBRE, "ver")` | `/publicaciones` |
| Vincular | `requirePermission(MERCADO_LIBRE, "crear")` | `/publicaciones/vincular`, `linkListings` |
| Pausar, reactivar, reintentar envíos | `requirePermission(MERCADO_LIBRE, "editar")` | Sus acciones |
| Finalizar, deshacer el vínculo | `requirePermission(MERCADO_LIBRE, "anular")` | Sus acciones |
| Cambiar el precio | Los de hoy: `cambiarPrecios` en la ficha y en el ingreso | `updateProduct`, `createStockEntry` |
| Cambiar el SKU | `requirePermission(CATALOGO, "editar")` | `updateProduct` |
| Aviso `ML_PUBLICACION` | `hasPermission(MERCADO_LIBRE, "ver")` | `notification-types.ts` |
| Lo que llega de Mercado Libre | Sin sesión: lo procesa la cola de la 019 | `handlers.ts` |

Los roles que ya existen no tienen fila para el módulo nuevo: quedan sin permiso, salvo el Dueño, hasta que se les dé en la matriz. La semilla recorre todos los módulos, así que una instalación nueva queda completa.

## 6. Pruebas

**Unitarias (Vitest):**

- `sku`: válidos (con guiones, puntos, barras, mayúsculas y minúsculas), con espacios, vacío, largo de más; `skuKey` igual para `odoo-test-001` y `ODOO-TEST-001`.
- `link-proposal`: única por SKU; SKU contra código de barras; código universal; varias coincidencias; dos publicaciones para el mismo producto; producto ya vinculado; sin coincidencia.
- `link-preview`: precio, cantidad y SKU distintos e iguales; producto sin SKU que toma el de la publicación; stock negativo da 0.
- `listing-status`: cada estado y subestado conocido, y uno desconocido.
- `listing-read`: publicación del modelo nuevo (la de la prueba técnica), con variantes, de Full, finalizada, sin `SELLER_SKU`.
- `reconcile`: los casos de la tabla de la sección 3.5, incluido el cambio propio, el pendiente y el conflicto de SKU.
- Permisos del módulo nuevo en `permissions.test.ts`.

**Manuales, con la publicación de prueba** (se documentan en `tasks.md`):

- Cargar el SKU y vincular por propuesta; ver el resumen de cambios antes de confirmar.
- Deshacer y vincular a mano.
- Cambiar el precio desde la ficha y desde un ingreso; ver el cambio en Mercado Libre.
- Cambiar precio y SKU desde la web de Mercado Libre; ver el cambio en el sistema y en el historial con origen «Mercado Libre».
- Cortar la red al cambiar un precio; ver el pendiente y que «Reintentar envíos» lo complete.
- Pausar y reactivar desde el sistema y desde Mercado Libre; desactivar el producto.
- Un usuario sin permiso, desde la interfaz y llamando directo al servidor.
- Finalizar se prueba al final, con una segunda publicación de prueba creada para eso.

**E2E:** pendiente para la pasada de endurecimiento.

## 7. Riesgos y decisiones

1. **Precio con centavos.** *(Resuelto 2026-11-16, T-008: Mercado Libre los acepta.)* El precio se envía tal cual, sin redondear.
2. **Avisos de cambios propios.** Se resuelven comparando con el estado actual (sección 3.5), no guardando qué cambios hizo el sistema. Es más simple y no depende del orden de llegada de los avisos.
3. **Dos cambios cruzados** (sistema y web casi juntos): gana el último que llega, como dice la spec. Con un envío pendiente gana el del sistema; queda registrado en el historial igual.
4. **Cantidad de publicaciones.** La pantalla de vincular trae todas las publicaciones en cada carga. Para decenas o pocos cientos alcanza. Si el cliente pasara de 1000, hay que cambiar a la búsqueda por `scan` y paginar en la pantalla.
5. **El SKU es la llave para la spec 022** (las órdenes traen la publicación, no el SKU). La llave de verdad es `mlItemId`; el SKU es para la persona.
6. **`after` en Server Actions.** La guía de esta versión de Next confirma que funciona en Server Functions. Si la función de Vercel se corta antes de terminar, el envío queda pendiente y lo toma el próximo reintento: no se pierde nada.
7. **La cantidad se envía solo al vincular.** Mantenerla al día es la spec 021; mientras tanto, después de vincular, la cantidad en Mercado Libre no sigue al stock.

## 8. Preguntas abiertas

Ninguna.
