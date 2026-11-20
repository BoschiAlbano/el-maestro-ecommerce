# Spec 025 — Publicar productos en Mercado Libre desde el sistema

| | |
|---|---|
| **Estado** | Borrador |
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
- Publicar en el modelo viejo de Mercado Libre.
- Promociones, cupones, publicidad y el resto de lo listado en "Fuera de alcance" de `docs/PROJECT.md`.

## 3. Historias de usuario

- Como **dueño**, quiero que el sistema me pida solo lo que le falta al producto para publicarse, para no cargar dos veces lo que ya está.
- Como **dueño**, quiero ver cuánto me queda después de lo que cobra Mercado Libre antes de publicar, para decidir si subo el precio del producto.
- Como **dueño**, quiero corregir la descripción, las fotos o las medidas de una publicación desde el sistema.

## 4. Requisitos funcionales

**Datos de publicación**

- **RF-1.** Cada producto del catálogo tiene una sección "Mercado Libre" con sus datos de publicación. Se pueden cargar y guardar sin publicar.
- **RF-2.** Los datos de publicación son:
  - **Título o nombre del producto.** Arranca con el nombre del producto y se puede cambiar. El sistema muestra el largo máximo que admite la categoría. *(Ver pregunta 1: en el modelo nuevo puede no enviarse.)*
  - **Categoría de Mercado Libre.** El sistema la sugiere a partir del título y el usuario la confirma. Si elige otra distinta de la sugerida, el sistema advierte que la publicación puede ser observada.
  - **Características de la categoría.** El formulario cambia según la categoría elegida y marca cuáles son obligatorias. La marca viene cargada con la del producto, y el SKU con el del producto (spec 020).
  - **Código universal del producto.** Se usa el código de barras de origen. Si el código lo generó el sistema, no se envía; si la categoría lo pide, el usuario elige el motivo por el que el producto no tiene código.
  - **Fotos.** La foto del producto más las que se agreguen para la publicación. Mínimo una.
  - **Descripción.** Texto sin formato.
  - **Precio.** Es el precio de venta del producto: hay un solo precio, igual en el sistema y en Mercado Libre (spec 020).
  - **Tipo de publicación.** Sin cuotas o con cuotas.
  - **Garantía.** Tipo y plazo.
  - **Paquete.** Alto, ancho y largo en centímetros, y peso en gramos, del producto ya embalado.
- **RF-3.** La condición del producto es siempre "Nuevo".
- **RF-4.** Antes de publicar, el sistema muestra una estimación de lo que cobra Mercado Libre por la venta y cuánto queda. Es informativa: el importe real se conoce al vender. Para quien tenga el permiso "ver costos y márgenes", muestra además la diferencia contra el precio de compra.
- **RF-5.** Configuración > Mercado Libre guarda valores por defecto para el tipo de publicación y la garantía, que se aplican a las publicaciones nuevas.

**Publicar y editar**

- **RF-6.** "Publicar" valida que no falte ningún dato obligatorio. Si falta algo, indica qué y dónde, y no envía nada.
- **RF-7.** Al publicar, la publicación sale con la cantidad disponible que define la spec 021. Un producto sin stock se puede publicar y queda pausado por falta de stock hasta que ingrese mercadería.
- **RF-8.** Si Mercado Libre rechaza la publicación, el sistema muestra el motivo en español y qué corregir, y el producto queda sin publicar con sus datos guardados.
- **RF-9.** Una publicación vigente se puede editar desde el sistema: título, descripción, fotos, características, garantía y paquete. Los cambios se envían a Mercado Libre al guardar.
- **RF-10.** Publicar una publicación nueva para un producto cuya publicación anterior se finalizó reutiliza los datos guardados.

## 5. Reglas de negocio

- **El dueño elige producto por producto** (`docs/PROJECT.md`, sección 5). Nada se publica solo.
- **Solo el modelo nuevo de publicación de Mercado Libre** (decisión 2026-11-11). Si la cuenta conectada no tiene la etiqueta `user_product_seller`, publicar desde el sistema no está disponible y la pantalla explica por qué. Vincular y administrar (spec 020) siguen funcionando.
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

- [ ] Se cargan los datos de publicación de un producto y se guardan sin publicar.
- [ ] El sistema sugiere la categoría y arma el formulario de características según la categoría elegida.
- [ ] No se puede publicar con datos obligatorios faltantes, y el sistema indica cuáles.
- [ ] Un producto con todos sus datos se publica y aparece activo en la pantalla de publicaciones (spec 020), con enlace a Mercado Libre.
- [ ] Un producto con código de barras generado por el sistema se publica sin enviar ese código.
- [ ] Se ve la estimación de lo que cobra Mercado Libre antes de publicar.
- [ ] Editar la descripción o las fotos desde el sistema las cambia en Mercado Libre.
- [ ] Con una cuenta sin el modelo nuevo, publicar no está disponible y el sistema explica por qué.
- [ ] Un usuario sin el permiso correspondiente no puede publicar, ni desde la interfaz ni llamando directo al servidor.
- [ ] Hay pruebas unitarias de: validación de datos obligatorios, decisión de enviar o no el código universal y cálculo de la estimación.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

0. ~~**Cuenta de prueba habilitada.**~~ Resuelta el 2026-11-16: la cuenta de prueba ya tiene la etiqueta `user_product_seller` (ver `specs/020-publicacion-en-mercado-libre/prueba-tecnica.md`).
1. **Título en el modelo nuevo.** La documentación dice que en el modelo nuevo el título no se envía y Mercado Libre lo arma. Hay que ver en la prueba técnica si el usuario escribe un título o solo un nombre de producto. Puede cambiar el RF-2.
2. **Modalidad de envío.** ¿Despacho en sucursal, colecta o envío en el día? ¿Se ofrece retiro en el local? Define qué se configura al publicar y lo que cobra Mercado Libre.
3. **Garantía por defecto.** ¿Qué garantía ofrece el negocio y por cuánto tiempo?
4. **Tipo de publicación por defecto.** ¿Sin cuotas o con cuotas?
5. **Fichas de producto de Mercado Libre.** En algunas categorías Mercado Libre empuja a publicar sobre una ficha ya armada del producto. Queda fuera de esta versión salvo que la prueba técnica muestre que es obligatorio para los productos del cliente.
