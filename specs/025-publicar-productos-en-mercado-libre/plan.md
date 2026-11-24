# Plan 025 — Publicar productos en Mercado Libre desde el sistema

> Cómo se construye lo que dice `spec.md`. La publicación, una vez creada, queda vinculada al producto y se administra con todo lo que ya existe: precio y estado (spec 020), cantidad (spec 021), órdenes (spec 022) y factura (spec 024). Esta spec suma armarla, publicarla y editar su contenido.

*(Aprobado el 2026-11-24.)*

## 0. Prueba técnica

Hecha el 2026-11-24; el detalle está en `prueba-tecnica.md`. Lo que define de este plan:

1. **Se publica con título** (`POST /items`) y Mercado Libre crea la publicación en el modelo nuevo, aunque la cuenta no tenga la etiqueta `user_product_seller`.
2. **Categoría sugerida** con `domain_discovery/search`; **características** con `/categories/{id}/attributes`; **límites** (largo del título, fotos, precio mínimo) con `/categories/{id}`.
3. **Revisión previa** con `POST /items/validate`: errores y advertencias, en español cuando vienen de las características.
4. **Comisión** con `/sites/MLA/listing_prices` y **costo del envío gratis** con `/users/{id}/shipping_options/free`.
5. **Garantía** en `sale_terms`, **medidas del paquete** en las características `SELLER_PACKAGE_*`, **sin código universal** con `EMPTY_GTIN_REASON`, **retiro en el local** con `shipping.local_pick_up`.
6. **Retiro en el local:** la compra llega sin envío y se da por entregada cuando el vendedor la marca entregada (spec 022, RF-20b).

## 1. Modelo de datos

**`MercadoLibrePublicationData`** (`ml_publication_data`, nueva): los datos de publicación de un producto (RF-1). Uno por producto; se guardan sin publicar y se reutilizan si la publicación se finaliza y se vuelve a publicar (RF-10).

| Campo | Tipo | Nota |
|---|---|---|
| `productId` | `String @unique` | El producto. Se borra con él. |
| `title` | `String` | Arranca con el nombre del producto (RF-2). |
| `categoryId`, `categoryName` | `String?` | La categoría elegida y su nombre para mostrar. |
| `suggestedCategoryId` | `String?` | La que sugirió Mercado Libre: si se elige otra, se advierte (RF-2). |
| `attributes` | `Json` | Las características cargadas: `[{ id, valueId?, valueName? }]`. Marca, SKU, código y paquete no van acá: se arman al publicar. |
| `description` | `String @db.Text` | Texto sin formato. |
| `useProductPhoto` | `Boolean @default(true)` | La foto del catálogo va primera. |
| `extraPhotoUrls` | `String[]` | Fotos propias de la publicación, en el mismo almacenamiento que las del catálogo. |
| `listingType` | `String` | `gold_special` (Clásica) o `gold_pro` (Premium). |
| `warrantyType`, `warrantyDays` | `String?`, `Int?` | Garantía del vendedor o de fábrica, y plazo en días. Sin garantía: los dos vacíos. |
| `localPickUp` | `Boolean` | Retiro en el local, además de Mercado Envíos. |
| `packageHeightCm`, `packageWidthCm`, `packageLengthCm`, `packageWeightG` | `Int?` | Paquete embalado. |
| `emptyGtinReason` | `String?` | Motivo por el que no se manda código universal, cuando no se manda (RF-2). |
| `publishingAt` | `DateTime?` | Reclamo de la publicación en curso: dos clics no publican dos veces (sección 3.4). |
| `lastError` | `String?` | Último rechazo de Mercado Libre, en español (RF-8). |
| `updatedAt`, `updatedByUserId` | | Quién la tocó por última vez. |

**`Setting`, campos nuevos** (RF-5): `mlDefaultListingType` (`gold_special`), `mlDefaultWarrantyType` (garantía del vendedor), `mlDefaultWarrantyDays` (`30`) y `mlDefaultLocalPickUp` (`true`). Los valores por defecto de la migración son los que eligió el cliente.

