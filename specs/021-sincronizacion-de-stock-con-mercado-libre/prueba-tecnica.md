# Prueba técnica 021 — resultados

> Se corrió el 2026-11-19 contra la cuenta de Mercado Libre de desarrollo, con la publicación de prueba del cable (`MLA2279211711`, modelo nuevo), vinculada en el sistema. El usuario autorizó modificarla. El script fue temporal, vive fuera del repositorio y usa `mlFetch` del sistema. La publicación quedó como estaba: pausada por el vendedor, cantidad 1.

## Estado

**Hecha.** Los cuatro puntos de la spec (sección 9) tienen resultado.

## Resultados

| Punto | Resultado |
|---|---|
| 1. Cambiar la cantidad | `PUT /items/{id}` con `available_quantity` funciona en una publicación del modelo nuevo y responde enseguida. La cantidad es la misma que muestra la API de stock del producto (`GET /user-products/{id}/stock`: una ubicación `selling_address` con `quantity`), que Mercado Libre actualiza solo. **No hace falta usar la API de stock** ni su número de versión. |
| 2. Reactivación al volver el stock | Activa con cantidad 0: queda `paused` con subestado `out_of_stock` en el momento. Con cantidad 3: vuelve a `active` sola, en el momento. |
| 3. Pausada por el dueño | Con cantidad 0, el subestado pasa a `["out_of_stock", "paused_by_seller"]`. Con cantidad 5 vuelve a `["paused_by_seller"]` y **sigue pausada**: no se reactiva por tener stock. |
| 4. Avisos | Cada cambio de cantidad llega como `items` (recurso `/items/{id}`), como cualquier otro cambio. Además llega un tema nuevo, **`stock-locations`** (recurso `/user-products/{id}/stock`), que no trae el identificador de la publicación. Los avisos llegaron al sistema en unos 4 segundos. |

## Hallazgos

- **Error en la spec 020, corregido:** con `["out_of_stock", "paused_by_seller"]` el sistema mostraba «Pausada sin stock». Ahora manda la pausa del vendedor y se muestra «Pausada» (`listing-status.ts`, con su prueba).
- **Los cambios de estado de la prueba generaron los avisos esperados** en la campanita («Se reactivó» y «Se pausó desde Mercado Libre», porque se hicieron desde fuera del sistema); las pausas por falta de stock y su vuelta no avisaron. Se marcaron como leídos.

## Consecuencias para el plan

- **La cantidad va por el mismo `PUT /items/{id}`** que el precio y la pausa: entra en la bandeja de envíos de la spec 020, sin un camino aparte.
- **El tema `stock-locations` no hace falta:** el cambio también llega como `items`, que ya se procesa. Se deja sin función (queda como «sin acción»), igual que hoy.
- **El caso borde «Mercado Libre rechaza porque el stock cambió en el medio»** es de la API de stock con número de versión, que no se usa. Con `PUT /items/{id}` no aplica.
