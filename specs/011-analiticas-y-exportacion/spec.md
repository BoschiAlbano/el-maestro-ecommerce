# Spec 011 — Analíticas y exportación

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 008, 009 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Mostrar al dueño qué se vende, cuánto, quién lo vende y cuánto se gana, con filtros y exportación.

## 2. Alcance

**Incluye:**

- Filtros combinables por rango de fechas, empleado y medio de pago (producto, marca, rubro y canal se quitaron de la pantalla el 2026-10-19)
- Resumen del período: total vendido, cantidad de operaciones, ticket promedio y comparación con el período anterior equivalente
- Evolución diaria de ventas dentro del rango elegido
- Ventas agrupadas por empleado, por turno de caja y por canal
- Productos más vendidos en el período (los productos sin movimiento se quitaron de la pantalla el 2026-10-19)
- Margen por producto, marca y rubro — solo visible con el permiso especial "ver costos y márgenes"
- Valorización del stock actual — mismo permiso que el margen
- ~~Diferencias de caja por empleado, dentro del rango~~ (quitado de la pantalla el 2026-10-19)
- Exportación a Excel (el detalle tabular, tal como está filtrado en pantalla) y a PDF (un resumen imprimible de los indicadores principales)
- Pantallas pensadas para celular, igual que el resto del sistema

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. No incluye proyecciones ni recomendaciones automáticas (solo datos de lo ya ocurrido), ni un recálculo de costos distinto al ya guardado en cada venta.

## 3. Historias de usuario

- Como dueño, quiero ver cuánto vendí este mes y cómo viene comparado con el anterior, para saber si el negocio mejora o empeora.
- Como dueño, quiero filtrar las ventas por empleado, producto, marca, rubro, canal o medio de pago, para entender qué mueve el negocio.
- Como dueño, quiero ver qué productos se venden más y cuáles no se mueven, para decidir qué reponer y qué dejar de traer.
- Como dueño con permiso para ver costos y márgenes, quiero ver el margen por producto y la valorización del stock, para saber cuánto gano y cuánto tengo invertido en mercadería.
- Como dueño, quiero ver las diferencias de caja por empleado, para detectar problemas de manejo de efectivo.
- Como dueño, quiero exportar lo que estoy viendo a Excel o a PDF, para compartirlo o analizarlo aparte.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite filtrar todas las vistas de esta spec por rango de fechas (por defecto, el mes en curso), empleado y medio de pago, combinados entre sí (producto, marca, rubro y canal se quitaron el 2026-10-19).
- **RF-2.** El sistema muestra, para el rango filtrado: total vendido, cantidad de ventas, ticket promedio, y la comparación contra el período anterior de igual duración (por ejemplo, el mes en curso contra el mes anterior).
- **RF-3.** ~~El sistema muestra la evolución día por día de las ventas dentro del rango filtrado.~~ Quitado de la pantalla (2026-10-19): el dato sigue calculándose para las exportaciones.
- **RF-4.** El sistema muestra las ventas agrupadas por empleado, por turno de caja (la sesión de caja en la que se vendió, spec 007 — no el turno de la ficha del empleado, spec 010, que es un dato distinto) y por canal.
- **RF-5.** El sistema muestra los 5 productos más vendidos por cantidad en un gráfico de barras (con el importe en el detalle al pasar el cursor) (los productos sin movimiento se quitaron de la pantalla el 2026-10-19).
- **RF-6.** El sistema muestra el margen por marca y por rubro (el margen por producto se quitó de la pantalla el 2026-10-19), usando el costo que quedó guardado en cada venta (no el precio de compra actual del producto) — visible solo para quien tenga el permiso especial "ver costos y márgenes" (spec 002).
- **RF-7.** El sistema muestra la valorización del stock actual (stock de cada producto por su costo) — mismo permiso que RF-6. Se quitó de la pantalla el 2026-10-19 (es el stock de hoy y no depende del rango de fechas); sigue en las exportaciones.
- **RF-7b.** El sistema muestra, en un gráfico de dona, el total cobrado por medio de pago (efectivo y transferencia) del rango filtrado, a la par del top 5 de productos (2026-10-19). Se calcula con los ingresos de caja de ventas no anuladas.
- **RF-7c.** El resumen muestra 8 tarjetas en dos filas de 4 (2026-10-19): Total vendido, Cantidad de ventas, Ticket promedio, Unidades vendidas (con comparación contra el período anterior), Ventas anuladas (cantidad y monto, por fecha de anulación; respeta empleado y medio de pago), Venta más grande (importe, quién la hizo y cuándo), y — solo con el permiso de costos — Costo de lo vendido y Margen.
- **RF-8.** El sistema muestra las diferencias de cierre de caja por empleado, dentro del rango filtrado.
- **RF-9.** El sistema permite exportar a Excel el detalle tabular de lo que está filtrado en pantalla, y a PDF un resumen imprimible con los indicadores principales (RF-2 y RF-5, y RF-6/RF-7 si quien exporta tiene el permiso).

