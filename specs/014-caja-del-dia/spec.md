# Spec 014 — Caja del día

| | |
|---|---|
| **Estado** | Aprobada (2026-10-20) |
| **Depende de** | 007, 008, 009 (y 012, por el acceso desde el inicio) |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Que el dueño vea **cómo va la caja de un día completo**, sin importar cuántos turnos hubo ni quién los abrió, en una sola pantalla.

Hoy la caja se mira por turno (spec 007). Si el cajero de la mañana cerró y el de la tarde tiene la caja abierta, el dueño tiene que entrar al historial, abrir el turno de la mañana, ir a `/caja` para ver el de la tarde y sumar a ojo. Esta spec elimina ese paso: un resumen del día que junta todos los turnos y, a la vez, deja ver el aporte de cada uno.

## 2. Alcance

**Incluye:**

- Una pantalla `/caja/dia`: **un resumen completo** del día calendario (hoy por defecto, cambiable a cualquier día anterior)
- El **estado actual de la caja** (abierta o cerrada, quién la tiene, cuánto efectivo debería haber ahora)
- Los **totales en efectivo y en transferencia** del día, sumando todos los turnos
- Los **totales de ventas** del día (cantidad, monto, anuladas y cómo se cobraron)
- Desglose por turno: quién lo abrió y lo cerró, horario, monto inicial, efectivo esperado, contado y diferencia
- Resumen por medio de pago (efectivo y transferencia) del día completo
- Lista de todos los movimientos de caja del día, de todos los turnos, en orden cronológico
- Acceso desde `/caja` y desde la fila "Hoy" del inicio (spec 012)

**No incluye:**

- Un **cierre del día**. La caja sigue cerrándose por turno (spec 007); esta pantalla es solo de lectura y no cierra, corrige ni edita nada.
- Rangos de fechas, comparaciones, gráficos de evolución ni productos más vendidos: eso es Analíticas (spec 011).
- Costos ni márgenes (constitución, regla 17): la pantalla solo muestra lo cobrado, no la ganancia.
- Exportar ni imprimir el resumen del día (ver pregunta abierta 3).
- Cambios en las reglas de la caja por turnos ni en el ledger de movimientos (spec 007) — esta spec solo los lee.
- Lo que figura en "Fuera de alcance" en `docs/PROJECT.md` (varios puestos de caja, otras monedas, tarjeta o QR).

## 3. Historias de usuario

- Como **dueño**, quiero ver cuánta plata entró y salió en el día entre todos los turnos, para saber cómo va la caja sin sumar a mano.
- Como **dueño**, quiero ver cuánto efectivo debería haber en la caja ahora mismo, aunque el turno de la mañana lo haya abierto otra persona, para controlar la caja a media jornada.
- Como **dueño**, quiero ver qué hizo cada turno del día (quién, cuándo, con cuánto empezó y cómo cerró), para repasar a cada cajero sin entrar al historial.
- Como **dueño**, quiero separar lo cobrado en efectivo de lo cobrado por transferencia en el día, para saber cuánto tengo en mano y cuánto en el banco.
- Como **dueño**, quiero ver el detalle de todos los movimientos del día en una sola lista, para encontrar rápido uno puntual (un egreso, una seña, una venta).
- Como **dueño**, quiero mirar también un día anterior, para repasar cómo vino la caja de ayer o de la semana pasada.

## 4. Requisitos funcionales

- **RF-1.** El sistema ofrece la pantalla `/caja/dia`, que muestra el resumen de un día calendario. Por defecto muestra **hoy**; con un selector de fecha y con botones "día anterior" y "día siguiente" se puede ver cualquier otro día (la fecha viaja en la URL: `/caja/dia?fecha=AAAA-MM-DD`). No se puede elegir una fecha futura.
- **RF-2.** *Estado actual de la caja* (siempre es el de **ahora**, sea cual sea el día que se está mirando): si hay un turno abierto, la etiqueta "Abierta", quién lo abrió, desde cuándo, con cuánto efectivo inicial y el **efectivo esperado ahora** (spec 007, RF-3: la cifra de cuánto efectivo debería haber físicamente en la caja en este momento, aunque el turno lo haya abierto otra persona). Si no hay ninguno, muestra "Cerrada" y cuándo se cerró el último turno.
- **RF-3.** *Totales del día*, sumando **todos los turnos** que tuvieron movimientos ese día, en tres bloques:
  - **Efectivo:** ingresos, egresos y **neto** en efectivo (sin contar los montos iniciales de los turnos; ver regla de negocio sobre el monto inicial).
  - **Transferencias:** ingresos, egresos y **neto** por transferencia (no cambian el efectivo, igual que en la spec 007).
  - **Ventas:** cantidad y monto total de las ventas no anuladas; cantidad y monto de las anuladas; y lo **cobrado por ventas** separado en efectivo y transferencia (neto de lo devuelto por las anulaciones).
  - Además, el total general de ingresos y egresos del día (efectivo más transferencia).
