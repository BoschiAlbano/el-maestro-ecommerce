# Spec 020 — Vincular y administrar publicaciones de Mercado Libre

| | |
|---|---|
| **Estado** | Verificada (2026-11-19) |
| **Depende de** | 004, 019 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.4 |

## 1. Objetivo

Que cada publicación de Mercado Libre quede conectada con su producto del sistema, con el mismo precio en los dos lados, y que el dueño vea y administre desde el sistema el estado de esas publicaciones.

*(Cambio 2026-11-12.)* La spec original juntaba dos cosas: **vincular y administrar** publicaciones que ya existen, y **publicar** productos nuevos desde el sistema. Se separaron:

- **Esta spec (020):** vincular, ver el estado, cambiar el precio, pausar, reactivar y finalizar. Se puede probar ya con la cuenta de prueba, y es lo que necesitan la sincronización de stock (021) y las órdenes (022).
- **Spec 025:** publicar un producto desde el sistema (categoría, características, fotos, medidas, estimación de costos). Depende de que Mercado Libre habilite el modelo nuevo de publicación en la cuenta de prueba, y queda para después de la 022.

Las publicaciones se crean, por ahora, directamente en Mercado Libre. El sistema las toma desde ahí.

## 2. Alcance

**Incluye:**

- Un campo **SKU** en cada producto del catálogo, que se mantiene igual al SKU de su publicación en Mercado Libre.
- Vincular las publicaciones de la cuenta conectada con productos del sistema: con propuesta automática cuando coinciden los códigos, y a mano cuando no.
- Deshacer un vínculo.
- Una pantalla con los productos vinculados y el estado de su publicación.
- **Un solo precio** *(decisión del cliente, 2026-11-12)*: el precio de venta del producto es también el de su publicación. Si cambia en el sistema se envía a Mercado Libre, y si cambia en Mercado Libre se toma como nuevo precio de venta del producto.
- Pausar, reactivar y finalizar una publicación desde el sistema.
- Reflejar en el sistema lo que pasa con la publicación en Mercado Libre: observarla, pausarla, reactivarla o darla de baja.

**No incluye:**

- Crear publicaciones desde el sistema y editar su contenido (título, descripción, fotos, características, garantía, medidas): spec 025. Mientras tanto se editan en Mercado Libre.
- La cantidad disponible que se publica y su actualización (spec 021). Esta spec solo la envía una vez, al vincular.
- Las ventas que llegan por la publicación (spec 022).
- Crear productos en el catálogo del sistema a partir de publicaciones de Mercado Libre: el producto tiene que existir antes en el sistema.
- Publicaciones con variantes (talles, colores) y publicaciones con envío desde el depósito de Mercado Libre (Full).
- Cargar el SKU desde la importación de productos por Excel.
- Promociones, cupones, publicidad, preguntas de compradores y el resto de lo listado en "Fuera de alcance" de `docs/PROJECT.md`.

## 3. Historias de usuario

- Como **dueño**, quiero que las publicaciones que cargué en Mercado Libre queden conectadas con mis productos del sistema, para que sus ventas descuenten mi stock.
- Como **dueño**, quiero cargar el SKU en el producto y que sea el mismo en Mercado Libre, para identificar el producto igual en los dos lados.
- Como **dueño**, quiero ver en una sola pantalla qué está publicado y en qué estado, para saber si algo quedó pausado u observado.
- Como **dueño**, quiero cambiar el precio desde el sistema o desde Mercado Libre y que quede igual en los dos lados, para no tener que cargarlo dos veces ni vender a dos precios distintos.
- Como **dueño**, quiero pausar o finalizar una publicación desde el sistema, para dejar de vender un producto sin entrar a Mercado Libre.
- Como **dueño**, quiero enterarme si Mercado Libre observa o da de baja una publicación, para corregirla.

## 4. Requisitos funcionales

**SKU del producto**

- **RF-1.** Cada producto del catálogo tiene un campo **SKU**, opcional, de letras y números, que puede llevar guiones, guiones bajos, puntos y barras (por ejemplo `ODOO-TEST-001`), sin espacios y de hasta 50 caracteres. No se puede repetir entre productos (sin distinguir mayúsculas). *(Corregido 2026-11-16: la versión aprobada decía solo letras y números, y habría rechazado los SKU con guiones, que son los más comunes.)*
- **RF-2.** El SKU se carga y se edita en la ficha del producto (spec 004) y se puede buscar en la pantalla de publicaciones y al vincular.
- **RF-3.** Si el producto tiene una publicación vinculada, el SKU se mantiene igual en los dos lados: un cambio en el sistema se envía a Mercado Libre, y un cambio hecho en Mercado Libre se toma en el sistema. Si el SKU que llega de Mercado Libre ya lo usa otro producto, no se toma: la pantalla de publicaciones lo señala para que el dueño lo resuelva.