## 5. Reglas de negocio

- Todo lo de esta spec es de solo lectura: no crea, edita ni anula nada de lo que ya existe en ventas, caja, stock o pedidos.
- El margen de una venta usa el costo que quedó guardado en el momento de venderla, nunca el precio de compra actual del producto (`docs/PROJECT.md`, sección 5) — por eso el margen de ventas pasadas no cambia si hoy cambia el costo.
- El margen y la valorización de stock (RF-6 y RF-7) solo se calculan y muestran para quien tenga el permiso especial "ver costos y márgenes"; sin ese permiso, esas secciones ni se calculan.
- "Por turno" (RF-4) agrupa por la caja en la que se vendió (spec 007), no por el turno de la ficha del empleado (spec 010) — son dos conceptos distintos que comparten nombre.
- Una venta sin pedido vinculado se agrupa como "Mostrador" al filtrar o agrupar por canal; el resto usa el canal de texto libre que se cargó en el pedido (spec 009), tal cual se escribió.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver analíticas (sin margen ni valorización) | Permiso "ver" en Analíticas |
| Ver margen y valorización de stock dentro de analíticas | Permiso "ver" en Analíticas, y el permiso especial "ver costos y márgenes" |
| Exportar a Excel o PDF | Permiso "exportar" en Analíticas (el margen/valorización solo se incluye si además tiene el permiso especial) |

## 7. Casos borde y errores

- Rango filtrado sin ninguna venta: se muestran los totales en cero y las listas vacías, no un error.
- Usuario sin el permiso especial "ver costos y márgenes": ve el resto de las analíticas con normalidad; donde iría el margen o la valorización, ve un aviso en vez del número.
- Exportar con el filtro sin resultados: genera el archivo igual, vacío salvo los encabezados.
- Período anterior sin datos para comparar (por ejemplo, el primer mes de uso del sistema): se muestra sin comparación, no un error ni un cálculo inventado.

## 8. Criterios de aceptación

- [x] Se pueden combinar filtros de fecha, empleado, producto, marca, rubro, canal y medio de pago.
- [x] Se ve el resumen del período con comparación contra el período anterior, ticket promedio y evolución diaria.
- [x] Se ven las ventas agrupadas por empleado, por turno de caja y por canal.
- [x] Se ven los productos más vendidos y los que no tuvieron movimiento.
- [x] El margen por producto/marca/rubro y la valorización de stock solo se ven con el permiso especial "ver costos y márgenes".
- [x] Se ven las diferencias de cierre de caja por empleado.
- [x] Se puede exportar a Excel (detalle filtrado) y a PDF (resumen).

## 9. Entidades previstas

Sin entidades nuevas: todo se calcula con consultas agregadas sobre `Sale`, `SaleItem`, `CashShift`, `StockMovement`, `Product` y `Order` ya existentes (specs 004-009).

## 10. Decisiones (ya confirmadas con el cliente)

- **El margen se calcula con el costo guardado en cada venta**, no con un costo promedio ponderado ni con el precio de compra actual (decidido en la spec 006, reafirmado acá).
- **Excel para el detalle tabular filtrado, PDF para un resumen imprimible** — no todo dato de esta spec tiene las dos exportaciones: el Excel es para analizar aparte, el PDF para compartir o imprimir un resumen.