- **RF-4.** *Desglose por turno*: una fila por cada turno que tuvo movimientos ese día, ordenada por apertura, con: estado (abierto o cerrado), quién lo abrió y quién lo cerró, hora de apertura y de cierre, monto inicial, ingresos y egresos en efectivo del turno, efectivo esperado y, si está cerrado, efectivo contado y diferencia. Cada fila lleva al detalle del turno (`/caja/historial/[id]` si está cerrado, `/caja` si está abierto).
- **RF-5.** *Por medio de pago*: efectivo y transferencia, cada uno con ingresos, egresos y neto del día, sumando todos los turnos. Los números coinciden con los de las tarjetas (RF-2).
- **RF-6.** *Movimientos del día*: lista cronológica de todos los movimientos de caja del día, de todos los turnos, con hora, tipo (ingreso o egreso, distinguido como en la spec 007), concepto, medio de pago (con los últimos 4 dígitos del comprobante si es transferencia), monto con signo, usuario que lo registró y turno al que pertenece. Los movimientos que vienen de una venta enlazan a su detalle (para quien tenga permiso "ver" en Ventas). La lista está paginada (mismo componente que los historiales).
- **RF-7.** Un día sin ningún movimiento de caja muestra un mensaje claro ("No hubo movimientos de caja este día"), no un error ni tarjetas con números engañosos.
- **RF-8.** La pantalla es de solo lectura: no crea, edita, anula ni borra nada.
- **RF-9.** Desde `/caja` (con o sin turno abierto) hay un acceso a "Caja del día", junto al acceso al historial. La fila "Hoy" del inicio (spec 012) enlaza a esta pantalla.

## 5. Reglas de negocio

- **Un día es el día calendario en la zona `America/Argentina/Tucuman`**, igual que en Analíticas y en el inicio (constitución, regla 9; spec 011 y 012). Un movimiento pertenece al día en que se **registró**.
- **El monto inicial no se suma entre turnos.** Cuando un turno abre, normalmente arranca con el efectivo que dejó el anterior; sumar los montos iniciales de todos los turnos contaría esa plata más de una vez. Por eso el efectivo del día se expresa como **neto de movimientos** (RF-2) y, para saber cuánto hay físicamente, se usa el **efectivo esperado del turno abierto** (RF-3), que ya incluye su monto inicial.
- **Un movimiento por transferencia no cambia el efectivo** (spec 007, regla de negocio): la tarjeta de efectivo y la de transferencias nunca se mezclan.
- **Ventas del día** suma las ventas no anuladas; una venta anulada no cuenta como venta, y su devolución (si la hubo) aparece como un egreso en los movimientos, igual que en la spec 008.
- **Cobrado por ventas** cuenta solo los movimientos que vienen de una venta (el cobro suma, la devolución por anulación resta); las señas y los movimientos manuales no entran ahí aunque sí entran a los totales de efectivo y transferencia.
- **Una seña** cobrada ese día es un ingreso en los movimientos del día, aunque el pedido todavía no sea una venta (spec 009): los totales de caja la incluyen; el total de *Ventas* no.
- **Los números tienen que coincidir** con los de la caja por turnos: la suma de los ingresos y egresos por turno del desglose (RF-4) es igual a los totales del día (RF-2), y esos son los mismos movimientos que se ven en cada `/caja/historial/[id]` (la fuente de verdad sigue siendo el ledger de la spec 007).
- La pantalla no modifica el ledger ni los cierres: un cierre no se edita (constitución, regla 12).
- Todo en ARS, con `Decimal`, sin decimales visibles salvo que aporten (constitución, reglas 5, 6 y 23).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver la caja del día (hoy o un día anterior) | Permiso "ver" en Caja |
| Ver el enlace al detalle de una venta desde un movimiento | Permiso "ver" en Ventas (sin él, el movimiento se muestra pero sin enlace) |

