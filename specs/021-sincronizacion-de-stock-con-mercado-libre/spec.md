# Spec 021 — Sincronización de stock con Mercado Libre

| | |
|---|---|
| **Estado** | Verificada (2026-11-19) |
| **Depende de** | 005, 020 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance"); `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.5 |

## 1. Objetivo

Que la cantidad disponible de cada publicación de Mercado Libre sea siempre el stock del sistema, para no vender en Mercado Libre lo que ya se vendió en el mostrador.

## 2. Alcance

**Incluye:**

- Enviar a Mercado Libre la cantidad cada vez que cambia el stock de un producto con publicación vigente.
- Un control completo, diario y a pedido, que corrige las diferencias.
- Un aviso en la campanita mientras haya cambios sin enviar a Mercado Libre.
- En la pantalla de publicaciones (spec 020), la cantidad publicada de cada producto y si está pendiente.

**No incluye:**

- Descontar el stock por una venta de Mercado Libre: es la spec 022. Esta spec solo se ocupa de lo que se le informa a Mercado Libre.
- Stock de reserva *(decisión del cliente, 2026-11-19)*: se publica el stock completo.
- Reservar stock para pedidos por encargo (decisión 0002: los pedidos no reservan).
- Depósitos múltiples y el depósito de Mercado Libre (Full).
- Tomar el stock desde Mercado Libre: el sistema nunca toma como cierto el stock que diga Mercado Libre.

## 3. Historias de usuario

- Como **dueño**, quiero que al vender en el mostrador baje sola la cantidad en Mercado Libre, para no vender dos veces la misma unidad.
- Como **dueño**, quiero que al ingresar mercadería se reactive sola la publicación que estaba sin stock, para no perder ventas.
- Como **dueño**, quiero saber si algún producto quedó sin sincronizar, para corregirlo antes de que genere un problema.
- Como **dueño**, quiero poder forzar una sincronización completa, para quedarme tranquilo después de un conteo o una caída.

## 4. Requisitos funcionales

- **RF-1.** La cantidad que se publica de un producto es su stock actual, y nunca menos de cero *(decisión del cliente, 2026-11-19: sin stock de reserva)*.
- **RF-2.** Con 0 unidades el producto deja de venderse en Mercado Libre: Mercado Libre pausa la publicación por falta de stock y la reactiva sola cuando vuelve a tener unidades. Una publicación pausada por el dueño no se reactiva por tener stock.
- **RF-3.** Cada movimiento de stock de un producto con publicación vigente dispara el envío de la cantidad nueva a Mercado Libre: venta, anulación de venta, entrega de pedido, ingreso de mercadería, ajuste, merma y conteo físico. *(La importación de productos no aparece: solo crea productos nuevos, que todavía no tienen publicación.)*
- **RF-4.** El envío no demora ni condiciona la operación que lo originó. Una venta de mostrador se confirma igual aunque Mercado Libre no responda.
- **RF-5.** Lo que se envía es siempre la cantidad total del RF-1, nunca una diferencia. Enviar dos veces lo mismo no cambia nada.
- **RF-6.** Si el envío falla, la publicación queda como "pendiente de enviar" y se vuelve a intentar en cada una de estas ocasiones: el próximo movimiento de ese producto, el próximo aviso de Mercado Libre, el control diario y la sincronización manual. Es la misma bandeja de envíos que usa el precio (spec 020).
- **RF-7.** Mientras haya publicaciones con cambios sin enviar (cantidad, precio o pausa), la campanita muestra un solo aviso con la cantidad. Desaparece solo cuando no queda ninguna.
- *(Agregado 2026-11-20, spec 013, sección 11.)* Este aviso va en la pestaña **Mercado Libre** de la campanita.
- **RF-8.** Una vez por día, el sistema recorre todas las publicaciones vigentes, compara la cantidad que tiene Mercado Libre con la que corresponde y corrige las diferencias.
- **RF-9.** La pantalla de publicaciones tiene un botón "Sincronizar ahora" que envía lo pendiente y hace el control del RF-8 en el momento, y muestra el resultado: cuántas se revisaron, cuántas se corrigieron y cuáles fallaron. Reemplaza al botón "Reintentar envíos" de la spec 020.
- **RF-10.** La pantalla de publicaciones muestra, por producto, la cantidad publicada en Mercado Libre y si está pendiente de enviar.
- **RF-11.** Cuando Mercado Libre avisa que una publicación cambió y su cantidad no es la que corresponde, **manda el sistema**:
  - si Mercado Libre tiene **más**, se corrige en el momento;
  - si Mercado Libre tiene **menos**, no se sube en el momento, porque puede ser una venta de Mercado Libre que el sistema todavía no registró (spec 022). Cuando se registra, los dos números coinciden. Si no, lo corrige el control diario o "Sincronizar ahora".

## 5. Reglas de negocio