**Vincular publicaciones**

- **RF-4.** Una pantalla "Vincular publicaciones" trae las publicaciones de la cuenta conectada que todavía no están vinculadas, con su foto, título, precio, cantidad, estado y SKU.
- **RF-5.** El sistema propone el producto que corresponde a cada publicación cuando el **SKU** de la publicación coincide con el SKU de un producto, o, si el producto no tiene SKU, con su código de barras. También cuando coincide el código universal de la publicación con el código de barras. Si hay una única coincidencia, la muestra como propuesta lista para confirmar.
- **RF-6.** El usuario confirma las propuestas, de a una o todas juntas. Nada se vincula sin confirmación.
- **RF-7.** Las publicaciones sin coincidencia se vinculan a mano, buscando el producto por nombre, código de barras o SKU.
- **RF-8.** Al vincular:
  - el sistema envía a Mercado Libre el **precio de venta** del producto. Antes de confirmar, la pantalla muestra el precio que tiene hoy la publicación y el que va a quedar;
  - guarda como referencia el título, la foto principal, la categoría y el enlace de la publicación;
  - deja el SKU igual en los dos lados: si el producto tiene SKU, se envía a Mercado Libre; si no tiene y la publicación sí, el producto toma el de la publicación;
  - envía a Mercado Libre la cantidad disponible que corresponde según el stock del sistema (spec 021, RF-1). Antes de confirmar, la pantalla muestra la cantidad que tiene hoy la publicación y la que va a quedar.
- **RF-9.** Un vínculo se puede **deshacer**. La publicación sigue en Mercado Libre tal como está y el sistema deja de administrarla.
- **RF-10.** Mientras haya publicaciones activas sin vincular, la pantalla de publicaciones lo advierte: esas publicaciones venden sin descontar stock del sistema.

**Estado y precio**

- **RF-11.** Una pantalla "Publicaciones" lista los productos vinculados con: foto, nombre, SKU, precio, stock, estado de la publicación y un enlace para verla en Mercado Libre. Se filtra por estado y se busca por nombre, código de barras o SKU.
- **RF-12.** Los estados que muestra el sistema son: activa, pausada, pausada sin stock, observada por Mercado Libre y finalizada.
- **RF-13.** Cualquier cambio del precio de venta de un producto vinculado se envía a Mercado Libre: desde la ficha del producto o desde un ingreso de mercadería (spec 006). *(Corregido 2026-11-16: la importación por Excel no aparece porque solo crea productos nuevos y rechaza los que ya existen, así que nunca cambia el precio de un producto vinculado.)* El cambio de precio en el sistema no espera ni depende de Mercado Libre: si no responde, se reintenta y la pantalla de publicaciones lo señala como pendiente.
- **RF-14.** Cuando el precio o el estado de una publicación cambian en Mercado Libre (desde su web, su aplicación o por una decisión de Mercado Libre), el sistema los toma: el precio pasa a ser el nuevo precio de venta del producto, y el estado se actualiza. Si Mercado Libre la observa, la pausa o la da de baja, muestra el motivo que informe Mercado Libre. *(Cambio 2026-11-16, pedido del cliente: antes solo avisaba lo que decidía Mercado Libre.)* **Todo cambio que llega de Mercado Libre genera un aviso en la campanita**: precio, SKU, pausar, reactivar, finalizar, observar o dar de baja, con el detalle de qué cambió. No avisan las pausas por falta de stock ni la vuelta a activa cuando vuelve a haber stock, porque las provoca el propio sistema al cambiar la cantidad (spec 021). Los cambios que hace el sistema tampoco avisan.
- *(Agregado 2026-11-19, spec 021.)* El botón «Reintentar envíos» de la pantalla de publicaciones pasó a ser «Sincronizar ahora»: además de enviar lo pendiente, revisa las cantidades de todas las publicaciones. La pantalla suma la columna «En Mercado Libre» con la cantidad publicada.
- **RF-14b.** *(Agregado 2026-11-16, pedido del cliente.)* La pantalla de publicaciones se actualiza sola cada 60 segundos y al volver a la pestaña, y tiene un botón «Actualizar». Cada actualización refresca también la campanita.
- **RF-15.** Cada cambio de precio queda en el historial de precios del producto (spec 004) con su origen: el usuario del sistema que lo cambió, o "Mercado Libre" si llegó desde ahí, y cuándo.

**Pausar, reactivar y finalizar**

