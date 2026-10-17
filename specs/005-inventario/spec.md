# Spec 005 — Inventario

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 004 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Saber cuánto stock real tiene cada producto en todo momento, para poder vender sin sorpresas, saber qué reponer y corregir diferencias con un motivo que quede registrado.

## 2. Alcance

**Incluye:**

- El stock actual de cada producto, calculado siempre a partir de sus movimientos (nunca una cantidad que se edita a mano directamente)
- Movimientos de stock de cuatro tipos: ingreso, venta, ajuste y merma
- Ajuste manual puntual de un producto, con motivo obligatorio
- Conteo físico: se cuenta lo que hay, el sistema muestra la diferencia contra lo registrado y genera los ajustes al confirmar. La primera vez que se usa, con todos los productos en cero, es la carga inicial del stock.
- Pantalla de inventario con el stock actual de cada producto y aviso de cuáles están en o por debajo de su stock mínimo, con búsqueda por nombre/código y filtro por rubro y por estado (bajo stock / negativo)
- Historial de movimientos de stock por producto
- Campo opcional de stock inicial al crear un producto (spec 004): atajo para no tener que hacer un conteo físico aparte cuando se conoce la cantidad de entrada — genera un movimiento de tipo "ajuste" con motivo fijo "Carga inicial al crear el producto"

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. No incluye el ingreso de mercadería como operación con proveedor y precio de compra (spec 006) ni la venta como operación (spec 008) — esta spec construye el mecanismo genérico para registrar un movimiento de stock, que esas dos specs van a usar para generar movimientos de tipo "ingreso" y "venta" respectivamente. Tampoco incluye la valorización del stock en dinero (spec 011) ni la reserva de stock para pedidos (fuera de alcance del proyecto).

## 3. Historias de usuario

- Como dueño, quiero cargar el stock inicial de mis productos contando lo que tengo, para empezar a usar el sistema con los números reales.
- Como dueño o empleado con permiso, quiero hacer un conteo físico periódico y que el sistema genere solo los ajustes de las diferencias, para mantener el stock confiable sin tener que tocar cada producto a mano.
- Como dueño o empleado con permiso, quiero ajustar el stock de un producto puntual con un motivo (rotura, pérdida, error de carga), para corregir sin perder el rastro de por qué cambió.
- Como dueño, quiero ver qué productos están en o por debajo de su stock mínimo, para saber qué reponer antes de que falten.
- Como dueño, quiero ver el historial de movimientos de un producto, para entender por qué tiene la cantidad que tiene.

## 4. Requisitos funcionales

- **RF-1.** Cada producto tiene un stock actual, que es siempre la suma de sus movimientos de stock; no existe una operación que edite esa cantidad directamente.
- **RF-2.** El sistema permite un conteo físico: se ingresa la cantidad contada de cada producto (lista editable en pantalla, no una planilla), se muestra la diferencia contra el stock registrado, y recién al confirmar se genera un movimiento de ajuste por cada producto con diferencia, con motivo "conteo físico".
- **RF-3.** El sistema permite un ajuste manual de stock para un producto puntual (suma o resta una cantidad), con un motivo obligatorio de texto libre.
- **RF-4.** La pantalla de inventario muestra, por producto, el stock actual y si está en o por debajo de su stock mínimo (el umbral ya definido en la spec 004).
- **RF-5.** Cada producto tiene un historial de sus movimientos de stock (tipo, cantidad, motivo, quién y cuándo), visible desde su ficha.
- **RF-6.** El sistema expone una función interna para registrar un movimiento de stock, que las specs 006 (ingreso de mercadería) y 008 (ventas) van a usar para sus propios movimientos — ningún módulo futuro inventa su propia forma de cambiar el stock.
- **RF-7.** Un movimiento que deja el stock de un producto en negativo no se bloquea; se guarda igual y la pantalla de inventario lo señala como una situación a revisar.
- **RF-8.** El alta de un producto (spec 004) permite opcionalmente indicar su stock inicial; si no tiene el permiso especial "ajustar stock", ese campo no está disponible.

## 5. Reglas de negocio

