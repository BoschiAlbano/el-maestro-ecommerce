# Prueba técnica 025 — resultados

> Hecha el 2026-11-24 con la cuenta vendedora de prueba conectada al sistema (la que se creó para la spec 022). Los scripts no quedan en el repositorio; los resultados, sí.

## La cuenta

- **No tiene la etiqueta `user_product_seller`**: `GET /users/me` trae solo `test_user` y `normal`. La cuenta de prueba de la spec 020 sí la tenía (2026-11-16): son cuentas distintas.
- Preferencias de envío: Mercado Envíos (`me2`) con despacho en correo o sucursal (`xd_drop_off`) activo; `local_pick_up: false`.
- Sus dos publicaciones (cable y billetera, creadas desde la web de Mercado Libre) son del modelo viejo: no tienen `user_product_id`.

## Resultados

| Punto | Resultado |
|---|---|
| Categoría sugerida | `GET /sites/MLA/domain_discovery/search?q=...` devuelve hasta tres categorías con su dominio y algunas características ya deducidas del texto (por ejemplo, los conectores del cable). Cable → `MLA5338` «Cables de Datos»; billetera → `MLA417712` «Billeteras y Monederos». |
| Datos de la categoría | `GET /categories/{id}`: largo máximo del título (60 en las dos), de la descripción (50.000), fotos (12) y precio mínimo ($1.000). |
| Características obligatorias | `GET /categories/{id}/attributes`, con las marcas `required`, `catalog_required` y `conditional_required`. Cable: marca y los dos conectores. Billetera: marca, modelo, color y género. En las dos, condicionales: código universal (`GTIN`) o motivo por el que no tiene (`EMPTY_GTIN_REASON`), IVA e impuesto interno. |
| Validar sin publicar | `POST /items/validate` revisa la publicación sin crearla. Responde con errores (`type: error`) y advertencias (`type: warning`). Sin la marca: «El campo "Marca" es obligatorio y no está cargado.», en español y listo para mostrar. **Responde 400 aunque solo haya advertencias**: lo que decide es el tipo de cada causa, no el código HTTP (con solo advertencias, la publicación se crea igual). |
| **Título (pregunta 1)** | **Lo escribe el usuario.** `POST /items` con `title` crea la publicación; Mercado Libre ajusta las mayúsculas («Cable Usb-c A Usb-a…»). Se puede cambiar después con `PUT /items/{id}`. Con `family_name` en lugar de `title`, esta cuenta lo rechaza: «The field family name is invalid». |
| **Modelo nuevo** | La publicación creada con `title` salió **ya en el modelo nuevo**: con `user_product_id` (`MLAU…`), aunque la cuenta no tiene la etiqueta. No hace falta un camino aparte para el modelo viejo. |
| **Retiro en el local (pregunta 3)** | `shipping: { mode: "me2", local_pick_up: true }` se acepta y la publicación queda con retiro en el local, aunque la preferencia de la cuenta esté en `false`. La compra de prueba se detalla en la sección siguiente. |
| Garantía | `sale_terms` con `WARRANTY_TYPE` = 2230280 («Garantía del vendedor») y `WARRANTY_TIME` = «30 días». |
| Medidas del paquete | Características `SELLER_PACKAGE_HEIGHT`, `_WIDTH`, `_LENGTH` (cm) y `_WEIGHT` (g). Mercado Libre las guarda tal cual. |
| Código universal | Sin código: `EMPTY_GTIN_REASON` = 17055160 («El producto no tiene código registrado»). Se aceptó. |
| Descripción | Va en el alta (`description.plain_text`) y se cambia con `PUT /items/{id}/description`. |
| **Comisión (pregunta 5)** | `GET /sites/MLA/listing_prices?price=X&category_id=Y` da lo que cobra cada tipo de publicación. Cables a $7.500: Clásica $2.492,50 (15,5 % + $1.330 fijos), Premium $3.460 (28,4 %: 15,5 % + 12,9 % por las cuotas sin interés). A $45.000 no hay cargo fijo: Clásica $6.975, Premium $12.780. |
| **Envío gratis (pregunta 4)** | `GET /users/{id}/shipping_options/free?dimensions=AxBxC,peso&item_price=X&listing_type_id=...` da lo que paga el vendedor: $0 a $7.500 y $6.190 a $45.000 con un paquete de 10 × 10 × 10 cm y 300 g. El umbral no hace falta conocerlo: alcanza con consultar el costo al precio del producto. |
| **Ficha de catálogo (pregunta 2)** | Las dos categorías tienen dominio de catálogo, pero la publicación salió sin ficha (`catalog_listing: false`). No es obligatoria para estos productos. |
| **Búsqueda por SKU** (T-009) | `/users/{id}/items/search?seller_sku=` encuentra la publicación, pero **no en el momento**: justo después de crearla no aparecía y segundos después sí. |
| **Sin stock** (T-002) | `POST /items` con `available_quantity: 0` **se acepta**: la publicación se crea pausada por falta de stock (`paused`, `out_of_stock`) y Mercado Libre la reactiva sola cuando le llegan unidades (spec 021). |
| Publicaciones de prueba | `MLA4236340908`, creada, editada (título y descripción) y finalizada el mismo día. `MLA2318260967`, con retiro en el local, para la compra de prueba; finalizada después. `MLA2318265745`, creada con 0 unidades y finalizada. |

