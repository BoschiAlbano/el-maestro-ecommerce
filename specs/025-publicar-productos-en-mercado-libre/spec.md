# Spec 025 — Publicar productos en Mercado Libre desde el sistema

| | |
|---|---|
| **Estado** | Verificada (2026-11-24), con los cambios por la prueba técnica y de la sección 10 |
| **Depende de** | 004, 019, 020 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.4 |

## 1. Objetivo

Que el dueño publique un producto en Mercado Libre desde el sistema, sin tener que cargarlo de nuevo en Mercado Libre.

*(Creada 2026-11-12 al separar la spec 020.)* La 020 vincula y administra publicaciones que ya existen; esta spec suma crearlas y editar su contenido desde el sistema. Una vez publicada, la publicación se administra igual que una vinculada (spec 020).

## 2. Alcance

**Incluye:**

- Los datos extra que Mercado Libre pide para publicar, cargados por producto.
- Publicar un producto y editar el contenido de su publicación.
- Una estimación de lo que cobra Mercado Libre por la venta.
- Valores por defecto en Configuración para no repetir datos en cada producto.

**No incluye:**

- Vincular, pausar, reactivar, finalizar y mantener el precio igual en los dos lados: spec 020.
- La cantidad disponible que se publica y su actualización (spec 021).
- Publicación masiva de varios productos a la vez.
- Variantes (talles, colores): cada producto del sistema es una publicación.
- Productos usados o reacondicionados.
- Promociones, cupones, publicidad y el resto de lo listado en "Fuera de alcance" de `docs/PROJECT.md`.

## 3. Historias de usuario

- Como **dueño**, quiero que el sistema me pida solo lo que le falta al producto para publicarse, para no cargar dos veces lo que ya está.
- Como **dueño**, quiero ver cuánto me queda después de lo que cobra Mercado Libre antes de publicar, para decidir si subo el precio del producto.
- Como **dueño**, quiero corregir la descripción, las fotos o las medidas de una publicación desde el sistema.

## 4. Requisitos funcionales

**Datos de publicación**

- **RF-1.** Cada producto del catálogo tiene una sección "Mercado Libre" con sus datos de publicación. Se pueden cargar y guardar sin publicar.
- **RF-2.** Los datos de publicación son:
  - **Título.** Arranca con el nombre del producto y se puede cambiar. El sistema muestra el largo máximo que admite la categoría (60 caracteres en las categorías de la prueba técnica). Mercado Libre ajusta las mayúsculas a su criterio. *(Cambio 2026-11-24, prueba técnica: el título lo escribe el usuario.)*
  - **Categoría de Mercado Libre.** El sistema la sugiere a partir del título y el usuario la confirma. Si elige otra distinta de la sugerida, el sistema advierte que la publicación puede ser observada.
  - **Características de la categoría.** El formulario cambia según la categoría elegida y marca cuáles son obligatorias. La marca viene cargada con la del producto, y el SKU con el del producto (spec 020).
  - **Código universal del producto.** Se usa el código de barras de origen. Si el código lo generó el sistema, no se envía; si la categoría lo pide, el usuario elige el motivo por el que el producto no tiene código.
  - **Fotos.** La foto del producto más las que se agreguen para la publicación. Mínimo una.
  - **Descripción.** Texto sin formato.
  - **Precio.** Es el precio de venta del producto: hay un solo precio, igual en el sistema y en Mercado Libre (spec 020).
  - **Tipo de publicación.** **Clásica** (el comprador puede pagar en cuotas con interés a su cargo) o **Premium** (cuotas sin interés; Mercado Libre cobra más). *(Decisión del cliente, 2026-11-24: Clásica por defecto.)*
  - **Garantía.** Tipo y plazo. *(Por defecto: garantía del vendedor, 30 días.)*
  - **Envío.** **Mercado Envíos**, despachando en un correo o una sucursal de Mercado Libre, como hoy (spec 022), y además **retiro en el local**. *(Decisión del cliente, 2026-11-24.)*
  - **Paquete.** Alto, ancho y largo en centímetros, y peso en gramos, del producto ya embalado.
- **RF-3.** La condición del producto es siempre "Nuevo".
- **RF-4.** Antes de publicar, el sistema muestra una estimación de lo que cobra Mercado Libre por la venta y cuánto queda, según el tipo de publicación elegido. Si por el precio Mercado Libre exige envío gratis, la estimación suma lo que paga el vendedor por el envío. Es informativa: el importe real se conoce al vender. Para quien tenga el permiso "ver costos y márgenes", muestra además la diferencia contra el precio de compra.
- **RF-5.** Configuración > Mercado Libre guarda valores por defecto para el tipo de publicación, la garantía y el envío, que se aplican a las publicaciones nuevas. Vienen cargados con lo que eligió el cliente: Clásica, garantía del vendedor de 30 días, y Mercado Envíos con retiro en el local.

**Publicar y editar**

