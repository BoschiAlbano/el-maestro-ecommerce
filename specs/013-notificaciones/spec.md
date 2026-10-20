# Spec 013 — Notificaciones

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 005, 007, 009 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Avisar en pantalla, desde cualquier parte del sistema, lo que requiere atención: un pedido nuevo, una diferencia al cerrar la caja, o productos por debajo del stock que hace falta.

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