## Compra con retiro en el local

Compra de prueba `2000019754744208`, con retiro en el domicilio del vendedor:

- **Sin envío:** la orden trae `shipping.id: null` y la etiqueta `no_shipping`. No hay envío que consultar, ni etiqueta, ni fecha límite de despacho.
- **El sistema la registró bien** como venta de Mercado Libre, «Para preparar», sin etiqueta ni fecha límite. «Preparar envío» (spec 024) no depende del envío, así que también sirve.
- **Pero no tiene cómo pasar a entregada:** el estado de la orden sale del envío (spec 022), y esta no tiene. Quedaría «Para preparar» para siempre.
- **Al marcarla entregada el vendedor** desde Mercado Libre, la orden pasa a `fulfilled: true` y se carga la calificación del vendedor con «entregado». Mercado Libre avisó (`orders_v2`) y el sistema releyó la orden en el momento.
- **La confirmación del comprador no cambió la orden**: las etiquetas siguieron en `not_delivered` y no apareció su calificación, al menos en los minutos siguientes. Puede ser una demora o algo propio de las cuentas de prueba.

## Consecuencias para la spec y el plan

1. **Cambia la regla «solo el modelo nuevo»** (spec, sección 5). Con esta cuenta, publicar con título funciona y Mercado Libre crea la publicación en el modelo nuevo igual. En vez de exigir la etiqueta `user_product_seller`, el sistema publica con título y deja que Mercado Libre decida el modelo. Si la cuenta del cliente tiene la etiqueta y Mercado Libre pide `family_name`, se ve en la primera validación (`/items/validate`) con su cuenta: queda como riesgo a confirmar antes del arranque.
2. **RF-2, título:** lo escribe el usuario, con el largo máximo de la categoría.
3. **RF-6:** antes de publicar, el sistema valida con `/items/validate` y muestra los errores de Mercado Libre; las advertencias se muestran sin frenar.
4. **RF-4:** la estimación sale de `listing_prices` y de `shipping_options/free`, con las medidas del paquete.
5. **Retiro en el local, cambio en la spec 022:** una compra sin envío (`no_shipping`) pasa a **Entregada** cuando la orden trae `fulfilled: true` (el vendedor la marcó entregada en Mercado Libre) o la etiqueta `delivered`. Mientras tanto queda «Para preparar», sin fecha límite ni etiqueta. La pantalla de la orden dice «Retiro en el local» y recuerda marcarla entregada en Mercado Libre al entregarla.