**`MercadoLibreListing`, campo nuevo:** `publishedFromSystem Boolean @default(false)`, para distinguir en la pantalla de publicaciones las que creó el sistema.

**`MercadoLibreOrder`, campo nuevo** (spec 022, RF-20b): `localPickUp Boolean @default(false)`.

**Migración** contra la base de la nube, con copia previa y reiniciando `pnpm dev` después.

## 2. Rutas y pantallas

| Ruta | Cambio |
|---|---|
| `/productos/[id]` | La sección «Mercado Libre» suma, si el producto no tiene publicación vigente, **«Preparar publicación»**; si la tiene y la creó el sistema, **«Editar publicación»**. |
| `/productos/[id]/mercadolibre` | **Nueva.** El formulario de publicación (RF-1, RF-2): título con contador, categoría sugerida, características según la categoría, código universal, fotos, descripción, tipo de publicación, garantía, envío y paquete. Abajo, la estimación (RF-4) y «Guardar», «Revisar con Mercado Libre» y «Publicar». Con publicación vigente, «Guardar y enviar a Mercado Libre» (RF-9). |
| `/configuracion?tab=mercadolibre` | Valores por defecto: tipo de publicación, garantía y retiro en el local (RF-5). |
| `/publicaciones` | Marca «Creada desde el sistema» y enlace a su formulario. |
| `/ordenes`, `/ordenes/[id]` | «Retiro en el local»: marca en la lista; en la orden, sin etiqueta y con el recordatorio de marcarla entregada en Mercado Libre (spec 022, RF-20b). |

## 3. Lógica de servidor

En `src/lib/mercadolibre/publish/`, con la regla de siempre: la decisión es pura y con pruebas; las llamadas a Mercado Libre y a la base, aparte.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `category-form.ts` (pura) | De la respuesta de `/categories/{id}/attributes`, los campos del formulario: obligatorios, condicionales y del catálogo, con su tipo (lista, texto, número, número con unidad, sí/no), sus opciones y sus unidades. Deja afuera los ocultos y los que el sistema arma solo (SKU, código universal, paquete). La marca queda en el formulario, precargada con la del producto: muchos productos no tienen marca y Mercado Libre la exige. *(Ajuste 2026-11-24, T-004.)* |
| `publication-rules.ts` (pura) | Qué falta para publicar (RF-6), en español y con el campo, y la decisión del código universal: el código de barras de origen sí; uno generado por el sistema no, y entonces hace falta el motivo (RF-2). |
| `publication-body.ts` (pura) | Datos + producto + cantidad (spec 021) → el cuerpo de `POST /items` y el de cada edición (RF-9). |
| `ml-validation.ts` (pura) | Las causas de `/items/validate` y de un rechazo → errores y advertencias en español (RF-6, RF-8). Usa el mensaje de Mercado Libre cuando ya viene en español; si no, uno propio por código conocido. |
| `estimate.ts` (pura) | Comisión del tipo elegido, envío a cargo del vendedor y lo que queda; con el permiso de costos, la diferencia contra el precio de compra (RF-4). |
| `publish-api.ts` | Llamadas: categoría sugerida, categoría, características, precios por tipo, costo del envío gratis, validar, crear, editar, cambiar la descripción, buscar por SKU. Categoría y características se guardan en memoria una hora: cambian poco y el formulario las pide seguido. |
| `publications.ts` | Guardar los datos, revisar, publicar y editar (secciones 3.3 a 3.5). |

### 3.2 El formulario

- **Datos iniciales** (RF-2, RF-5): título = nombre del producto; tipo, garantía y retiro = los de Configuración; foto del catálogo primera; marca y SKU del producto.
- **Categoría:** al escribir el título, «Sugerir categoría» pide hasta tres a Mercado Libre y precarga las características que deduce (por ejemplo, los conectores de un cable). Si el usuario elige una distinta de la primera, se advierte (RF-2).
- **Características:** el formulario se arma con `category-form` y marca las obligatorias. Si la categoría cambia, se conservan las que siguen existiendo.
- **Fotos:** se suben con la misma función que las del catálogo (`upload-photo.ts`: JPG, PNG o WEBP, hasta 5 MB) a una carpeta propia. Mercado Libre las descarga de su dirección pública. Hasta el máximo de la categoría (12).
- **Estimación** (RF-4): se recalcula al cambiar el tipo de publicación o el paquete, con el precio del producto.

