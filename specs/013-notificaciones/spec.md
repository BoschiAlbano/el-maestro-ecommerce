# Spec 013 — Notificaciones

| | |
|---|---|
| **Estado** | Verificada; cambio de la sección 11 verificado (2026-11-20) |
| **Depende de** | 005, 007, 009 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Avisar en pantalla, desde cualquier parte del sistema, lo que requiere atención: un pedido nuevo, una diferencia al cerrar la caja, o productos por debajo del stock que hace falta.


*(Agregado 2026-11-19, spec 022.)* Avisos de órdenes de Mercado Libre: venta nueva, venta que dejó el stock en negativo (destacado), cancelación y riesgo de fraude. Además, avisos calculados que desaparecen solos: órdenes que vencen en menos de 4 horas, con el despacho vencido y con riesgo de fraude sin resolver. Los ve quien tiene «ver» en Mercado Libre.
## 2. Alcance

**Incluye:**

- Aviso de pedido nuevo (al crearse un pedido, spec 009)
- Aviso de diferencia de caja (al cerrar un turno con una diferencia distinta de cero, spec 007)
- Aviso de stock bajo (mientras haya al menos un producto con su disponible real por debajo del mínimo — mismo cálculo que la lista de viaje, spec 012)
- Marcar como leído un aviso de pedido nuevo o de diferencia de caja
- Una campanita visible en todas las pantallas (no solo en el inicio), que se actualiza sola cada un minuto

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md` (sin WhatsApp, email ni push). No incluye un historial de avisos ya leídos: una vez leído, un aviso deja de aparecer en la lista — no hay una pantalla aparte para volver a verlos. No incluye avisos por usuario: marcar un aviso como leído lo marca para todo el equipo.

## 3. Historias de usuario

- Como dueño o empleado, quiero enterarme de un pedido nuevo sin tener que entrar a Pedidos a revisar, para no perderme ninguno.
- Como dueño, quiero enterarme cuando una caja cierra con diferencia, para investigarlo cuanto antes.
- Como dueño, quiero ver de un vistazo, desde cualquier pantalla, si hay productos por debajo del stock que necesito, sin tener que entrar a Inventario.
- Como dueño o empleado, quiero marcar un aviso como leído para que no me siga apareciendo en el contador.

## 4. Requisitos funcionales

- **RF-1.** El sistema genera un aviso de "pedido nuevo" cada vez que se crea un pedido (spec 009).
- **RF-2.** El sistema genera un aviso de "diferencia de caja" cada vez que se cierra un turno con una diferencia distinta de cero (spec 007).
- **RF-3.** El sistema muestra un aviso de "stock bajo" mientras haya al menos un producto con su disponible real por debajo del mínimo (mismo cálculo que la lista de viaje, spec 012) — a diferencia de los otros dos, no es un evento puntual: se actualiza solo a medida que cambia el stock. *(Cambio 2026-10-20: ahora también se puede marcar como leído, ver RF-4b.)*
- **RF-4b.** *(Agregado 2026-10-20.)* El aviso de stock bajo también se puede marcar como leído. Se guardan los productos que estaban por debajo del mínimo en ese momento; el aviso **reaparece solo si queda bajo algún producto que no estaba**. Un producto que se repone y vuelve a bajar cuenta como nuevo. Es global, como los otros avisos.
- **RF-4.** Los avisos de pedido nuevo y de diferencia de caja se pueden marcar como leídos; al marcarlos, dejan de aparecer en la lista y de contar en la campanita.
- **RF-5.** Una campanita, visible desde cualquier pantalla del sistema (no solo el inicio), muestra un número con la cantidad de avisos sin leer y, al abrirla, la lista con el detalle de cada uno.
- **RF-6.** La campanita se actualiza sola cada 60 segundos, sin que el usuario tenga que recargar la página.
- **RF-7.** Cada tipo de aviso respeta el permiso de su propio módulo: pedido nuevo con "ver" en Pedidos, diferencia de caja con "ver" en Caja, stock bajo con "ver" en Inventario — igual criterio que el inicio (spec 012).
- *(Agregado 2026-11-16, spec 020.)* Aviso de **publicación de Mercado Libre**: cuando algo de una publicación vinculada cambia en Mercado Libre (precio, SKU o estado), salvo las pausas por falta de stock. Lo ven quienes tienen "ver" en Mercado Libre y lleva a la pantalla de publicaciones.

## 5. Reglas de negocio

- El número de la campanita cuenta cada aviso de pedido nuevo o diferencia de caja sin leer, más 1 si hay al menos un producto por debajo del stock mínimo (no se cuenta producto por producto, para no mostrar un número exagerado que no sea útil).
- Marcar un aviso como leído es una acción global, no por usuario — el equipo es chico y maneja una sola caja; una vez que alguien lo marca, queda leído para todos.
- El aviso de stock bajo se puede marcar como leído (RF-4b) y desaparece solo cuando deja de haber productos por debajo del mínimo. *(Cambio 2026-10-20: antes nunca se podía marcar y no había forma de quitarlo.)*
- No hay un historial de avisos ya leídos en esta spec.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver y marcar como leído un aviso de pedido nuevo | Permiso "ver" en Pedidos |
| Ver y marcar como leído un aviso de diferencia de caja | Permiso "ver" en Caja |
| Ver el aviso de stock bajo | Permiso "ver" en Inventario |

## 7. Casos borde y errores

- Sin ningún producto por debajo del mínimo: no aparece la línea de stock bajo (ni suma al contador).
- Un pedido se cancela antes de que alguien lea su aviso: el aviso se puede marcar como leído igual; no se borra automáticamente al cancelar el pedido.
- Usuario sin ninguno de los tres permisos: la campanita no muestra ningún número.
- Se intenta marcar como leído un aviso que ya estaba leído: no pasa nada (operación segura de repetir).

## 8. Criterios de aceptación

- [x] Se genera un aviso al crear un pedido.
- [x] Se genera un aviso al cerrar una caja con diferencia distinta de cero.
- [x] El aviso de stock bajo aparece mientras haya productos por debajo del mínimo, y desaparece solo cuando se repone.
- [x] Se puede marcar como leído un aviso de pedido nuevo o de diferencia de caja, y deja de contar en la campanita.
- [x] La campanita es visible desde cualquier pantalla y se actualiza sola, sin recargar, cada 60 segundos.
- [x] Cada tipo de aviso respeta el permiso de su propio módulo.

## 9. Entidades previstas

A confirmar en el plan: `Notification` (tipo, mensaje, referencia a lo que originó el aviso, fecha, fecha de lectura opcional) — solo para los avisos de pedido nuevo y diferencia de caja. El de stock bajo no se persiste: se calcula en vivo con la misma lógica de la lista de viaje (spec 012).

## 10. Decisiones (ya confirmadas con el cliente)

- **El aviso de stock bajo es en vivo, sin leído/no leído** — es una condición que sigue existiendo hasta que se repone el stock, no un evento puntual como los otros dos.
- **La actualización sin recargar es por revisión periódica cada 60 segundos**, no tiempo real — más simple, sin sumar una suscripción en vivo nueva al stack.

## 11. Cambio 2026-11-20: pestañas y diseño de la campanita

*(Pedido del cliente, aprobado el 2026-11-20.)*

**Por qué.** Con Mercado Libre andando, la campanita se llena de ventas, cancelaciones y cambios de publicaciones, y un aviso del local (un pedido nuevo, una diferencia de caja) queda perdido entre ellos. Además todos los avisos se ven iguales: un enlace subrayado, sin fecha ni distinción de lo urgente.

### Requisitos

- **RF-8.** La ventana de la campanita tiene tres pestañas: **Todos**, **Sistema** y **Mercado Libre**. Cada una muestra cuántos avisos sin leer tiene. El número de la campanita sigue siendo el total. Abre en «Todos».
- **RF-9.** Qué va en cada pestaña (todos aparecen también en «Todos»):

  | Sistema | Mercado Libre |
  |---|---|
  | Pedido nuevo | Venta, venta sin stock, cancelación y riesgo de fraude |
  | Diferencia de caja | Despacho por vencer o vencido, y despachadas sin factura subida (spec 024) |
  | Stock bajo | Cambios en publicaciones y envíos pendientes a Mercado Libre (specs 020 y 021) |
  | Facturas pendientes, certificado por vencer y tope del monotributo (spec 023) | Reconexión de la cuenta de Mercado Libre (spec 019) |

- **RF-10.** Quien no ve ningún aviso de Mercado Libre (sin «ver» en Mercado Libre) no ve las pestañas: la campanita queda como una sola lista, como hasta ahora.
- **RF-11.** Cada pestaña tiene **«Marcar todas como leídas»**: marca como leídos los avisos de esa pestaña que el usuario puede ver (en «Todos», los de las dos), incluido el de stock bajo (RF-4b). Los avisos calculados (despacho por vencer, facturas pendientes, envíos pendientes a Mercado Libre) no se marcan: desaparecen solos cuando se resuelve lo que avisan, como hasta ahora.
- **RF-12.** Diseño de cada aviso:
  - un ícono según el tipo (por ejemplo, carrito para una venta, cruz para una cancelación, escudo para el riesgo de fraude, caja registradora para una diferencia de caja);
  - la hora: «hace 5 min», «hace 3 h», «ayer 18:40» o la fecha;
  - toda la fila lleva al lugar del aviso, sin enlace subrayado; «marcar como leído» es un botón chico al costado;
  - los **urgentes** se destacan en rojo: riesgo de fraude, venta sin stock, despacho vencido y reconexión de Mercado Libre;
  - los avisos calculados van arriba, sin hora, con la marca «Ahora».
- **RF-13.** La ventana es más ancha y, si hay muchos avisos, se desplaza por dentro sin tapar la pantalla. Una pestaña sin avisos lo dice: «No hay avisos de Mercado Libre».

### Permisos

Sin cambios, salvo uno *(confirmado por el cliente, 2026-11-20)*: el aviso de **reconexión de Mercado Libre** pasa a verlo todo el que ve la pestaña Mercado Libre (permiso «ver» en Mercado Libre), además de quien tiene «ver» en Configuración. Quien no tiene Configuración ve el aviso con el texto «avisale al Dueño», porque no puede reconectar.

«Marcar todas como leídas» respeta el RF-7: nunca marca un aviso que el usuario no ve.

### Casos borde

- Llega un aviso nuevo mientras la ventana está abierta: aparece en la próxima actualización (cada 60 segundos, RF-6) sin cambiar de pestaña.
- «Marcar todas como leídas» con dos personas a la vez: no pasa nada (marcar como leído es seguro de repetir).
- Un aviso de un tipo nuevo que agregue otra spec sin decidir su pestaña no compila: cada tipo declara su pestaña, como ya declara su permiso.

### Criterios de aceptación

- [x] La ventana tiene las pestañas Todos, Sistema y Mercado Libre, cada una con sus avisos y su contador. *(Revisión manual del cliente, 2026-11-20.)*
- [x] Sin permiso de Mercado Libre no hay pestañas. *(Revisión manual.)*
- [x] «Marcar todas como leídas» marca solo los avisos de esa pestaña que el usuario ve, incluido el de stock bajo, y no toca los calculados. *(Revisión manual y prueba unitaria de `typesToMarkRead`.)*
- [x] Cada aviso muestra su ícono y su hora; los urgentes se ven en rojo; los calculados van arriba con «Ahora». *(Revisión manual.)*
- [x] Toda la fila lleva al lugar del aviso. *(Revisión manual.)*
- [x] Con muchos avisos, la lista se desplaza dentro de la ventana. *(Revisión manual.)*
- [x] Prueba unitaria de la clasificación por pestaña, de los urgentes y del texto de la hora. *(`notification-tabs.test.ts`.)*
