# Spec 020 — Publicación de productos en Mercado Libre

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 004, 019 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.4 |

## 1. Objetivo

Que el dueño elija, producto por producto, qué vende en Mercado Libre, y lo publique desde el sistema sin tener que cargar el producto de nuevo en Mercado Libre.

*(Cambio 2026-11-11.)* El cliente va a empezar a vender en Mercado Libre por su cuenta antes de que el sistema esté terminado. Por eso esta spec cubre dos caminos: **publicar** un producto desde el sistema y **vincular** una publicación que ya existe en Mercado Libre con un producto del sistema.

## 2. Alcance

**Incluye:**

- Los datos extra que Mercado Libre pide para publicar, cargados por producto.
- Publicar, editar, pausar, reactivar y finalizar una publicación.
- Un precio propio para Mercado Libre, distinto del precio de mostrador.
- Una pantalla con todos los productos y el estado de su publicación.
- Reflejar en el sistema lo que Mercado Libre hace con la publicación: observarla, pausarla o darla de baja.
- Valores por defecto en Configuración para no repetir datos en cada producto.
- *(Agregado 2026-11-11.)* Vincular publicaciones que ya existen en la cuenta de Mercado Libre con productos del sistema, de forma automática cuando coinciden los códigos y a mano cuando no.

**No incluye:**

- La cantidad disponible que se publica y su actualización (spec 021).
- Las ventas que llegan por la publicación (spec 022).
- Crear productos en el catálogo del sistema a partir de publicaciones de Mercado Libre: el producto tiene que existir antes en el sistema.
- Traer al sistema las ventas hechas en Mercado Libre antes de conectar la cuenta.
- Publicación masiva de varios productos a la vez.
- Variantes (talles, colores): cada producto del sistema es una publicación.
- Productos usados o reacondicionados.
- Promociones, cupones, publicidad y el resto de lo listado en "Fuera de alcance" de `docs/PROJECT.md`.
- Responder preguntas de compradores desde el sistema.

## 3. Historias de usuario

- Como **dueño**, quiero elegir qué productos publico en Mercado Libre, para vender ahí solo lo que me conviene.
- Como **dueño**, quiero que el sistema me pida solo lo que le falta al producto para publicarse, para no cargar dos veces lo que ya está.
- Como **dueño**, quiero poner un precio distinto para Mercado Libre y ver cuánto me queda después de lo que cobra, para no vender a pérdida.
- Como **dueño**, quiero ver en una sola pantalla qué está publicado y en qué estado, para saber si algo quedó pausado u observado.
- Como **dueño**, quiero pausar o finalizar una publicación desde el sistema, para dejar de vender un producto sin entrar a Mercado Libre.
- Como **dueño**, quiero enterarme si Mercado Libre observa o da de baja una publicación, para corregirla.
- Como **dueño**, quiero que las publicaciones que ya cargué en Mercado Libre queden conectadas con mis productos del sistema, para no perder sus ventas, opiniones y posición al empezar a usar el sistema.

## 4. Requisitos funcionales

**Datos de publicación**

- **RF-1.** Cada producto del catálogo tiene una sección "Mercado Libre" con sus datos de publicación. Se pueden cargar y guardar sin publicar.
- **RF-2.** Los datos de publicación son:
  - **Título.** Arranca con el nombre del producto y se puede cambiar. El sistema muestra el largo máximo que admite la categoría.
  - **Categoría de Mercado Libre.** El sistema la sugiere a partir del título y el usuario la confirma. Si elige otra distinta de la sugerida, el sistema advierte que la publicación puede ser observada.
  - **Características de la categoría.** El formulario cambia según la categoría elegida y marca cuáles son obligatorias. La marca viene cargada con la del producto.
  - **Código universal del producto.** Se usa el código de barras de origen. Si el código lo generó el sistema, no se envía; si la categoría lo pide, el usuario elige el motivo por el que el producto no tiene código.
  - **Fotos.** La foto del producto más las que se agreguen para la publicación. Mínimo una.
  - **Descripción.** Texto sin formato.
  - **Precio en Mercado Libre.** En pesos enteros.
  - **Tipo de publicación.** Sin cuotas o con cuotas.
  - **Garantía.** Tipo y plazo.
  - **Paquete.** Alto, ancho y largo en centímetros, y peso en gramos, del producto ya embalado.