### 3.3 Guardar y revisar

- **Guardar** (`savePublicationData`): valida tipos y largos y guarda. No llama a Mercado Libre (RF-1).
- **Revisar con Mercado Libre** (`reviewPublication`): `publication-rules` primero; si no falta nada, `POST /items/validate` con el mismo cuerpo que se publicaría, y muestra errores y advertencias (RF-6). No crea nada.

### 3.4 Publicar (RF-6 a RF-8)

1. Permiso «crear» en Mercado Libre, conexión activa (spec 019) y producto sin publicación vigente.
2. `publication-rules`; si falta algo, no se envía nada.
3. **Reclamo:** `updateMany` de `publishingAt` donde esté vacío o tenga más de dos minutos. Si otro proceso lo tiene, «Ya se está publicando».
4. `POST /items/validate`. Con errores: se muestran y no se publica. Lo que decide es el tipo de cada causa: Mercado Libre responde 400 aunque solo haya advertencias (T-002).
5. `POST /items`, con la cantidad que define la spec 021.
6. **Bien:** en una transacción, la `MercadoLibreListing` vinculada al producto (`publishedFromSystem: true`, como al vincular en la spec 020) y el registro de auditoría. Se libera el reclamo.
7. **Rechazo:** `lastError` en español, se libera el reclamo; el producto queda sin publicar con sus datos (RF-8).
8. **Sin respuesta** (caso borde de la spec): se busca la publicación por el SKU (`/users/{id}/items/search?seller_sku=`); si apareció, se vincula como en el paso 6. Si no, el reclamo **no se libera**: la búsqueda tarda unos segundos en ver una publicación nueva (T-009), así que el próximo intento, pasados los dos minutos, vuelve a buscar por SKU antes de crear otra. *(Ajuste 2026-11-24, T-009.)*

**El SKU** identifica la publicación y es lo que permite esa búsqueda, así que **para publicar, el producto necesita SKU** (spec 020). Si no lo tiene, el formulario lo pide y lo guarda en el producto, con las mismas reglas de la spec 020. *(Decisión de este plan, para aprobar.)*

**Producto sin stock** (RF-7): se publica con la cantidad de la spec 021, aunque sea 0. Mercado Libre la crea pausada por falta de stock y la reactiva sola cuando llegan unidades (T-002, `prueba-tecnica.md`).

### 3.5 Editar (RF-9, RF-10)

- **Solo publicaciones creadas desde el sistema** (`publishedFromSystem`). Las vinculadas desde Mercado Libre se siguen editando allá: el sistema no tiene sus datos de publicación.
- Se mandan solo los cambios: título, características, fotos, garantía y envío con `PUT /items/{id}`; la descripción con `PUT /items/{id}/description`. Precio y cantidad siguen como en las specs 020 y 021.
- Si Mercado Libre rechaza un cambio (por ejemplo, el título de una publicación que ya tiene ventas), se muestra el motivo y los datos del sistema quedan como estaban en Mercado Libre.
- Si la categoría cambió sus obligatorias (caso borde), la revisión previa lo marca.
- **Volver a publicar** un producto cuya publicación se finalizó crea una publicación nueva con los datos guardados (RF-10).

### 3.6 Retiro en el local (spec 022, RF-20b)

- `order-read.ts`: la orden suma `noShipping` (etiqueta `no_shipping` o sin envío), `fulfilled` y la marca `delivered` de sus etiquetas.
- `mapOrderStatus`: sin envío, **Entregada** si `fulfilled` o la marca `delivered`; si no, «Para preparar». Con envío, como hasta ahora.
- `localPickUp` se guarda al registrar la compra.

