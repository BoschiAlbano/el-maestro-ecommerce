# Prueba técnica 020 — resultados

> Se corrió el 2026-11-16 contra la cuenta de Mercado Libre de desarrollo, conectada en el sistema (spec 019), con su única publicación, que es de prueba. El usuario autorizó modificarla. Los scripts fueron temporales y viven fuera del repositorio; usan `mlFetch` del sistema y nunca imprimen las autorizaciones.

## Estado

**Hecha.** Solo queda sin probar la parte del punto 5 que necesita publicaciones que la cuenta no tiene (variantes y catálogo), y finalizar, que es irreversible.

## La cuenta y la publicación de prueba

- La cuenta **ya tiene el modelo nuevo de publicación**: `GET /users/me` trae la etiqueta `user_product_seller` (el 2026-11-11 no la tenía). Esto destraba la spec 025.
- La cuenta no tiene Mercado Envíos activado (`status.mercadoenvios: not_accepted`). No afecta a esta spec; sí a la 022 y la 025.
- Una sola publicación, del modelo nuevo (etiqueta `user_product_listing`, con `user_product_id`), sin variantes ni ficha de catálogo (`catalog_listing: false`), pausada por el vendedor (`sub_status: paused_by_seller`), con SKU en la característica `SELLER_SKU`. El campo viejo `seller_custom_field` viene vacío.

## Resultados

| Punto | Resultado |
|---|---|
| 1. Listar publicaciones | `GET /users/{id}/items/search` devuelve los identificadores; sin filtro trae todas, y con `status=active`, `paused` o `closed` filtra por estado. Hasta 50 por página. El detalle se pide aparte con `GET /items/{id}?include_attributes=all`. |
| 1. Leer y escribir el SKU | Se lee de la característica `SELLER_SKU`. Se escribe con `PUT /items/{id}` mandando solo `{ attributes: [{ id: "SELLER_SKU", value_name }] }`: **las otras 21 características quedan como estaban**. En la categoría de prueba el largo máximo es **255** (`value_max_length` de `/categories/{id}/attributes`); hay que leerlo por categoría y no suponerlo. |
| 2. Buscar por SKU | `GET /users/{id}/items/search?seller_sku=X` funciona, pero **solo con el SKU exacto y respetando mayúsculas**: `odoo-test-001` no encuentra `ODOO-TEST-001`, y `ODOO-TEST` tampoco (no busca por parte). Además **no es inmediata**: justo después de cambiar el SKU, buscar el nuevo no devolvió nada. Para proponer vínculos conviene traer todas las publicaciones y comparar en el sistema, sin mayúsculas, en lugar de buscar una por una. |
| 3. Pausar y reactivar | `PUT /items/{id}` con `{ status: "active" }` o `{ status: "paused" }`. Responde en menos de medio segundo con la publicación ya cambiada. |
| 3. Finalizar | **No se probó**: es irreversible y es la única publicación. Según la documentación es `{ status: "closed" }`, y una publicación finalizada no vuelve; para venderla otra vez se crea una nueva. |
| Precio | `PUT /items/{id}` con `{ price }` funciona en el modelo nuevo; no hace falta la API aparte de precios. `GET /items/{id}/prices` y `/sale_price` también responden, por si hace falta ver promociones. |
| Avisos | Llegan avisos de dos temas: **`items`** (recurso `/items/{id}`) por cualquier cambio, y **`items_prices`** (recurso `/items/{id}/prices`) por cambios de precio. **El aviso no dice qué cambió**: hay que pedir la publicación y comparar. **No hay un aviso por cada cambio**: seis cambios seguidos dieron seis avisos repartidos de otra forma (cinco `items` y un `items_prices` para dos cambios de precio), así que no hay que contarlos. **También llegan por los cambios que hace el propio sistema**, así que el sistema tiene que reconocer sus propios cambios para no tomarlos como cambios de Mercado Libre. Mercado Libre los mandó uno o dos segundos después de cada cambio; al sistema llegaron unos 16 segundos después, probablemente por el túnel de ngrok y el servidor de desarrollo. Hoy quedan como «sin acción», porque la 019 todavía no tiene quién los procese. |
| 4. Cambios desde la web de Mercado Libre | El usuario cambió el precio y el SKU desde la web. Llegaron **tres avisos, todos del tema `items`; ninguno de `items_prices`**, aunque el precio sí cambió (también en `/items/{id}/prices`). Después quedó **activa** porque el usuario también la reactivó desde la web (confirmado): editar no la reactiva sola. Al leerla, el precio y el SKU nuevos ya estaban. Se volvió a dejar como estaba con un solo `PUT` que cambió estado, precio y SKU juntos. |
| 5. Variantes y catálogo | **No se puede probar con esta cuenta**: su única publicación no tiene variantes ni es de catálogo. La del modelo nuevo se ve como cualquier publicación, más `user_product_id`, `family_name` y la etiqueta `user_product_listing`. |

## Consecuencias para el plan

- **Proponer vínculos:** leer todas las publicaciones de la cuenta y comparar el SKU en el sistema, sin distinguir mayúsculas. No depender de la búsqueda por SKU de Mercado Libre.
- **Procesar avisos:** ante `items` o `items_prices` (un cambio de precio hecho en la web puede llegar solo como `items`), pedir la publicación y comparar precio, SKU y estado con lo que tiene el sistema. Si coinciden, era un cambio propio y no se hace nada.
- **Escrituras:** las tres (precio, SKU y estado) van por `PUT /items/{id}` y responden con la publicación actualizada, así que el sistema puede guardar lo que devolvió Mercado Libre como último valor conocido.