- **RF-16.** Una publicación se puede **pausar** y **reactivar** desde el sistema. Pausada no se puede comprar y conserva su historial.
- **RF-17.** Una publicación se puede **finalizar**, con confirmación. Es definitivo: queda en el sistema como finalizada y el producto queda libre para vincular otra publicación.
- **RF-18.** Si un producto se desactiva en el catálogo, su publicación se pausa sola. Al reactivarlo, la publicación sigue pausada hasta que alguien la reactive.

## 5. Reglas de negocio

- **Vincular conserva la publicación.** Es la misma publicación de Mercado Libre, con sus ventas, opiniones y posición.
- **Un producto, una publicación vigente.** Si dos publicaciones corresponden al mismo producto, solo una se puede vincular; la otra queda sin vincular para que el dueño decida qué hacer con ella en Mercado Libre.
- **Un solo precio, igual en los dos lados, y manda el último cambio** *(decisión del cliente, 2026-11-12)*. El precio de venta del producto es el de mostrador y el de Mercado Libre. Si cambia en Mercado Libre, el sistema lo toma; si cambia en el sistema, se envía a Mercado Libre. Lo mismo con el SKU. La comisión de Mercado Libre no se suma al precio: si el dueño quiere cubrirla, sube el precio del producto.
- **Al vincular manda el sistema** para el precio, el SKU y la cantidad: la publicación queda con los datos del producto. La pantalla muestra lo que cambia antes de confirmar.
- **Al vincular manda el stock del sistema** (spec 021). El inventario tiene que estar al día antes de vincular: si el sistema dice 0, la publicación queda pausada por falta de stock.
- **Todo en pesos y con `Decimal`** (constitución, reglas 5 y 6).
- **Cambiar el precio desde el sistema sigue requiriendo el permiso especial "cambiar precios"** y queda registrado (constitución, regla 13). Un cambio que llega de Mercado Libre no pasa por permisos del sistema, pero también queda registrado.
- **Sin conexión no se administra.** Si la cuenta no está conectada o requiere reconexión (spec 019), las acciones de esta spec se bloquean con un mensaje que lo explica.
- **Funciona con los dos modelos de publicación de Mercado Libre.** Vincular y administrar no dependen de que la cuenta esté en el modelo nuevo; publicar desde el sistema (spec 025), sí.

## 6. Permisos

Esta spec agrega el módulo **Mercado Libre** a la matriz de permisos (spec 002).

| Acción | Quién puede |
|---|---|
| Ver publicaciones y su estado | Permiso "ver" en Mercado Libre |
| Pausar y reactivar | Permiso "editar" en Mercado Libre |
| Cambiar el precio | Los mismos permisos que hoy para cambiar el precio de venta (spec 004); no hace falta ninguno de Mercado Libre |
| Vincular una publicación | Permiso "crear" en Mercado Libre |
| Finalizar una publicación y deshacer un vínculo | Permiso "anular" en Mercado Libre |
| Cargar o cambiar el SKU de un producto | Permiso "editar" en Catálogo (spec 004) |

## 7. Casos borde y errores

- **El SKU de la publicación coincide con más de un producto, o varias publicaciones con el mismo producto:** no hay propuesta automática; se resuelve a mano.
- **La publicación no tiene SKU ni código universal:** se vincula a mano.
- **Se intenta vincular a un producto que ya tiene publicación vigente:** se rechaza.
- **Al vincular, el producto y la publicación tienen SKU o precio distintos:** manda el del sistema y se envía a Mercado Libre; la pantalla lo muestra antes de confirmar.
- **El SKU que llega de Mercado Libre ya lo usa otro producto, o no cumple el RF-1** (por ejemplo, tiene espacios): no se toma; se señala en la pantalla de publicaciones (RF-3).
- **Publicación finalizada en Mercado Libre:** no aparece para vincular.
- **Publicación con variantes o con envío desde el depósito de Mercado Libre:** no se puede vincular; la pantalla lo indica y la deja fuera.
- **La cuenta tiene muchas publicaciones:** la pantalla las trae por tandas.
- **Se vincula con el stock del sistema desactualizado:** la advertencia del RF-8 muestra el cambio de cantidad antes de confirmar.
- **El precio cambia en los dos lados casi al mismo tiempo:** queda el último que llega. Los dos cambios quedan registrados (RF-15).
- **Mercado Libre no responde al cambiar el precio:** el precio cambia igual en el sistema (una venta de mostrador no puede quedar con el precio viejo) y el envío a Mercado Libre queda pendiente y se reintenta (RF-13).
- **Mercado Libre no responde al pausar, reactivar, finalizar o cambiar el SKU:** el cambio no se guarda en el sistema y se muestra el error; nada queda a medias.
- **Un aviso de Mercado Libre se pierde:** el control diario de la spec 019 lo recupera dentro de los 2 días; el precio y el estado se vuelven a leer en ese momento.
- **Se intenta reactivar una publicación finalizada:** no se puede; hay que crear una nueva en Mercado Libre y vincularla.
- **Producto con stock negativo:** se vincula con cantidad 0 (spec 021).
- **Un usuario sin permiso llama a la acción directo al servidor:** se rechaza.