- **RF-3.** La condición del producto es siempre "Nuevo".
- **RF-4.** Antes de publicar, el sistema muestra una estimación de lo que cobra Mercado Libre por la venta y cuánto queda. Es informativa: el importe real se conoce al vender. Para quien tenga el permiso "ver costos y márgenes", muestra además la diferencia contra el precio de compra.
- **RF-5.** Configuración > Mercado Libre guarda valores por defecto para el tipo de publicación y la garantía, que se aplican a las publicaciones nuevas.

**Publicar y mantener**

- **RF-6.** "Publicar" valida que no falte ningún dato obligatorio. Si falta algo, indica qué y dónde, y no envía nada.
- **RF-7.** Al publicar, la publicación sale con la cantidad disponible que define la spec 021. Un producto sin stock se puede publicar y queda pausado por falta de stock hasta que ingrese mercadería.
- **RF-8.** Si Mercado Libre rechaza la publicación, el sistema muestra el motivo en español y qué corregir, y el producto queda sin publicar con sus datos guardados.
- **RF-9.** Una publicación activa se puede editar: título, descripción, fotos, características, precio, garantía y paquete. Los cambios se envían a Mercado Libre al guardar.
- **RF-10.** Una publicación se puede **pausar** y **reactivar**. Pausada no se puede comprar y conserva su historial.
- **RF-11.** Una publicación se puede **finalizar**, con confirmación. Es definitivo: para volver a vender ese producto hay que publicarlo de nuevo.
- **RF-12.** Cada producto tiene como máximo una publicación vigente.
- **RF-13.** Si un producto se desactiva en el catálogo, su publicación se pausa sola. Al reactivarlo, la publicación sigue pausada hasta que alguien la reactive.

**Estado y seguimiento**

- **RF-14.** Una pantalla "Publicaciones" lista los productos con: foto, nombre, precio de mostrador, precio en Mercado Libre, stock, estado de la publicación y un enlace para verla en Mercado Libre. Se filtra por estado y se busca por nombre o código.
- **RF-15.** Los estados que muestra el sistema son: sin publicar, datos incompletos, activa, pausada, pausada sin stock, observada por Mercado Libre y finalizada.
- **RF-16.** Cuando Mercado Libre observa, pausa o da de baja una publicación, el sistema actualiza su estado, muestra el motivo que informe Mercado Libre y genera un aviso en la campanita.
- **RF-17.** Si la publicación se modificó directamente en Mercado Libre y su precio o su estado ya no coinciden con lo que tiene el sistema, la pantalla lo señala. El sistema no pisa esos cambios por su cuenta, salvo el stock (spec 021).
- **RF-18.** Cada cambio del precio en Mercado Libre queda registrado con quién lo hizo y cuándo.

**Vincular publicaciones existentes** *(agregado 2026-11-11)*

