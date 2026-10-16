# Spec 007 — Caja por turnos

| | |
|---|---|
| **Estado** | Aprobada |
| **Depende de** | 002, 003 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Controlar la plata que entra y sale de la caja durante un turno, para saber cuánto debería haber en efectivo en cualquier momento y detectar diferencias al cerrar.

## 2. Alcance

**Incluye:**

- Apertura de un turno de caja con un monto inicial en efectivo
- Movimientos manuales de ingreso y egreso dentro del turno, con concepto, monto y medio de pago (efectivo o transferencia); si es por transferencia, los últimos 4 dígitos del comprobante
- Un único ledger de movimientos de caja que registra **todos** los pagos del sistema, no solo los manuales: cuando existan las specs 008/009, cada cobro de una venta o una seña va a generar sus propios movimientos ahí, uno por cada forma de pago usada (una venta puede cobrarse mitad en efectivo y mitad por transferencia — son dos movimientos, no uno)
- Cierre de turno: efectivo contado contra efectivo esperado, con la diferencia a la vista; motivo obligatorio si hay diferencia
- Historial de turnos cerrados y detalle de sus movimientos
- Resumen imprimible del cierre

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md` (sin varios puestos de caja ni otras monedas, ni tarjeta ni QR — solo efectivo y transferencia). No incluye la pantalla de cobro de una venta o de una seña en sí (eso es de las specs 008/009) — esta spec construye el ledger de movimientos de caja y la forma de pago (con su referencia si es transferencia) que esas dos specs van a usar para registrar lo que cobran, igual criterio que el ledger de stock de la spec 005 para las specs 006/008.

## 3. Historias de usuario

- Como cajero, quiero abrir la caja con el monto inicial en efectivo, para empezar el turno con el número correcto.
- Como cajero, quiero registrar un ingreso o egreso manual con un concepto, para que quede reflejado en el efectivo esperado.
- Como cajero, quiero cerrar la caja contando el efectivo y viendo la diferencia contra lo esperado, para saber si cuadra.
- Como dueño, quiero que, si hay diferencia al cerrar, quede un motivo registrado, para saber después qué pasó.
- Como dueño, quiero ver el historial de turnos cerrados con sus diferencias, para repasar cómo vino la caja día a día.
- Como cajero o dueño, quiero que no se pueda abrir un turno nuevo si ya hay uno abierto, para no duplicar cajas.
- Como cajero, quiero anotar los últimos 4 dígitos del comprobante cuando cobro por transferencia, para poder verificarlo después si hace falta.
- Como dueño, quiero que una venta pagada mitad en efectivo y mitad por transferencia quede reflejada como dos movimientos separados, para que el efectivo esperado de la caja sea exacto.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite abrir un turno de caja con un monto inicial en efectivo; no se puede abrir uno nuevo si ya existe un turno abierto.
- **RF-2.** Dentro de un turno abierto se pueden registrar movimientos manuales de ingreso o egreso, cada uno con concepto (motivo), monto y medio de pago (efectivo o transferencia). Si el medio es transferencia, es obligatorio anotar los últimos 4 dígitos del comprobante.
- **RF-3.** El efectivo esperado de un turno es el monto inicial más los ingresos en efectivo menos los egresos en efectivo — los movimientos por transferencia no entran en esa cuenta, aunque sí quedan registrados en el turno. (Cuando exista la spec 008, las ventas cobradas en efectivo también van a sumar acá.)
- **RF-4.** El mecanismo para registrar un movimiento de caja soporta que un mismo cobro (una venta, a futuro) se reparta en más de un medio de pago: se genera un movimiento por cada medio usado, cada uno con su propio monto y, si corresponde, su referencia de transferencia — nunca un solo movimiento con dos medios de pago mezclados.
- **RF-5.** Al cerrar un turno se ingresa el efectivo contado; el sistema calcula y muestra la diferencia contra el efectivo esperado. Si hay diferencia (de más o de menos), es obligatorio un motivo antes de poder confirmar el cierre.
- **RF-6.** Un turno cerrado, y los movimientos de cualquier turno, no se editan ni se borran; una corrección se hace con un movimiento nuevo, nunca tocando uno viejo.
- **RF-7.** No puede haber más de un turno de caja abierto a la vez.
- **RF-8.** El sistema permite ver el historial de turnos cerrados (apertura, cierre, quién los abrió/cerró, efectivo esperado, contado y diferencia) y el detalle de los movimientos de cada uno.
- **RF-9.** El sistema permite imprimir un resumen al cerrar un turno.

## 5. Reglas de negocio

- Solo puede haber una caja abierta a la vez; no se vende sin caja abierta (`docs/PROJECT.md`, sección 5 — esto último se aplica recién en la spec 008).
- Un cierre no se edita: las correcciones van como movimientos con motivo (`docs/PROJECT.md`, sección 5).
- El efectivo esperado solo cuenta movimientos en efectivo; una transferencia no cambia cuánto papel moneda debería haber en la caja.
- Cerrar un turno exige el permiso especial "cerrar caja" (ya existe desde la spec 002, sin uso hasta ahora).
- Formas de pago admitidas: efectivo y transferencia (nada de tarjeta ni QR por ahora, `docs/PROJECT.md` sección 6). Todo movimiento por transferencia lleva los últimos 4 dígitos del comprobante.
- Un cobro (a futuro, una venta) puede repartirse en varias formas de pago; cada parte es su propio movimiento de caja, con su propio medio y, si corresponde, su propia referencia.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el turno actual y el historial de cajas | Permiso "ver" en Caja |
| Abrir un turno y registrar movimientos manuales | Permiso "crear" en Caja |
| Cerrar un turno | Permiso "editar" en Caja, además del permiso especial "cerrar caja" |
| Imprimir el resumen de un cierre | Permiso "exportar" en Caja |

## 7. Casos borde y errores

- Se intenta abrir un turno cuando ya hay uno abierto: se rechaza, señalando cuál está abierto.
- Se intenta cerrar un turno sin ingresar el efectivo contado: se rechaza.
- Hay diferencia al cerrar y no se completa el motivo: se rechaza, no se cierra hasta tenerlo.
- Se intenta registrar un movimiento manual sin ningún turno abierto: se rechaza (no hay a qué turno asociarlo).
- Un usuario sin el permiso especial "cerrar caja" intenta cerrar un turno llamando a la acción directamente (no solo por la interfaz): el servidor lo rechaza.
- Se registra un movimiento por transferencia sin los 4 dígitos del comprobante, o con un valor que no son 4 dígitos: se rechaza.

## 8. Criterios de aceptación

- [ ] Se puede abrir un turno con un monto inicial; no se puede abrir otro mientras el primero sigue abierto.
- [ ] Se pueden registrar ingresos y egresos manuales con concepto y medio de pago, y el efectivo esperado refleja solo los que son en efectivo.
- [ ] Al cerrar, se ve la diferencia entre lo esperado y lo contado; si hay diferencia, no se puede cerrar sin un motivo.
- [ ] Un turno cerrado y sus movimientos no se pueden editar ni borrar desde la interfaz.
- [ ] Se puede ver el historial de turnos cerrados con su diferencia, y el detalle de los movimientos de uno en particular.
- [ ] Se puede imprimir un resumen del cierre.
- [ ] Un usuario sin el permiso especial "cerrar caja" no puede cerrar un turno, probado con un rol real.
- [ ] Un movimiento por transferencia exige los últimos 4 dígitos del comprobante; uno en efectivo no pide ese dato.

## 9. Entidades previstas

A confirmar en el plan: `CashShift` (apertura: monto inicial, usuario, fecha; cierre: efectivo contado, diferencia, motivo de la diferencia, usuario, fecha) y `CashMovement` (turno, tipo ingreso/egreso, monto, concepto, medio de pago, referencia de transferencia si corresponde, usuario, fecha).

## 10. Decisiones (ya confirmadas con el cliente)

- **Motivo obligatorio solo si hay diferencia al cerrar.** Si el efectivo contado coincide con el esperado, se cierra directo; si no coincide (para cualquier lado), hay que escribir qué pasó antes de confirmar.
- **Movimientos y cierres fijos, nunca editables ni borrables.** Coherente con "un cierre no se edita" (`docs/PROJECT.md`, sección 5): una corrección es siempre un movimiento nuevo, igual criterio que el historial de precios (spec 004) y los movimientos de stock (spec 005).
- **Historial de cajas cerradas incluido**, no solo el resumen del momento del cierre — útil para repasar la caja día a día antes de la spec 011 (analíticas).
- **Formas de pago: efectivo y transferencia, con referencia obligatoria en transferencia.** El cliente aclaró que la caja tiene que llevar el control de todos los pagos del sistema (no solo los movimientos manuales) y que una venta puede pagarse repartida entre varias formas de pago (ej.: mitad efectivo, mitad transferencia). Por eso `CashMovement` queda como la única forma de registrar un pago — nunca un monto con dos medios mezclados — para que las specs 008/009 generen un movimiento por cada parte del pago, cada uno con su propio medio y, si es transferencia, sus últimos 4 dígitos.