## 8. Criterios de aceptación

- [x] Un producto tiene SKU, que no se puede repetir entre productos. *(Usuario, y prueba en la base.)*
- [x] Una publicación creada en Mercado Libre con el SKU de un producto aparece con su propuesta de vínculo y se vincula al confirmar. *(Usuario, con el cable y el reloj.)*
- [x] Una publicación sin SKU propone el vínculo por el código de barras, si coincide. *(Prueba unitaria: la cuenta no tiene publicaciones sin SKU.)*
- [x] Una publicación sin coincidencia se vincula a mano. *(Script: el buscador encuentra productos libres y marca los vinculados; vincular usa la misma acción que la propuesta.)*
- [x] Al vincular, la publicación queda con el precio de venta, el SKU y la cantidad del sistema, y la pantalla muestra lo que cambia antes de confirmar. *(Usuario y script.)*
- [x] Una publicación con variantes no se puede vincular. *(Prueba unitaria: la cuenta no tiene publicaciones con variantes.)*
- [x] Deshacer un vínculo deja la publicación intacta en Mercado Libre y sin administrar. *(Script.)*
- [x] Cambiar el precio de venta en el sistema (ficha o ingreso de mercadería) lo cambia en Mercado Libre y queda registrado. *(Usuario y script, desde la ficha. El ingreso usa la misma bandeja de envíos.)*
- [x] Cambiar el precio o el SKU directamente en Mercado Libre los cambia en el sistema, y el cambio queda registrado como hecho en Mercado Libre. *(Usuario y script.)*
- [x] Si Mercado Libre no responde, el precio cambia igual en el sistema y el envío queda pendiente hasta que se completa. *(Por diseño y script: el precio se guarda en la transacción, antes de llamar a Mercado Libre, y un envío pendiente se completa y gana. No se cortó la red de verdad.)*
- [x] Pausar, reactivar y finalizar desde el sistema se reflejan en Mercado Libre, y al revés. *(Usuario.)*
- [x] Desactivar un producto en el catálogo pausa su publicación. *(Script.)*
- [x] Un cambio hecho en Mercado Libre (precio, SKU o estado) se refleja en el sistema y genera un aviso en la campanita; uno hecho desde el sistema, o una pausa por falta de stock, no. *(Usuario y pruebas unitarias.)*
- [x] La pantalla de publicaciones se actualiza sola y con el botón «Actualizar». *(Usuario.)*
- [x] La pantalla de publicaciones filtra por estado, busca por nombre, código o SKU, y advierte si hay publicaciones activas sin vincular. *(Script para filtros y búsqueda; el aviso de activas sin vincular, por revisión.)*
- [x] Un usuario sin el permiso correspondiente no puede vincular ni finalizar, ni desde la interfaz ni llamando directo al servidor. *(Script: las seis acciones rechazan a un usuario sin permiso en el servidor. La interfaz oculta lo que no corresponde según el permiso.)*
- [x] Hay pruebas unitarias de: propuesta de vínculo (coincidencia única, múltiple y sin coincidencia, por SKU y por código de barras), validación del SKU, decisión de qué lado manda al vincular, y cambio de estado según lo que informa Mercado Libre.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

**Respondidas por el cliente (2026-11-12):**

- Hoy no tiene publicaciones en Mercado Libre. La cuenta de prueba tiene una.
- El SKU de Mercado Libre admite letras y números: se agrega el campo SKU al producto (RF-1).
- No usa el depósito de Mercado Libre (Full).
- Si el precio cambia en Mercado Libre, el sistema lo toma, y al revés.
- Hay **un solo precio**: el de venta del producto es también el de Mercado Libre. No hay un precio propio para Mercado Libre.

**Para la prueba técnica:**

1. Listar las publicaciones de la cuenta, leer y escribir el SKU (la característica `SELLER_SKU`) y su largo máximo.
2. Buscar una publicación por SKU.
3. Pausar, reactivar y finalizar, y qué aviso llega en cada caso.
4. Qué aviso llega cuando el precio o el SKU se cambian desde la web de Mercado Libre.
5. Cómo se ven en la API una publicación con variantes, una de catálogo y una del modelo nuevo (si la cuenta de prueba ya lo tiene).