## 4. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Ver el formulario y la estimación | «ver» en Catálogo y en Mercado Libre | `/productos/[id]/mercadolibre` |
| Guardar datos, revisar, editar una publicación | `requirePermission(MERCADO_LIBRE, "editar")` | `savePublicationData`, `reviewPublication`, `updatePublication` |
| Publicar | `requirePermission(MERCADO_LIBRE, "crear")` | `publishProduct` |
| Diferencia contra el precio de compra | permiso especial «ver costos y márgenes»; el costo nunca viaja al navegador sin él | `estimate` |
| Valores por defecto | `requirePermission(CONFIGURACION, "editar")` | Configuración |

## 5. Pruebas

**Unitarias (Vitest):**

- `category-form`: las características reales del cable y de la billetera (fixtures de la prueba técnica): obligatorias, tipos, unidades y las que se dejan afuera.
- `publication-rules`: cada dato faltante; código de barras de origen, generado, y categoría que exige el código.
- `publication-body`: el cuerpo de la prueba técnica, con y sin retiro, Clásica y Premium, sin garantía.
- `ml-validation`: las causas reales de la prueba técnica (marca faltante, advertencias de envío).
- `estimate`: con y sin cargo fijo, con envío gratis, con y sin permiso de costos.
- `mapOrderStatus`: compra sin envío, entregada por `fulfilled` y por la marca `delivered`.

**Manuales, con la cuenta de prueba:** preparar y guardar sin publicar, revisar con un dato faltante, publicar un producto con stock y uno sin stock, publicar dos veces seguidas, editar descripción y fotos, finalizar y volver a publicar, y una compra con retiro en el local que se marca entregada.

**E2E:** pendiente para la pasada de endurecimiento.

## 6. Riesgos y decisiones

- **El modelo lo decide Mercado Libre** (spec, sección 5): si con la cuenta del cliente pide `family_name`, se ve en la revisión previa. Antes del arranque se hace una revisión previa sin publicar con su cuenta.
- **SKU obligatorio para publicar** (sección 3.4): evita publicaciones duplicadas cuando Mercado Libre no responde. Para aprobar.
- **Fotos por dirección pública:** Mercado Libre las descarga del almacenamiento del sistema. Si alguna no cumple sus requisitos (por ejemplo, menos de 500 px), lo dice al publicar y se muestra el motivo.
- **Título de una publicación con ventas:** Mercado Libre puede no dejar cambiarlo; se muestra su motivo.
- **Edición solo de las creadas desde el sistema** (sección 3.5).
- **Comisiones y envío:** son estimaciones (RF-4); lo real sale de la orden (spec 022).

## 7. Cambio 2026-11-24: precio en el formulario y pestañas (spec, sección 10)

*(Aprobado el 2026-11-24.)*

**Precio (RF-4b).**

- El formulario manda el precio de venta junto con los demás datos. Sin cambios, no se toca.
- Si cambió, se aplica **como en la ficha del producto** (spec 004 y spec 020, RF-13), en la misma transacción que guarda los datos de publicación:
  - el precio nuevo en el producto;
  - una fila en su historial de precios (con el precio de compra que ya tenía);
  - la marca de precio pendiente de la publicación vigente.

  Después de la transacción, el envío a Mercado Libre sale solo, como siempre.
- El permiso «cambiar precios» se valida en el servidor. Sin él, un precio distinto se rechaza con su motivo; el formulario lo muestra sin poder cambiarlo.
- La estimación recibe el precio que se está escribiendo, no el guardado: se recalcula sin guardar nada.

**Pestañas (RF-11).**

- `/productos/[id]` usa `Tabs` (`src/components/ui/tabs.tsx`): **Producto** (la ficha de siempre) y **Mercado Libre**.
- La pestaña Mercado Libre muestra el estado de la publicación y el formulario de esta spec (lo que hoy está en `/productos/[id]/mercadolibre`). Abre con `?tab=mercadolibre`.
- `/productos/[id]/mercadolibre` redirige a `/productos/[id]?tab=mercadolibre`, para que no se rompa ningún enlace. Publicaciones enlaza ahí.
- Sin «ver» en Mercado Libre: la ficha sin pestañas, como antes.