- **RF-6.** "Publicar" valida que no falte ningún dato obligatorio. Si falta algo, indica qué y dónde, y no envía nada. Después le pide a Mercado Libre que revise la publicación sin crearla: sus errores frenan la publicación y se muestran en español; sus advertencias se muestran sin frenar. *(Cambio 2026-11-24, prueba técnica.)*
- **RF-7.** Al publicar, la publicación sale con la cantidad disponible que define la spec 021. Un producto sin stock se puede publicar y queda pausado por falta de stock hasta que ingrese mercadería.
- **RF-8.** Si Mercado Libre rechaza la publicación, el sistema muestra el motivo en español y qué corregir, y el producto queda sin publicar con sus datos guardados.
- **RF-9.** Una publicación vigente se puede editar desde el sistema: título, descripción, fotos, características, garantía y paquete. Los cambios se envían a Mercado Libre al guardar.
- **RF-10.** Publicar una publicación nueva para un producto cuya publicación anterior se finalizó reutiliza los datos guardados.

## 5. Reglas de negocio

- **El dueño elige producto por producto** (`docs/PROJECT.md`, sección 5). Nada se publica solo.
- **El modelo de publicación lo decide Mercado Libre** *(cambio 2026-11-24, por la prueba técnica; antes: «solo el modelo nuevo», decisión 2026-11-11)*. El sistema publica con título, y Mercado Libre crea la publicación en el modelo nuevo aunque la cuenta no tenga la etiqueta `user_product_seller` (prueba técnica). Si con la cuenta del cliente Mercado Libre pide otro formato, se ve en la validación del RF-6 y se ajusta antes del arranque.
- **Los datos de publicación son propios de la publicación.** Cambiar después el nombre o la foto del producto en el catálogo no cambia la publicación.
- **El costo no se manda a Mercado Libre.** La estimación del RF-4 respeta el permiso "ver costos y márgenes" (constitución, regla 17).
- **Sin conexión no se publica** (spec 019).
- **Condiciones que impone Mercado Libre** (ver investigación, sección 1.4): categoría sugerida, características obligatorias por categoría, requisitos de fotos y medidas reales del embalaje.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Cargar o editar datos de publicación | Permiso "editar" en Mercado Libre |
| Publicar | Permiso "crear" en Mercado Libre |
| Ver la diferencia contra el precio de compra | Permiso especial "ver costos y márgenes" |
| Cambiar los valores por defecto | Permiso "editar" en Configuración |

## 7. Casos borde y errores

- **Falta un dato obligatorio:** no se envía nada; el formulario marca el campo.
- **Foto que no cumple los requisitos** (formato, peso o tamaño mínimo): se rechaza al cargarla, con el motivo.
- **Medidas del paquete irreales:** Mercado Libre las rechaza; el sistema pide las medidas del embalaje, no del producto suelto.
- **Código de barras de origen que Mercado Libre no reconoce:** se muestra el error y se ofrece publicar declarando que no tiene código, si la categoría lo permite.
- **La categoría exige el código y el producto no lo tiene:** no se puede publicar en esa categoría; el sistema lo explica.
- **La cuenta está bloqueada para publicar** por datos pendientes en Mercado Libre: se muestra el aviso y el enlace para completarlos.
- **Mercado Libre no responde al publicar:** no se sabe si la publicación se creó. El sistema lo verifica antes de permitir otro intento, para no duplicarla.
- **Se intenta publicar un producto que ya tiene publicación vigente:** se rechaza.
- **La categoría elegida cambia sus requisitos con el tiempo:** al editar, el sistema vuelve a pedir lo que falte.
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.

## 8. Criterios de aceptación

- [x] Se cargan los datos de publicación de un producto y se guardan sin publicar. *(Revisión manual del cliente, 2026-11-24.)*
- [x] El sistema sugiere la categoría y arma el formulario de características según la categoría elegida. *(Revisión manual; prueba unitaria con las características reales del cable y de la billetera.)*
- [x] No se puede publicar con datos obligatorios faltantes, y el sistema indica cuáles. *(Revisión manual; prueba unitaria de `missingForPublishing`.)*
- [x] Un producto con todos sus datos se publica y aparece activo en la pantalla de publicaciones (spec 020), con enlace a Mercado Libre. *(Revisión manual del cliente; con la cuenta de prueba, T-009.)*
- [x] Un producto con código de barras generado por el sistema se publica sin enviar ese código. *(Prueba unitaria y publicación de prueba `MLA2318269041`, con el motivo «sin código registrado».)*
- [x] Se ve la estimación de lo que cobra Mercado Libre antes de publicar. *(Revisión manual; prueba unitaria con los precios reales.)*
- [x] Editar la descripción o las fotos desde el sistema las cambia en Mercado Libre. *(T-009 con la cuenta de prueba y revisión manual.)*
- [x] Si Mercado Libre rechaza la publicación en la revisión previa, el sistema muestra el motivo en español y no la crea. *(Con la cuenta de prueba: «Faltan características obligatorias: «Género».»; prueba unitaria de las causas reales.)*
- [x] Un usuario sin el permiso correspondiente no puede publicar, ni desde la interfaz ni llamando directo al servidor. *(Las acciones validan «editar» y «crear» en Mercado Libre en el servidor; la pantalla oculta los botones.)*
- [x] Hay pruebas unitarias de: validación de datos obligatorios, decisión de enviar o no el código universal y cálculo de la estimación. *(`publication-rules.test.ts`, `ml-validation.test.ts`.)*
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

