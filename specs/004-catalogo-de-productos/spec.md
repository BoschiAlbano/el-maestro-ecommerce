# Spec 004 — Catálogo de productos

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 002, 003 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Tener el catálogo completo de productos, con marca y rubro, precios en ARS y códigos de barras, listo para vender.

## 2. Alcance

**Incluye:**

- Producto con nombre, marca, rubro, foto, precio de compra, precio de venta y stock mínimo
- Marcas y rubros administrables (el rubro admite subrubros)
- Código de barras: se registra el original o el sistema genera uno propio
- Búsqueda y filtros por nombre, código, marca y rubro
- Importación masiva desde Excel o CSV, con plantilla descargable y detección de filas inválidas
- Etiquetas imprimibles con código de barras
- Historial de cambios de precio
- Activación y desactivación de productos

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. No incluye el stock en sí (cantidades, movimientos, carga inicial de unidades) — eso es la spec 005; acá el producto solo tiene un stock mínimo (umbral de alerta), no una cantidad. Tampoco incluye el ingreso de mercadería como operación (spec 006).

## 3. Historias de usuario

- Como dueño, quiero cargar un producto con nombre, marca, rubro, precio de compra, precio de venta y stock mínimo, para tenerlo listo para vender.
- Como dueño, quiero que el sistema genere un código de barras propio si el producto no trae uno de fábrica, para poder usar el lector igual.
- Como dueño o cajero, quiero buscar un producto por nombre o código, para encontrarlo rápido al vender.
- Como dueño, quiero filtrar el catálogo por marca y rubro, para revisar un grupo de productos a la vez.
- Como dueño, quiero cargar muchos productos de una sola vez desde una planilla de Excel, para no escribirlos uno por uno la primera vez.
- Como dueño, quiero que la planilla me avise qué filas tienen errores antes de confirmar la carga, para no meter datos mal.
- Como dueño, quiero imprimir etiquetas con el código de barras de los productos, para pegarlas en la mercadería.
- Como dueño, quiero ver el historial de cambios de precio de un producto, para saber cuándo y cuánto varió.
- Como dueño, quiero desactivar un producto que ya no se vende más, sin perder su historial de ventas.
- Como empleado sin el permiso de ver costos, quiero ver el catálogo sin que me muestre el precio de compra ni el margen, para no acceder a información que no me corresponde.

## 4. Requisitos funcionales

- El sistema permite crear, editar y desactivar/reactivar un producto con: nombre, marca, rubro (y subrubro opcional), foto (opcional), precio de compra, precio de venta, stock mínimo y código de barras.
- Si no se ingresa un código de barras, el sistema genera uno propio, que nunca coincide con uno real de fábrica.
- El sistema permite crear y editar marcas y rubros (con subrubros); no se puede borrar una marca o rubro que todavía tiene productos.
- El catálogo se puede buscar por nombre o código, y filtrar por marca y rubro. La lista está paginada de a 20 y conserva los filtros al cambiar de página (`?pagina=N`). *(Agregado 2026-10-20.)*
- El sistema permite importar productos desde una planilla de Excel o CSV, usando una plantilla descargable; antes de confirmar, muestra qué filas tienen errores y por qué.
- El sistema guarda un historial cada vez que cambia el precio de venta o de compra de un producto.
- El sistema permite generar e imprimir etiquetas con el código de barras de uno o varios productos.
- Un usuario sin el permiso "ver costos y márgenes" no ve el precio de compra, el margen ni el historial de precio de compra en ninguna pantalla ni exportación.
- Un usuario con permiso "editar" en Catálogo pero sin el permiso especial "cambiar precios" puede editar los demás datos del producto, pero no su precio de compra ni de venta.

## 5. Reglas de negocio