- **RF-19.** Una pantalla "Vincular publicaciones" trae todas las publicaciones de la cuenta conectada que todavía no están vinculadas a un producto del sistema, con su foto, título, precio, cantidad, estado y código.
- **RF-20.** El sistema propone el producto que corresponde a cada publicación cuando coincide el **código de vendedor (SKU)** de la publicación con el código de barras del producto, o cuando coincide el código universal. Si hay una única coincidencia, la muestra como propuesta lista para confirmar.
- **RF-21.** El usuario confirma las propuestas, de a una o todas juntas. Nada se vincula sin confirmación.
- **RF-22.** Las publicaciones sin coincidencia se vinculan a mano, buscando el producto por nombre o código.
- **RF-23.** Al vincular, el sistema toma de la publicación su título, categoría, características, fotos, descripción, tipo de publicación y **precio**, y los guarda como datos de publicación del producto (RF-2). El precio de mostrador no cambia.
- **RF-24.** Al vincular, el sistema envía a Mercado Libre la cantidad disponible que corresponde según el stock del sistema (spec 021). Antes de confirmar, la pantalla muestra la cantidad que tiene hoy la publicación y la que va a quedar.
- **RF-25.** Una publicación vinculada se comporta igual que una publicada desde el sistema: se edita, se pausa, se finaliza y sincroniza stock.
- **RF-26.** Una publicación con variantes (talles, colores) no se puede vincular: la pantalla lo indica y la deja fuera.
- **RF-27.** Un vínculo se puede **deshacer**. La publicación sigue en Mercado Libre tal como está y el sistema deja de sincronizarla.
- **RF-28.** Mientras haya publicaciones activas sin vincular, la pantalla de publicaciones lo advierte: esas publicaciones venden sin descontar stock del sistema.

## 5. Reglas de negocio

- **El dueño elige producto por producto** (`docs/PROJECT.md`, sección 5). Nada se publica solo.
- **Vincular conserva la publicación.** Es la misma publicación de Mercado Libre, con sus ventas, opiniones y posición. Por eso se vincula en lugar de publicar de nuevo.
- **Al vincular manda el stock del sistema** (spec 021). El inventario del sistema tiene que estar al día antes de vincular: si el sistema dice 0, la publicación queda pausada por falta de stock.
- **Al vincular, el precio de Mercado Libre es el que ya tiene la publicación.** El sistema lo adopta; no lo pisa con el de mostrador.
- **Un producto, una publicación.** Si dos publicaciones corresponden al mismo producto, solo una se puede vincular; la otra queda sin vincular para que el dueño decida qué hacer con ella en Mercado Libre.
- **El precio de Mercado Libre es independiente del de mostrador.** Cambiar uno no cambia el otro.
- **Todo en pesos** y con `Decimal` (constitución, reglas 5 y 6). El precio en Mercado Libre es un monto cargado a mano, en pesos enteros.
- **Cambiar el precio en Mercado Libre requiere el permiso especial "cambiar precios"** y queda registrado (constitución, regla 13).
- **El costo no se manda a Mercado Libre.** La estimación del RF-4 respeta el permiso "ver costos y márgenes" (constitución, regla 17).
- **Los datos de publicación son propios de la publicación.** Cambiar después el nombre o la foto del producto en el catálogo no cambia la publicación.
- **Sin conexión no se publica.** Si la cuenta no está conectada o requiere reconexión (spec 019), las acciones de esta spec se bloquean con un mensaje que lo explica.
- **Condiciones que impone Mercado Libre** (ver investigación, sección 1.4): categoría sugerida, características obligatorias por categoría, requisitos de fotos y medidas reales del embalaje.

## 6. Permisos

Esta spec agrega el módulo **Mercado Libre** a la matriz de permisos (spec 002).