No hay un permiso nuevo: se reutiliza el de Caja (spec 002). El permiso se valida en el servidor al cargar la pantalla (constitución, regla 14); ocultar el enlace en la navegación no alcanza.

## 7. Casos borde y errores

- **Día sin movimientos** (por ejemplo, un domingo cerrado): se muestra el mensaje de RF-7.
- **Fecha futura o con formato inválido en la URL**: se muestra hoy, sin error.
- **Turno que cruza la medianoche** (abierto un día y cerrado al siguiente): aparece en el desglose de ambos días, con los movimientos que cayeron en cada uno. Los datos propios del turno entero (efectivo esperado, contado y diferencia) se muestran tal cual en ambos y se aclara que el turno continúa. Ver pregunta abierta 2.
- **Turno abierto sin movimientos todavía**: aparece en el desglose con su monto inicial y los números en cero, para que se vea que la caja está abierta.
- **Hoy hay un turno cerrado a la mañana y no hay ninguno abierto ahora**: el estado actual dice "Cerrada"; los totales del día igual se muestran.
- **Usuario sin permiso "ver" en Caja** entra por URL: el servidor lo rechaza con un mensaje claro.
- **Muchos movimientos en un día**: la lista se pagina; los totales y el desglose siempre se calculan sobre el día completo, no sobre la página visible.

## 8. Criterios de aceptación

- [ ] Con dos turnos en el mismo día (uno cerrado a la mañana por un usuario y uno abierto a la tarde por otro), `/caja/dia` muestra los totales sumados de ambos, sin tener que entrar al historial.
- [ ] Los totales en efectivo y en transferencia del día (ingresos, egresos y neto) coinciden con la suma de lo que muestra cada turno en su propio detalle.
- [ ] El *Estado actual de la caja* coincide con lo que muestra `/caja` (abierta por quién, desde cuándo, efectivo esperado), y se ve igual aunque se esté mirando un día anterior.
- [ ] Los totales de ventas (cantidad, monto, anuladas y cobrado por medio) coinciden con el historial de ventas del mismo día.
- [ ] El desglose por turno muestra quién abrió y cerró cada uno, horarios, monto inicial, esperado, contado y diferencia, y cada fila lleva al detalle correcto.
- [ ] El resumen por medio de pago separa efectivo de transferencia y coincide con las tarjetas.
- [ ] Una venta anulada no suma al total de ventas; una seña de un pedido sí suma a los ingresos pero no a las ventas.
- [ ] Se puede cambiar de día con el selector y con los botones anterior/siguiente; una fecha futura no se puede elegir y por URL vuelve a hoy.
- [ ] Un día sin movimientos muestra un mensaje claro.
- [ ] La lista de movimientos está paginada y los totales no cambian al cambiar de página.
- [ ] Un usuario sin permiso "ver" en Caja no puede ver la pantalla, probado con un rol real.
- [ ] Desde `/caja` y desde la fila "Hoy" del inicio se llega a la pantalla.
- [ ] La pantalla no crea ni modifica ningún dato (solo lectura) y se ve bien en celular (constitución, regla 22).

## 9. Decisiones (confirmadas con el cliente, 2026-10-20)

Se aceptaron las propuestas por defecto:

1. **Efectivo del día = neto de movimientos** (sin montos iniciales), más el **efectivo esperado del turno abierto** como cifra física de "ahora". Se evita contar dos veces la plata que pasa de un turno al siguiente.
2. **Turnos que cruzan la medianoche** aparecen en los dos días, con los movimientos que cayeron en cada uno.
3. **Sin imprimir ni exportar** el resumen del día en esta spec.
4. **Sin cierre del día formal**: la caja se sigue controlando por turno y esta pantalla es de consulta.
5. **10 movimientos por página** en la lista.
