# Spec 006 — Ingreso de mercadería

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 004, 005 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Registrar cada compra de mercadería (lo que llega, de qué proveedor y a qué precio) para que el stock y el precio de compra de los productos queden al día, sin tocar nada a mano en el catálogo ni en el inventario por separado.

## 2. Alcance

**Incluye:**

- Un ingreso de mercadería con proveedor (texto libre, opcional) y fecha, con una lista de ítems: producto, cantidad, precio de compra unitario y precio de venta unitario (opcional)
- Al confirmar un ingreso: por cada ítem, un movimiento de stock de tipo "ingreso" (spec 005) y la actualización del precio de compra del producto al precio pagado en ese ítem; si se cargó precio de venta en el ítem, también se actualiza
- Historial de ingresos, con el detalle de cada uno

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md` (no hay cuentas corrientes ni seguimiento de pago al proveedor — un ingreso refleja mercadería y costo, no plata adeudada). No incluye un listado administrable de proveedores (campo de texto libre, no una entidad con su propia pantalla). No incluye anular o editar un ingreso ya confirmado — si algo se cargó mal, se corrige con un ajuste de stock (spec 005) y, si corresponde, editando el precio del producto (spec 004); un ingreso confirmado queda como un registro fijo, igual que el historial de precios o los movimientos de stock.

## 3. Historias de usuario

- Como dueño, quiero registrar todo lo que traje de un viaje a Ciudad del Este en una sola carga (varios productos, cantidades y precios), para no repetir el proceso producto por producto.
- Como dueño, quiero que el precio de compra del producto se actualice solo al cargar el ingreso, para no tener que ir después a editarlo a mano en el catálogo.
- Como dueño, quiero que el stock se actualice solo al cargar el ingreso, para no tener que hacer un ajuste de stock aparte.
- Como dueño, quiero anotar de qué proveedor vino una compra, aunque sea solo un nombre suelto, para tener el dato a mano si lo necesito después.
- Como dueño, quiero ver el historial de ingresos con el detalle de cada uno, para repasar qué compré y a qué precio.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite crear un ingreso de mercadería con proveedor opcional (texto libre), fecha, y uno o más ítems (producto, cantidad, precio de compra unitario, precio de venta unitario opcional).
- **RF-2.** Al confirmar un ingreso, se guarda todo en una sola operación (constitución, regla de integridad de datos): si algo falla, no se guarda nada del ingreso.
- **RF-3.** Por cada ítem de un ingreso confirmado, el sistema registra un movimiento de stock de tipo "ingreso" por la cantidad del ítem (usando el mecanismo de la spec 005) y actualiza el precio de compra del producto al precio de ese ítem (el último precio pagado, no un promedio). Si el ítem trae precio de venta, también actualiza el precio de venta del producto; si no lo trae, el precio de venta no cambia.
- **RF-4.** El sistema permite ver el historial de ingresos (fecha, proveedor, cantidad de ítems) y el detalle de cada uno (qué productos, cuántas unidades, a qué precio de compra y de venta). El precio de compra solo se muestra a quien tiene el permiso especial "ver costos y márgenes" (constitución, regla 17) — el de venta se ve siempre. La lista está paginada de a 10, con el mismo componente que los demás historiales (`?pagina=N`). *(Agregado 2026-10-20.)*
- **RF-5.** Un ingreso confirmado no se puede editar ni anular desde esta pantalla.

## 5. Reglas de negocio

- El precio de compra del producto se actualiza al último precio pagado en el ingreso, no a un costo promedio ponderado (`docs/PROJECT.md`, sección 5 — decidido en esta spec).
- Cambiar el precio de compra de un producto a través de un ingreso requiere el mismo permiso especial que cambiarlo desde el catálogo: "cambiar precios" (specs/004, sección 6) — un ingreso no es una puerta lateral para esquivar ese permiso.
- Un ingreso confirmado es un registro fijo: no se edita ni se borra. Las correcciones se hacen con las herramientas que ya existen (ajuste de stock de la spec 005, edición de precio de la spec 004).
- El stock y el precio de compra se actualizan siempre juntos con el resto del ingreso, en la misma transacción (constitución, regla de integridad de datos).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el historial de ingresos | Permiso "ver" en Ingreso de mercadería |
| Registrar un ingreso | Permiso "crear" en Ingreso de mercadería, además del permiso especial "cambiar precios" (porque todo ingreso actualiza el precio de compra) |

## 7. Casos borde y errores

- Un ítem del ingreso tiene cantidad o precio inválido (cero, negativo, vacío): se señala el error antes de confirmar; no se guarda nada del ingreso hasta que se corrige.
- Un ingreso tiene ítems para un producto que ya no está activo: se permite — reactivar un producto discontinuado por error no es parte de esta spec, pero cargarle stock no debería estar bloqueado.
- Un usuario con "crear" en Ingreso de mercadería pero sin el permiso especial "cambiar precios" intenta registrar un ingreso: se rechaza (no hay una versión parcial del ingreso sin actualizar precio — a diferencia de editar un producto, acá no tiene sentido guardar "la mitad").
- Se cargan dos ítems del mismo producto en el mismo ingreso: se permite: el precio de compra queda en el del último ítem procesado, y se generan dos movimientos de stock (uno por ítem), no se suman antes de guardar.

## 8. Criterios de aceptación

- [x] Se puede registrar un ingreso con varios productos a la vez, cada uno con su cantidad y precio.
- [x] Al confirmar, el stock de cada producto del ingreso aumenta según la cantidad cargada.
- [x] Al confirmar, el precio de compra de cada producto del ingreso queda en el precio cargado en ese ingreso.
- [x] Si un ítem trae precio de venta, el precio de venta del producto queda en ese valor; si no lo trae, no cambia.
- [x] Se puede ver el historial de ingresos y el detalle de uno en particular.
- [ ] Un usuario sin el permiso especial "cambiar precios" no puede registrar un ingreso, probado con un rol real.
- [ ] Si un ítem del ingreso tiene un dato inválido, no se guarda nada del ingreso hasta corregirlo.

## 9. Entidades previstas

A confirmar en el plan: `StockEntry` (cabecera: proveedor, fecha, usuario) y `StockEntryItem` (ingreso, producto, cantidad, precio de compra unitario, precio de venta unitario opcional).

## 10. Decisiones (ya confirmadas con el cliente)

- **Costeo: último precio de compra, no promedio ponderado.** Más simple de explicar y de construir; el margen de una venta usa el precio de compra vigente al momento de venderse (ya decidido en `docs/PROJECT.md`, sección 5), no un cálculo retroactivo.
- **Proveedor: campo de texto libre**, no una entidad administrable. No hay una spec de proveedores en la hoja de ruta; si en el futuro hace falta más (contacto, historial de compras por proveedor), se agrega como un cambio de alcance aparte.
- **Un ingreso tiene varios ítems**, como una factura de compra — no uno por producto. Refleja cómo llega la mercadería de un viaje real.
- **Precio de venta opcional por ítem (2026-10-16, pedido del cliente tras probar la pantalla).** Al cargar un ingreso se puede fijar de una vez el precio de venta de cada producto, además del de compra — si se deja vacío, el precio de venta no cambia. No contradice la regla de "el dueño define el precio a mano" (`docs/PROJECT.md`, sección 5): sigue siendo una carga manual, solo que en la misma pantalla en vez de tener que ir después a editar el producto.
