# Spec 021 — Sincronización de stock con Mercado Libre

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 005, 020 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.5 |

## 1. Objetivo

Que la cantidad disponible de cada publicación de Mercado Libre refleje siempre el stock real del sistema, para no vender en Mercado Libre lo que ya se vendió en el mostrador.

## 2. Alcance

**Incluye:**

- Enviar a Mercado Libre la cantidad disponible cada vez que cambia el stock de un producto publicado.
- Un control completo, diario y a pedido, que corrige cualquier diferencia.
- Un stock de reserva opcional, para no publicar las últimas unidades.
- Aviso en la campanita cuando hay productos cuyo stock no se pudo enviar.
- Una vista de qué productos están al día y cuáles pendientes.

**No incluye:**

- Descontar el stock por una venta de Mercado Libre: eso es la spec 022. Esta spec solo se ocupa de lo que se le informa a Mercado Libre.
- Reservar stock para pedidos por encargo (decisión 0002: los pedidos no reservan).
- Depósitos múltiples y el depósito de Mercado Libre.
- Traer stock desde Mercado Libre: el sistema nunca toma como cierto el stock que diga Mercado Libre.

## 3. Historias de usuario

- Como **dueño**, quiero que al vender en el mostrador baje sola la cantidad en Mercado Libre, para no vender dos veces la misma unidad.
- Como **dueño**, quiero que al ingresar mercadería se reactive sola la publicación que estaba sin stock, para no perder ventas.
- Como **dueño**, quiero guardarme algunas unidades fuera de Mercado Libre, para tener margen ante una venta simultánea.
- Como **dueño**, quiero saber si algún producto quedó sin sincronizar, para corregirlo antes de que genere un problema.
- Como **dueño**, quiero poder forzar una sincronización completa, para quedarme tranquilo después de un conteo o una caída.

## 4. Requisitos funcionales

- **RF-1.** La cantidad que se publica de un producto es su stock actual menos el stock de reserva, y nunca menos de cero.
- **RF-2.** El stock de reserva es un número entero, cero por defecto, que se define en Configuración > Mercado Libre y vale para todos los productos.
- **RF-3.** Cada movimiento de stock de un producto con publicación vigente dispara el envío de la cantidad nueva a Mercado Libre: venta, anulación de venta, entrega de pedido, ingreso de mercadería, ajuste, merma, conteo físico e importación.
- **RF-4.** El envío no demora ni condiciona la operación que lo originó. Una venta de mostrador se confirma igual aunque Mercado Libre no responda.
- **RF-5.** Lo que se envía es siempre la cantidad total calculada con el RF-1, nunca una diferencia. Enviar dos veces lo mismo no cambia nada.
- **RF-6.** Si el envío falla, se reintenta en el momento. Si sigue fallando, el producto queda como "pendiente de sincronizar" y se vuelve a intentar en cada una de estas ocasiones: el próximo movimiento de ese producto, el control diario y la sincronización manual.
- **RF-7.** Mientras haya productos pendientes de sincronizar, la campanita muestra un aviso con la cantidad. Desaparece solo cuando no queda ninguno.
- **RF-8.** Una vez por día, el sistema recorre todas las publicaciones vigentes, compara la cantidad que tiene Mercado Libre con la que corresponde y corrige las diferencias.
- **RF-9.** Configuración > Mercado Libre tiene un botón "Sincronizar stock ahora" que hace el mismo control del RF-8 en el momento y muestra el resultado: cuántas se revisaron, cuántas se corrigieron y cuáles fallaron.
- **RF-10.** La pantalla de publicaciones (spec 020) muestra, por producto, la cantidad publicada, la fecha de la última sincronización y si está pendiente.
- **RF-11.** Cuando cambia el stock de reserva, se recalcula y se envía la cantidad de todas las publicaciones vigentes.
- **RF-12.** Si Mercado Libre avisa que una publicación cambió, el sistema vuelve a enviar la cantidad que corresponde. Así se corrige un stock modificado a mano en Mercado Libre.

## 5. Reglas de negocio

