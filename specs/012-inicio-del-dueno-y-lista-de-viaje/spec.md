# Spec 012 — Inicio del dueño y lista de viaje

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 005, 009, 011 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Darle al dueño, desde el celular, lo que necesita saber antes de viajar a comprar: qué falta, qué se vende y qué pedidos tiene.

## 2. Alcance

**Incluye:**

- Pantalla de inicio con los datos de la caja de hoy y de la caja actual (si hay una abierta), cantidad de pedidos pendientes y alertas de stock
- Lista de viaje: productos cuyo stock realmente disponible (stock actual menos lo comprometido en pedidos pendientes) está por debajo del mínimo, con una cantidad sugerida para cada uno
- Copiar la lista de viaje como texto (para compartir por WhatsApp u otro chat) y exportarla a Excel
- Diseño pensado para celular, igual que el resto del sistema

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. No repite lo que ya está en Analíticas (spec 011) — ventas del mes, comparaciones ni productos más vendidos. No incluye un cálculo de reposición más sofisticado que el de esta spec (por ejemplo, basado en velocidad de venta o estacionalidad) ni el envío automático de la lista (solo copiar/exportar para que el dueño lo envíe él mismo).

## 3. Historias de usuario

- Como dueño, quiero ver al entrar el estado de la caja de hoy y de la que está abierta ahora, para tener un panorama rápido sin entrar a Caja.
- Como dueño, quiero ver cuántos pedidos tengo pendientes, desde la misma pantalla de inicio.
- Como dueño, quiero ver qué productos están por debajo del stock que necesito (contando lo que ya está comprometido en pedidos), para saber qué me puede faltar.
- Como dueño, quiero una lista con la cantidad sugerida de cada producto para comprar, para no tener que calcularlo a mano antes de salir a comprar.
- Como dueño, quiero copiar esa lista como texto o descargarla, para mandarla por WhatsApp o llevarla impresa.

## 4. Requisitos funcionales

- **RF-1.** La pantalla de inicio muestra el estado de la caja actual: si hay una abierta, quién la abrió, desde cuándo y el efectivo esperado (spec 007); si no hay ninguna, lo indica. — visible para quien tenga permiso "ver" en Caja.
- **RF-2.** La pantalla de inicio muestra un resumen de los movimientos de caja de hoy: ingresos, egresos y el neto (mismo criterio horario de Tucumán que las analíticas, spec 011; cuenta todos los turnos de hoy, no solo el que esté abierto ahora) — visible para quien tenga permiso "ver" en Caja.
- **RF-3.** La pantalla de inicio muestra la cantidad de pedidos pendientes, con acceso directo a `/pedidos` — visible para quien tenga permiso "ver" en Pedidos.
- **RF-4.** La pantalla de inicio muestra cuántos productos tienen el stock realmente disponible por debajo del mínimo, con acceso directo a la lista de viaje — visible para quien tenga permiso "ver" en Inventario.
- **RF-5.** La lista de viaje muestra, para cada producto con stock disponible por debajo del mínimo, la cantidad sugerida para volver a cubrirlo — visible para quien tenga permiso "ver" en Inventario.
- **RF-6.** La lista de viaje se puede filtrar por marca y por rubro, para poder comprar por categoría (por ejemplo, todo lo de rubro "Tecnología" en una sola compra).
- **RF-7.** La lista de viaje se puede copiar como texto plano (un producto y cantidad por línea, listo para pegar en un chat) y exportar a Excel — ambas reflejan el filtro de marca/rubro que esté aplicado en ese momento.

## 5. Reglas de negocio