- El precio de venta lo define el dueño a mano; no hay margen automático ni recálculo masivo (`docs/PROJECT.md`, sección 5).
- Los montos se redondean al peso entero, hacia arriba desde 0,5 (constitución, regla 6).
- Editar el precio de un producto no cambia ventas ya hechas (constitución, regla 8) — el historial de precios es un registro que se agrega, nunca se sobrescribe.
- El stock no se maneja en esta spec: el stock mínimo es solo un umbral de alerta; las cantidades reales se manejan en la spec 005, por movimientos.
- Un producto desactivado no aparece para vender, pero conserva su historial intacto.
- No se puede borrar una marca o un rubro que tiene productos asociados (mismo criterio que los roles en la spec 002).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el catálogo (sin costos ni márgenes) | Permiso "ver" en Catálogo |
| Ver precio de compra, margen e historial de costos | Además, el permiso especial "ver costos y márgenes" |
| Crear/editar productos, marcas y rubros | Permiso "crear"/"editar" en Catálogo |
| Cambiar el precio de compra o de venta de un producto | Además, el permiso especial "cambiar precios" |
| Desactivar/reactivar un producto | Permiso "anular" en Catálogo |
| Importar productos desde Excel/CSV | Permiso "crear" en Catálogo |
| Exportar el catálogo o imprimir etiquetas | Permiso "exportar" en Catálogo |

## 7. Casos borde y errores

- Se ingresa un código de barras que ya existe en otro producto: se rechaza con un mensaje claro.
- Se genera un código propio y por alguna razón ya existe (colisión improbable pero posible): el sistema prueba el siguiente hasta encontrar uno libre.
- La planilla de importación tiene una fila con un dato obligatorio vacío o un precio inválido: esa fila se marca como error; no se importa nada hasta que el usuario corrija o descarte las filas con error.
- Se intenta borrar una marca o rubro con productos asociados: no se permite, hay que reasignar los productos primero.
- Un usuario sin permiso "ver costos y márgenes" intenta acceder a esos datos por una ruta directa: el servidor lo bloquea, no alcanza con ocultarlo en la interfaz.
- Un usuario sin el permiso "cambiar precios" intenta modificar el precio de un producto (editando el formulario a mano o llamando a la acción directamente): el servidor lo rechaza, aunque el resto de los campos del mismo formulario sí se guarden.
- Se sube una foto en un formato no soportado o demasiado pesada: se avisa con un mensaje claro, sin romper la carga del resto del producto.

## 8. Criterios de aceptación

- [x] Se puede crear un producto completo y aparece en el catálogo.
- [x] Un producto sin código de barras recibe uno generado por el sistema, válido y sin colisión.
- [x] Se puede buscar por nombre o código y filtrar por marca y rubro, con resultados correctos.
- [x] Se puede importar una planilla con productos válidos e inválidos mezclados, y el sistema señala las filas inválidas antes de confirmar nada (criterio global de `docs/PROJECT.md`, sección 9).
- [x] Cambiar el precio de un producto queda reflejado en su historial.
- [x] Se puede desactivar un producto y ya no aparece como disponible para vender, pero su historial sigue intacto.
- [x] No se puede borrar una marca o un rubro que tiene productos asociados.
- [x] Un usuario sin el permiso "ver costos y márgenes" no ve el precio de compra ni el margen en ninguna pantalla, probado con un rol real.
- [x] Un usuario con "editar" en Catálogo pero sin "cambiar precios" puede editar otros datos del producto, pero no su precio.
- [x] Se puede generar e imprimir una etiqueta con el código de barras de un producto.

## 9. Entidades previstas

A confirmar en el plan: `Brand`, `Rubro` (con relación a sí mismo para subrubros), `Product`, `ProductPriceHistory`.

## 10. Decisiones (ya confirmadas con el cliente)

- **Código de barras propio:** formato EAN-13 con prefijo reservado 20-29 (rango que el estándar GS1 reserva para uso interno de un comercio — nunca lo usa un fabricante real), secuencial + dígito verificador.
- **Etiquetas:** diseño simple (código de barras + nombre + precio) para imprimir en hoja A4 desde el navegador por ahora. El tamaño exacto (tipo de hoja autoadhesiva) se ajusta cuando el cliente decida qué va a usar — no es información crítica para construir el resto de esta spec.