- **El stock del sistema es la fuente de verdad** (`docs/PROJECT.md`, sección 5). Mercado Libre recibe el número; nunca lo define.
- **El stock sigue saliendo de los movimientos** (constitución, regla 7). Esta spec no crea ni modifica movimientos de stock: solo los lee.
- **El stock negativo se publica como cero.** El sistema permite stock negativo a propósito (spec 005); hacia Mercado Libre no existe.
- **Con cantidad cero, Mercado Libre pausa la publicación por falta de stock** y la reactiva sola al volver a tener unidades. Una publicación pausada por el dueño (spec 020) no se reactiva por tener stock.
- **Los pedidos por encargo no restan** de la cantidad publicada (decisión 0002).
- **La sincronización reduce el riesgo de sobreventa pero no lo elimina.** Entre una venta de mostrador y la actualización en Mercado Libre pasan instantes en los que alguien puede comprar la misma unidad. El stock de reserva existe para eso. Qué pasa cuando igual ocurre lo define la spec 022.
- **Plan gratuito de hosting** (`docs/PROJECT.md`, sección 10): el control completo corre una vez por día. Un producto que quede pendiente puede pasar hasta un día con una cantidad equivocada en Mercado Libre si nadie lo mueve ni fuerza la sincronización. El aviso del RF-7 existe para que eso no pase desapercibido.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el estado de sincronización | Permiso "ver" en Mercado Libre |
| Sincronizar stock ahora | Permiso "editar" en Mercado Libre |
| Cambiar el stock de reserva | Permiso "editar" en Configuración |
| Ver el aviso de productos pendientes | Permiso "ver" en Mercado Libre |

El envío automático no depende de los permisos de quien hizo el movimiento: un cajero sin acceso a Mercado Libre vende, y el stock se actualiza igual.

## 7. Casos borde y errores

- **Mercado Libre no responde o limita las consultas:** el producto queda pendiente (RF-6) y la operación original no se ve afectada.
- **La conexión requiere reconexión (spec 019):** todos los envíos fallan y quedan pendientes. Al reconectar, el sistema ejecuta un control completo.
- **Dos movimientos del mismo producto casi a la vez:** gana siempre la cantidad calculada más reciente. Como se envía el total (RF-5), el orden de llegada no deja un valor viejo.
- **Mercado Libre rechaza el cambio porque el stock se modificó en el medio:** el sistema vuelve a leer, recalcula y reintenta.
- **El stock de reserva es mayor que el stock real:** se publica cero.
- **Producto con publicación finalizada o sin publicar:** no se envía nada.
- **Publicación pausada por el dueño:** la cantidad se actualiza igual, para que esté correcta cuando se reactive.
- **Una venta de Mercado Libre baja el stock (spec 022):** el sistema registra su movimiento y envía el total calculado; coincide con lo que Mercado Libre ya descontó por su cuenta.
- **El control diario falla:** queda registrado y el aviso de pendientes se mantiene. Se puede ejecutar a mano.
- **Conteo físico o importación que cambia muchos productos a la vez:** se envían todos; los que fallen quedan pendientes.

## 8. Criterios de aceptación

- [ ] Una venta de mostrador de un producto publicado baja la cantidad en Mercado Libre.
- [ ] Anular esa venta vuelve a subirla.
- [ ] Un ingreso de mercadería sube la cantidad y reactiva una publicación pausada por falta de stock.
- [ ] Un ajuste, una merma y un conteo físico actualizan la cantidad.
- [ ] Con stock de reserva 2 y stock 5, se publican 3; con stock 1, se publican 0.
- [ ] Un producto con stock negativo se publica con 0.
- [ ] Con Mercado Libre caído, la venta de mostrador se confirma igual, el producto queda pendiente y aparece el aviso.
- [ ] "Sincronizar stock ahora" corrige una cantidad cambiada a mano en Mercado Libre y deja los pendientes en cero.
- [ ] Una publicación pausada por el dueño no se reactiva al ingresar stock.
- [ ] Hay pruebas unitarias del cálculo de la cantidad a publicar (reserva, negativos, cero) y de la decisión de qué productos sincronizar.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

1. **Stock de reserva.** La propuesta es un único valor para todos los productos, en cero por defecto. ¿Hace falta definirlo por producto?
2. **Reintento mientras se usa el sistema.** Para achicar la espera del plan gratuito, se puede reintentar lo pendiente cada vez que alguien abre la pantalla de publicaciones o la de órdenes. Se decide en el plan.
3. **Productos con poco stock.** ¿Conviene dejar de publicar automáticamente un producto cuando queda una sola unidad? Con el stock de reserva en 1 se logra lo mismo.