| Acción | Quién puede |
|---|---|
| Ver publicaciones y su estado | Permiso "ver" en Mercado Libre |
| Cargar o editar datos de publicación, pausar y reactivar | Permiso "editar" en Mercado Libre |
| Publicar | Permiso "crear" en Mercado Libre |
| Finalizar una publicación | Permiso "anular" en Mercado Libre |
| Vincular una publicación existente | Permiso "crear" en Mercado Libre |
| Deshacer un vínculo | Permiso "anular" en Mercado Libre |
| Cambiar el precio en Mercado Libre | Permiso "editar" en Mercado Libre, además del permiso especial "cambiar precios" |
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
- **Se intenta reactivar una publicación finalizada:** no se puede; se ofrece publicar de nuevo con los datos guardados.
- **Producto con stock negativo:** se publica con cantidad 0 (spec 021).
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.
- **La categoría elegida cambia sus requisitos con el tiempo:** al editar, el sistema vuelve a pedir lo que falte.
- **El código de la publicación coincide con más de un producto, o varias publicaciones con el mismo producto:** no hay propuesta automática; se resuelve a mano.
- **La publicación no tiene código cargado:** se vincula a mano (RF-22).
- **Se intenta vincular a un producto que ya tiene publicación vigente:** se rechaza.
- **Publicación finalizada en Mercado Libre:** no aparece para vincular.
- **Publicación con envío desde el depósito de Mercado Libre:** no se puede vincular; está fuera de alcance.
- **La cuenta tiene muchas publicaciones:** la pantalla las trae por tandas.
- **Se vincula con el stock del sistema desactualizado:** la advertencia del RF-24 muestra el cambio de cantidad antes de confirmar.

## 8. Criterios de aceptación

- [ ] Se cargan los datos de publicación de un producto y se guardan sin publicar.
- [ ] El sistema sugiere la categoría y arma el formulario de características según la categoría elegida.
- [ ] No se puede publicar con datos obligatorios faltantes, y el sistema indica cuáles.
- [ ] Un producto con todos sus datos se publica y aparece activo, con enlace a Mercado Libre.
- [ ] Un producto con código de barras generado por el sistema se publica sin enviar ese código.
- [ ] Se ve la estimación de lo que cobra Mercado Libre antes de publicar.
- [ ] Editar el precio en Mercado Libre no cambia el precio de mostrador, exige el permiso especial y queda registrado.
- [ ] Pausar, reactivar y finalizar se reflejan en Mercado Libre y en el sistema.
- [ ] Desactivar un producto en el catálogo pausa su publicación.
- [ ] Una publicación observada o pausada por Mercado Libre cambia de estado en el sistema y genera un aviso.
- [ ] La pantalla de publicaciones filtra por estado y busca por nombre o código.
- [ ] Un usuario sin el permiso correspondiente no puede publicar ni finalizar, ni desde la interfaz ni llamando directo al servidor.
- [ ] Una publicación creada directamente en Mercado Libre, con el código de barras del producto cargado como SKU, aparece con su propuesta de vínculo y se vincula al confirmar.
- [ ] Una publicación sin código se vincula a mano.
- [ ] Al vincular, el sistema adopta el precio de la publicación y envía la cantidad según su stock.
- [ ] Una publicación con variantes no se puede vincular.
- [ ] Deshacer un vínculo deja la publicación intacta en Mercado Libre y sin sincronizar.
- [ ] Hay pruebas unitarias de: validación de datos obligatorios, decisión de enviar o no el código universal, cálculo de la estimación, y propuesta de vínculo (coincidencia única, múltiple y sin coincidencia).
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

1. **Título en el modelo nuevo de Mercado Libre.** La documentación dice que en el modelo nuevo el título no se envía y Mercado Libre lo arma. Hay que ver en la prueba técnica si el usuario escribe un título o solo un nombre de producto. Puede cambiar el RF-2.
2. **Modalidad de envío.** ¿Despacho en sucursal, colecta o envío en el día? ¿Se ofrece retiro en el local? Define qué se configura al publicar y lo que cobra Mercado Libre.
3. **Garantía por defecto.** ¿Qué garantía ofrece el negocio y por cuánto tiempo?
4. **Tipo de publicación por defecto.** ¿Sin cuotas o con cuotas?
5. **Fichas de producto de Mercado Libre.** En algunas categorías Mercado Libre empuja a publicar sobre una ficha ya armada del producto. Queda fuera de esta versión salvo que la prueba técnica muestre que es obligatorio para los productos del cliente.
6. **Cambios hechos en Mercado Libre.** El RF-17 propone avisar y no pisar. ¿O el sistema debe imponer siempre su precio?