- El stock de un producto es siempre la suma de sus movimientos; no existe una operación de "editar cantidad" directa (RF-1).
- Todo movimiento de ajuste o merma requiere un motivo (constitución, regla sobre acciones sensibles).
- El stock puede quedar en negativo; no se bloquea, porque el proyecto ya decidió no reservar stock ni bloquear ventas por disponibilidad (`docs/PROJECT.md`, sección 5) — un negativo es una señal de que algo no se registró bien antes, no un error a impedir.
- El stock mínimo que dispara la alerta es el que ya tiene el producto desde la spec 004; esta spec no lo redefine.
- Un producto desactivado conserva su stock y su historial de movimientos intactos; no participa de ventas (ya definido en la spec 004).
- Nada se guarda durante un conteo físico hasta que el usuario confirma (mismo criterio que la importación de productos de la spec 004).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el inventario (stock actual de cada producto) y las alertas de stock bajo | Permiso "ver" en Inventario |
| Ver el historial de movimientos de un producto | Permiso "ver" en Inventario |
| Hacer un conteo físico y confirmar los ajustes que genera | Permiso "editar" en Inventario, además del permiso especial "ajustar stock" |
| Ajuste manual o merma puntual de un producto | Permiso "editar" en Inventario, además del permiso especial "ajustar stock" |
| Exportar el inventario | Permiso "exportar" en Inventario |

## 7. Casos borde y errores

- Un movimiento deja el stock en negativo: se guarda igual, con un aviso visible en la pantalla de inventario (RF-7).
- Se abre un conteo físico pero no se confirma: no se genera ningún movimiento.
- Un conteo físico no cambia nada para los productos sin diferencia: solo se generan movimientos para los que realmente difieren.
- Se intenta ajustar el stock de un producto desactivado: se permite (puede ser necesario corregir un error aunque el producto ya no se venda).
- Un usuario sin el permiso especial "ajustar stock" intenta ajustar stock o confirmar un conteo llamando a la acción directamente (no solo por la interfaz): el servidor lo rechaza.
- Dos conteos físicos hechos casi al mismo tiempo por dos personas distintas: no hay bloqueo entre ellos; el que confirma último pisa el ajuste del anterior. Riesgo aceptado dado que hay un solo puesto y dos empleados (`docs/PROJECT.md`, sección 2); no se resuelve en esta spec.

## 8. Criterios de aceptación

- [x] Un producto recién creado tiene stock cero hasta que se le registra algún movimiento (incluido el stock inicial opcional del alta, que también es un movimiento).
- [ ] Se puede hacer un conteo físico sobre todo el catálogo: se ven las diferencias antes de confirmar, y al confirmar se generan los ajustes correctos (y solo esos).
- [x] Se puede ajustar el stock de un producto puntual con un motivo, y el historial del producto lo refleja.
- [x] La pantalla de inventario señala los productos en o por debajo de su stock mínimo, y se puede filtrar por nombre/código, rubro y estado.
- [x] Se puede cargar el stock inicial de un producto al crearlo, sin tener que hacer un conteo físico aparte.
- [ ] Un movimiento que deja el stock en negativo se guarda y se señala, no se bloquea.
- [ ] Un usuario sin el permiso especial "ajustar stock" no puede ajustar stock ni confirmar un conteo físico, probado con un rol real.
- [ ] Un producto desactivado conserva su stock y su historial de movimientos sin cambios.

## 9. Entidades previstas

A confirmar en el plan: `StockMovement` (productId, tipo, cantidad, motivo, usuario, fecha). El stock actual del producto se calcula a partir de estos movimientos; a decidir en el plan si se cachea un campo en `Product` por rendimiento (recalculado siempre dentro de la misma transacción que crea el movimiento) o se calcula al vuelo.

## 10. Decisiones (ya confirmadas con el cliente)

- **Carga inicial = primer conteo físico.** No hay una pantalla separada para cargar el stock inicial: es el mismo mecanismo de conteo físico, usado la primera vez sobre productos que están todos en cero.
- **Entrada de cantidades: lista editable en pantalla**, no una planilla de Excel/CSV — una tabla en la pantalla de inventario con un casillero de cantidad contada por producto.
- **Stock negativo: permitido, con aviso.** Ningún movimiento se bloquea por dejar el stock en negativo; es una señal para revisar, no un error.
- **Stock inicial opcional al crear un producto (2026-10-16).** Ajusta la decisión de "carga inicial = primer conteo físico": además de esa vía, el alta de un producto (spec 004) puede traer un campo de stock inicial, para no tener que ir después a un conteo físico solo para un producto nuevo. Sigue existiendo el conteo físico para cargar varios productos a la vez o para recontar periódicamente.
- **Ajuste y Merma se mantienen separados, con la pantalla aclarando la diferencia (2026-10-16).** Dudó el cliente si eran lo mismo (los dos piden motivo y cantidad; Merma siempre resta, Ajuste con "Restar" también). Se mantiene la distinción pensando en reportes futuros (spec 011: separar pérdidas de correcciones), pero se agregó un texto explicando cada uno en el formulario de ajuste.