- **El stock del sistema es la fuente de verdad** (`docs/PROJECT.md`, sección 5). Mercado Libre recibe el número; nunca lo define.
- **El stock sigue saliendo de los movimientos** (constitución, regla 7). Esta spec no crea ni modifica movimientos de stock: solo los lee.
- **El stock negativo se publica como cero.** El sistema permite stock negativo a propósito (spec 005); hacia Mercado Libre no existe.
- **Los pedidos por encargo no restan** de la cantidad publicada (decisión 0002).
- **Los cambios de cantidad no avisan en la campanita**, igual que las pausas por falta de stock (spec 020, RF-14): los provoca el propio sistema.
- **Sin stock de reserva se acepta un riesgo chico de vender dos veces la última unidad** *(decisión del cliente, 2026-11-19)*. Entre una venta de mostrador y la actualización en Mercado Libre pasan unos segundos en los que alguien puede comprar la misma unidad, y al revés. Qué pasa cuando ocurre lo define la spec 022.
- **No vender por Mercado Libre con esta spec andando y sin la 022.** Hasta que existan las órdenes, el sistema no se entera de las ventas de Mercado Libre: su stock no baja y el control diario volvería a ofrecer unidades ya vendidas. *(Resuelto el 2026-11-19 con la spec 022: las compras de Mercado Libre bajan el stock solas.)*
- **Plan gratuito de hosting** (`docs/PROJECT.md`, sección 10): el control completo automático corre una vez por día. Una publicación pendiente puede pasar horas con una cantidad equivocada si nadie mueve el producto ni toca "Sincronizar ahora". El aviso del RF-7 existe para que eso no pase desapercibido.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver la cantidad publicada y los pendientes | Permiso "ver" en Mercado Libre |
| Sincronizar ahora | Permiso "editar" en Mercado Libre |
| Ver el aviso de pendientes | Permiso "ver" en Mercado Libre |

El envío automático no depende de los permisos de quien hizo el movimiento: un cajero sin acceso a Mercado Libre vende, y la cantidad se actualiza igual.

## 7. Casos borde y errores

- **Mercado Libre no responde o limita las consultas:** la publicación queda pendiente (RF-6) y la operación original no se ve afectada.
- **La conexión requiere reconexión (spec 019):** todos los envíos fallan y quedan pendientes. Al reconectar, el sistema ejecuta un control completo.
- **Dos movimientos del mismo producto casi a la vez:** como se envía el total y se lee el stock en el momento del envío (RF-5), queda el valor más reciente.
- *(Quitado 2026-11-19 por la prueba técnica: el rechazo por «stock modificado en el medio» es de la API de stock con número de versión, que no se usa; la cantidad va por la publicación.)*
- **Producto con publicación finalizada o sin publicar:** no se envía nada.
- **Publicación pausada por el dueño:** la cantidad se actualiza igual, para que esté correcta cuando se reactive, y sigue pausada.
- **Producto desactivado en el catálogo** (spec 020, RF-18): su publicación está pausada; la cantidad se actualiza igual.
- **Una venta de Mercado Libre baja el stock (spec 022):** el sistema registra su movimiento y envía el total; coincide con lo que Mercado Libre ya descontó por su cuenta.
- **El control diario falla:** queda registrado y el aviso de pendientes se mantiene. Se puede ejecutar a mano.
- **Un conteo físico que cambia muchos productos a la vez:** se envían todos; los que fallen quedan pendientes.

## 8. Criterios de aceptación

- [x] Una venta de mostrador de un producto publicado baja la cantidad en Mercado Libre. *(Usuario.)*
- [x] Anular esa venta vuelve a subirla. *(Usuario.)*
- [x] Un ingreso de mercadería sube la cantidad y reactiva una publicación pausada por falta de stock. *(Usuario, y prueba técnica para la reactivación.)*
- [x] Un ajuste, una merma, un conteo físico y la entrega de un pedido actualizan la cantidad. *(Usuario y script.)*
- [x] Con stock 0 o negativo se publica 0 y la publicación queda pausada sin stock. *(Usuario con 0; prueba unitaria con negativo.)*
- [x] Con Mercado Libre caído, la venta de mostrador se confirma igual, la publicación queda pendiente y aparece el aviso. *(Por diseño y script: la marca se guarda en la transacción de la venta y el envío corre después de responder; el aviso aparece con una marca de más de 2 minutos. No se cortó la red de verdad.)*
- [x] "Sincronizar ahora" corrige una cantidad cambiada a mano en Mercado Libre y deja los pendientes en cero. *(Script.)*
- [x] Una cantidad subida a mano en Mercado Libre se corrige al llegar el aviso; una bajada, no se sube en el momento. *(Script.)*
- [x] Una publicación pausada por el dueño no se reactiva al ingresar stock. *(Script y prueba técnica.)*
- [x] Hay pruebas unitarias del cálculo de la cantidad a publicar (negativos, cero), de la decisión ante una cantidad distinta en Mercado Libre y de qué publicaciones sincronizar.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Preguntas abiertas

**Respondidas por el cliente (2026-11-19):**

- No se usa stock de reserva: se publica el stock completo. Los riesgos están en la sección 5.
- El stock del sistema manda siempre, y las ventas de Mercado Libre lo descuentan solas (spec 022).
- Con 0 unidades la publicación deja de venderse (RF-2).

**Para la prueba técnica** *(hecha el 2026-11-19, ver `prueba-tecnica.md`)*:

1. Cambiar la cantidad de una publicación del modelo nuevo con `PUT /items/{id}` y `available_quantity`, o si hace falta la API de stock del producto (`/user-products/{id}/stock`) con su número de versión.
2. Que una publicación pausada por falta de stock se reactive sola al recibir unidades.
3. Que una pausada por el dueño siga pausada al recibir unidades.
4. Qué aviso llega cuando cambia la cantidad.