0. ~~**Cuenta de prueba habilitada.**~~ Resuelta el 2026-11-16: la cuenta de prueba ya tiene la etiqueta `user_product_seller` (ver `specs/020-publicacion-en-mercado-libre/prueba-tecnica.md`).
**Respondidas por el cliente (2026-11-24):**

- **Envío:** Mercado Envíos despachando en sucursal, como hoy, y además retiro en el local (RF-2).
- **Garantía por defecto:** garantía del vendedor, 30 días (RF-2, RF-5).
- **Tipo de publicación por defecto:** Clásica; en cada producto se puede elegir Premium, con cuotas sin interés (RF-2, RF-5).

**Prueba técnica (2026-11-24):** respondidas todas; el detalle está en `prueba-tecnica.md`. El título lo escribe el usuario, la ficha de catálogo no es obligatoria, y la comisión y el costo del envío gratis se consultan a Mercado Libre. Una compra con retiro en el local llega sin envío: para que pase a entregada hace falta un cambio en la spec 022 (se propone en el plan).

**Preguntas originales de la prueba técnica**, con la cuenta de prueba vendedora:

1. **Título en el modelo nuevo.** La documentación dice que en el modelo nuevo el título no se envía y Mercado Libre lo arma. Hay que ver si el usuario escribe un título o solo un nombre de producto. Puede cambiar el RF-2.
2. **Fichas de producto de Mercado Libre.** En algunas categorías Mercado Libre empuja a publicar sobre una ficha ya armada del producto. Queda fuera de esta versión salvo que la prueba muestre que es obligatorio para los productos del cliente.
3. **Retiro en el local.** Qué hace falta en la cuenta para ofrecerlo (por ejemplo, la dirección del local cargada en Mercado Libre) y cómo llega una compra con retiro a Órdenes (spec 022): no tiene etiqueta, y hay que ver cómo pasa a entregada. Puede pedir una nota en las specs 022 y 024.
4. **Envío gratis obligatorio.** Desde qué precio Mercado Libre lo exige y cómo se consulta lo que paga el vendedor, para la estimación del RF-4.
5. **Comisión por tipo de publicación.** Cómo se consulta lo que cobra Mercado Libre en Clásica y en Premium para la categoría, para la estimación del RF-4.

## 10. Cambio 2026-11-24: precio en el formulario y pestañas en la ficha

*(Pedido del cliente después de probar el formulario; aprobado el 2026-11-24.)*

**Por qué.** La estimación de lo que cobra Mercado Libre (RF-4) está al final del formulario, pero el precio se cambia en la ficha del producto. Si los números no convencen, hay que salir, cambiar el precio y volver a empezar.

- **RF-4b.** El formulario muestra el **precio de venta** junto a la estimación, y se puede cambiar ahí: la estimación se recalcula mientras se escribe, sin guardar nada. Es el mismo precio del producto (un solo precio, spec 020): al guardar («Guardar», «Revisar con Mercado Libre», «Publicar» o «Guardar y enviar a Mercado Libre») cambia el precio de venta del producto, queda en su historial de precios y, si la publicación está vigente, se envía a Mercado Libre como cualquier cambio de precio (spec 020, RF-13). Quien no tiene el permiso especial «cambiar precios» lo ve sin poder cambiarlo.
- **RF-11.** La ficha del producto se organiza en dos pestañas: **Producto** (los datos del catálogo, spec 004) y **Mercado Libre** (el estado de la publicación y el formulario de esta spec). Quien no ve Mercado Libre no ve las pestañas. La pestaña se puede abrir directo con un enlace (por ejemplo, desde Publicaciones).

**Permisos:** cambiar el precio desde el formulario pide «cambiar precios», igual que en la ficha del producto (spec 004).

**Criterios de aceptación:**

- [x] Cambiar el precio en el formulario recalcula la estimación sin guardar. *(Revisión manual; T-014.)*
- [x] Al guardar, el precio del producto cambia, queda en el historial y, si está publicada, llega a Mercado Libre. *(T-014 con la publicación de prueba: $12.000 en el producto, el historial y Mercado Libre.)*
- [x] Sin el permiso «cambiar precios», el precio se ve pero no se puede cambiar, ni desde la pantalla ni llamando directo al servidor. *(T-014: el servidor lo rechaza; prueba unitaria de `salePriceChange`.)*
- [x] La ficha del producto tiene las pestañas Producto y Mercado Libre; sin permiso de Mercado Libre, no hay pestañas. *(Revisión manual.)*