- **Stock realmente disponible** de un producto = stock actual menos lo comprometido en pedidos pendientes (`docs/PROJECT.md`, sección 5 — el dato de "comprometido" ya existe desde la spec 009). Puede ser negativo.
- Un producto entra a las alertas de stock y a la lista de viaje cuando su disponible real es menor que su stock mínimo — esto junta en una sola regla los dos casos que menciona `docs/PROJECT.md` ("bajo el mínimo" y "faltantes de pedidos pendientes"), en vez de tratarlos por separado.
- **Cantidad sugerida** = stock mínimo − disponible real (siempre positiva para los productos que entran a la lista). Es una sugerencia simple: no considera velocidad de venta, estacionalidad ni tiempos de entrega del proveedor.
- El inicio no repite datos de Analíticas (spec 011): nada de ventas del mes, comparaciones ni productos más vendidos — eso se consulta ahí. Lo que muestra el inicio sobre caja es operativo (¿hay una caja abierta ahora?, ¿cómo viene la de hoy?), no un reporte de ventas.
- "Hoy" usa el mismo corte horario de Tucumán que las analíticas (spec 011): el día calendario en curso en esa zona.
- Cada sección de la pantalla de inicio se muestra u oculta según el permiso de su propio módulo (Caja, Pedidos, Inventario) — igual criterio que el resto del sistema (constitución, regla 14); no hay un permiso nuevo exclusivo de "Inicio".
- Esta spec es de solo lectura: no crea, edita ni anula nada de lo que ya existe.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el estado de la caja actual y el resumen de hoy | Permiso "ver" en Caja |
| Ver pedidos pendientes en el inicio | Permiso "ver" en Pedidos |
| Ver alertas de stock y la lista de viaje | Permiso "ver" en Inventario |
| Copiar o exportar la lista de viaje | Permiso "ver" en Inventario (no exige "exportar": es una lista de compra interna, no un reporte) |

## 7. Casos borde y errores

- Ningún producto por debajo del mínimo disponible: la lista de viaje se muestra vacía, con un mensaje, no un error.
- Un producto con disponible real muy negativo (mucho comprometido, poco stock): la cantidad sugerida simplemente es más alta: `mínimo − disponible` sigue siendo la cuenta, sin un tope.
- No hay ninguna caja abierta en este momento: la pantalla lo indica (en vez de mostrar datos de una que no existe); el resumen de movimientos de hoy se calcula igual, aunque no haya ninguna abierta ahora.
- Usuario sin ninguno de los tres permisos (Caja, Pedidos, Inventario): no ve ninguna sección con datos, solo el saludo genérico que ya existe desde la spec 001.
- Copiar la lista con cero productos: el texto generado dice que no hay nada para comprar, no queda vacío sin explicación.

## 8. Criterios de aceptación

- [x] Se ve el estado de la caja actual (abierta o no, y sus datos si está abierta) y el resumen de movimientos de hoy, con permiso de Caja.
- [x] Se ve la cantidad de pedidos pendientes, con permiso de Pedidos.
- [x] Se ven las alertas de stock y se puede entrar a la lista de viaje, con permiso de Inventario.
- [x] La lista de viaje muestra la cantidad sugerida de cada producto, calculada con el stock disponible real (stock menos comprometido).
- [x] Se puede filtrar la lista de viaje por marca y por rubro.
- [x] Se puede copiar la lista como texto y exportarla a Excel, respetando el filtro de marca/rubro aplicado.
- [x] Cada sección respeta su propio permiso de forma independiente.

## 9. Entidades previstas

Sin entidades nuevas: consultas sobre `Sale`, `SaleItem`, `Order`, `OrderItem` y `Product` ya existentes (specs 004-009, 011). Reusa `computeCommittedQuantities` (spec 009) para lo comprometido.

## 10. Decisiones (ya confirmadas con el cliente)

- **La cantidad sugerida se calcula con el stock disponible real** (stock actual menos lo comprometido en pedidos pendientes), no solo contra el stock actual — unifica "bajo stock" y "faltante de pedidos" en una sola lista y una sola cuenta.
- **La lista de viaje se copia como texto y se exporta a Excel**; sin PDF — es una lista de compra simple, no un reporte.
