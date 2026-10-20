# Checklist de prueba manual — sistema completo desde cero

> Recorrido pensado para probar **todo el sistema a mano, de principio a fin**, en el orden en que se usa el negocio. Los datos de prueba están elegidos para que **cada número tenga un valor esperado** y puedas comparar. Tildá cada casilla (`[x]`) a medida que avanzás y anotá las fallas en la última sección.
>
> Fecha de la prueba: ____ / ____ / ________ · Probó: ______________ · Navegador: ______________

## 0. Antes de empezar

### 0.1 Entorno

- [ ] Estoy parado en la carpeta del proyecto, en **PowerShell**.
- [ ] Pasan las pruebas automáticas:
  ```powershell
  pnpm lint; pnpm test
  ```
  (esperado: sin errores, **133 tests** pasando)
- [ ] Levanté el servidor de desarrollo: `pnpm dev` → http://localhost:3000

### 0.2 Empezar de cero (opcional, pero los números de abajo suponen una base limpia)

> ⚠️ **Esto borra TODO** y no se puede deshacer: productos, marcas, rubros, stock, ventas, caja, pedidos, empleados, auditoría, fotos, los demás usuarios y los roles. Hacelo solo si en la base no hay datos reales que quieras conservar. **La base es la misma que usa el sitio publicado.** Si preferís no borrar, los valores esperados de Inicio y Analíticas (secciones 10, 13 y 14) no van a coincidir porque se suman a lo que ya haya.

1. Entrá como **Dueño** → **Configuración → pestaña Sistema**.
2. Revisá el resumen de lo que se va a borrar, escribí tu contraseña y la frase `REINICIAR EL SISTEMA`, y apretá **Reiniciar el sistema**.
3. Para volver a tener los roles de ejemplo (Encargado y Cajero), corré en PowerShell:

```powershell
pnpm db:seed
```

- [ ] Reinicié el sistema desde **Configuración → Sistema** y corrí el seed (queda solo el usuario Dueño y los roles de ejemplo).
- [ ] **No** corrí `seed-catalog.ts` (cargaría 50 productos de muestra que aparecerían en la lista de viaje y ensuciarían los números).

### 0.3 Datos que vamos a usar

| Producto | Precio de compra | Precio de venta | Stock mínimo |
|---|---|---|---|
| **A** — Cable USB-C 1m | $2.000 | $4.500 | 5 |
| **B** — Auriculares inalámbricos | $9.000 | $18.500 | 3 |
| **C** — Funda de celular | $1.200 | $3.000 | 5 |

Marca de prueba: **PruebaMarca** · Rubro de prueba: **PruebaRubro**.

---

## 1. Acceso, sesión y navegación

- [ ] Entrar a http://localhost:3000 sin sesión → me lleva a `/login`.
- [ ] El login muestra el logo, **El Maestro** y **Ecommerce**, y el formulario está centrado.
- [ ] El login pide **Usuario** y **Contraseña** (sin email). Usuario o contraseña incorrectos, o un usuario que no existe → el **mismo** mensaje de error, la pantalla no se rompe.
- [ ] Entrar con el usuario en mayúsculas, en minúsculas o con espacios de más (`el  maestro`) → entra igual (spec 016).
- [ ] Entro como **Dueño** → llego al **Inicio** (`/inicio`).
- [ ] Con sesión iniciada, ir a `/login` → me redirige al Inicio (`/inicio`).
- [ ] Con sesión iniciada, ir a `/` → me redirige al Inicio (`/inicio`). Sin sesión, `/` se ve en blanco, sin menú y sin pasar por el login (landing reservada para la tienda online, spec 015).
- [ ] La pestaña del navegador muestra el **ícono del logo** (negro, sin fondo) y el título "El Maestro Ecommerce".
- [ ] Menú lateral: arriba el logo con "El Maestro / Ecommerce"; secciones **Catálogo y stock** (Productos, Stock, Lista de viaje, Ingresos) y **Administración**; al pie **Cerrar sesión**.
- [ ] El botón del menú (☰) colapsa el menú a solo íconos y los tooltips muestran el nombre.
- [ ] **Cerrar sesión** abre una ventana "¿Salir del sistema?"; *Cancelar* no cierra; *Sí, salir* cierra y vuelve al login.
- [ ] Migas de pan en el header: en `/productos` dice *Productos*; en el detalle de un producto dice *Productos › Editar* y el primero es un enlace que vuelve.

## 2. Usuarios y roles (spec 002)

> Creá un rol limitado y un usuario cajero para usar más adelante en la sección 16.

- [ ] En **Usuarios → Roles** → **Nuevo rol** "Cajero de prueba": permisos *Ventas: ver y crear*, *Caja: ver y crear*, *Pedidos: ver*, *Catálogo: ver*, *Inventario: ver*. **Sin** permisos especiales.
- [ ] Guardar el rol → aparece en la lista.
- [ ] El rol **Dueño** no se puede borrar, renombrar ni editar sus permisos.
- [ ] **Usuarios → Nuevo usuario** con usuario `Cajero Prueba`, email `cajero.prueba@…` (se pide pero no se usa para ingresar), rol "Cajero de prueba" y una contraseña → queda creado y entra con `Cajero Prueba`.
- [ ] Crear otro usuario con `cajero prueba` (otras mayúsculas) → "Ese usuario ya existe.". Con `juan@gmail.com` o con símbolos → mensaje claro.
- [ ] Editar al cajero y cambiarle el usuario → entra con el nuevo y no con el viejo; el cambio figura en Auditoría.
- [ ] Editar el usuario y desactivarlo → ya no puede iniciar sesión; lo **vuelvo a activar**.
- [ ] No se puede desactivar al único usuario con rol Dueño.

## 3. Configuración y auditoría (spec 003)

- [ ] **Configuración**: cargo razón social "**El Maestro Ecommerce**" y texto adicional del ticket "**Gracias por su compra**" → guarda.
- [ ] **Configuración → Auditoría**: aparecen las acciones de las secciones anteriores (rol creado, usuario creado/desactivado…).
- [ ] La auditoría se puede filtrar por fecha, usuario y acción, y no tiene ningún botón para editar o borrar.
- [ ] *(Correcciones 2026-10-20, pruebas rápidas)* **Pedidos**: cobrar una seña abre un ticket con lo abonado, el total y lo que falta pagar, y se puede imprimir; el botón **Ticket de seña** del pedido lo vuelve a abrir. Al entregar lo último del pedido el ticket **queda abierto** para imprimirlo. En **Caja**, el pago de esa entrega dice "Pago total pedido de <cliente> (ticket #N)" y no "Venta #N".
- [ ] **Campanita**: con productos bajo el mínimo aparece el aviso de stock bajo con **Marcar leído**; al marcarlo desaparece y no vuelve hasta que otro producto quede bajo el mínimo.
- [ ] **Caja** y **Caja del día**: arriba se ven Entradas, Salidas y Total, y una tabla con Efectivo / Transferencia / Total.
- [ ] **Configuración → Sistema** (spec 017): solo el Dueño ve la pestaña; con otro rol no aparece.
- [ ] El botón "Reiniciar el sistema" queda deshabilitado hasta escribir la contraseña **y** la frase exacta; con la frase en minúsculas sigue deshabilitado.
- [ ] Con la contraseña incorrecta aparece "La contraseña es incorrecta. No se borró nada." y los datos siguen ahí.
- [ ] *(Solo si querés probar el reinicio real, después de la sección 18)* Con la contraseña correcta: vuelvo a **Inicio** con el aviso de que el sistema se reinició, no quedan productos, ventas ni usuarios (salvo el mío), la **Auditoría** tiene una sola entrada "Sistema reiniciado", la configuración del negocio sigue cargada y la primera venta nueva es el **ticket Nº 1**.

## 4. Catálogo de productos (spec 004)

### 4.1 Marcas y rubros

- [ ] En **Productos** hay pestañas **Productos · Marcas · Rubros**.
- [ ] Creo la marca **PruebaMarca** y el rubro **PruebaRubro**.
- [ ] Creo un subrubro dentro de PruebaRubro (aparece como "PruebaRubro > …" en los filtros).

### 4.2 Productos

- [ ] **Nuevo producto** A (Cable USB-C 1m): marca, rubro, compra $2.000, venta $4.500, mínimo 5, **sin** código de barras → el sistema le **genera** uno.
- [ ] Creo B (Auriculares, $9.000 / $18.500, mínimo 3) y C (Funda, $1.200 / $3.000, mínimo 5).
- [ ] Los tres aparecen en la lista con stock **0**.
- [ ] Búsqueda por nombre y por código encuentra el producto; los filtros de marca y rubro funcionan.
- [ ] Cambio el precio de venta de C a $3.500 y lo **vuelvo a $3.000** → el historial de precios del producto muestra los dos cambios.
- [ ] **Etiquetas** (`/productos/etiquetas`): genero e imprimo una etiqueta con código de barras de A.
- [ ] **Importar** (`/productos/importar`): subo una planilla con filas válidas e inválidas → señala las inválidas **antes** de confirmar. (Cancelo sin importar.)
- [ ] Intento borrar la marca PruebaMarca con productos → no me deja.

## 5. Ingreso de mercadería y stock (specs 006 y 005)

### 5.1 Ingreso

- [ ] **Ingresos → Nuevo ingreso** con 3 ítems: **A × 10 a $2.000**, **B × 5 a $9.000**, **C × 8 a $1.200**.
- [ ] Un ítem con dato inválido → no guarda nada hasta corregirlo.
- [ ] Confirmo → el ingreso aparece en el historial con su detalle.

### 5.2 Stock

- [ ] **Stock** muestra A = **10**, B = **5**, C = **8**.
- [ ] Ajusto el stock de C de 8 a 9 con motivo "Prueba" y lo **vuelvo a 8** → el historial del producto muestra los dos movimientos.
- [ ] **Conteo físico** (`/inventario/conteo`): cuento A = 10, B = 5, C = 8 → se ven las diferencias (ninguna) **antes** de confirmar.
- [ ] El filtro de estado de Stock y la búsqueda funcionan.

## 6. Caja — turno 1 (spec 007)

### 6.1 Apertura

- [ ] **Caja** sin turno abierto: panel "No hay una caja abierta" con el formulario para abrir.
- [ ] Abro con monto inicial **$10.000**.
- [ ] Encabezado: etiqueta **Abierta**, quién la abrió, cuándo y "$10.000 de efectivo inicial".
- [ ] Intento abrir otra caja → no se puede (hay una abierta).

### 6.2 Movimientos manuales (desde los modales)

- [ ] **Registrar ingreso** → efectivo **$2.000**, concepto "Aporte cambio".
- [ ] **Registrar egreso** → efectivo **$1.500**, concepto "Flete".
- [ ] **Registrar egreso** → **Transferencia $800**, concepto "Pago proveedor": **exige** los últimos 4 dígitos (uso `4321`); en efectivo **no** los pide.
- [ ] Un monto de 0 o un concepto vacío → mensaje de error.
- [ ] Tarjetas ahora: **Efectivo esperado $10.500** (10.000 + 2.000 − 1.500) · **Ingresos $2.000** · **Egresos $2.300** · **Transferencias −$800**.

## 7. Ventas (spec 008)

### 7.1 Venta 1 — efectivo con vuelto

- [ ] **Ventas** muestra la etiqueta "Caja abierta". Con la caja cerrada (lo probás en la sección 11) muestra el panel con "Ir a Caja".
- [ ] Busco "cable" → los resultados **flotan** debajo del buscador (no empujan la pantalla), con código y **stock** ("Stock: 10").
- [ ] Agrego **A × 2** y **B × 1** (con "+" / "−" y el campo de cantidad) → total **$27.500**. Resumen a la derecha: 2 productos distintos · 3 unidades.
- [ ] **Cobrar** → el modal muestra el total y el monto ya cargado en Efectivo.
- [ ] Escribo **Efectivo recibido $30.000** → **Vuelto $2.500**.
- [ ] Confirmo → aparece el **ticket** en un modal (ver 7.4).

### 7.2 Venta 2 — pago dividido

- [ ] Agrego **C × 3** (total **$9.000**), **Cobrar** → **Dividir pago**: efectivo **$4.000** y en la segunda línea **Transferencia** con **"Poner el resto"** → $5.000, últimos 4 dígitos `1234`.
- [ ] Mientras no cierre el total el modal dice "Falta cobrar…" / "Sobran…" y **Confirmar venta** está deshabilitado.
- [ ] Confirmo → ticket.

### 7.3 Venta 3 — para anular

- [ ] Vendo **A × 1** ($4.500) en efectivo. (La anulamos en 7.6.)
- [ ] Escaneo/tipeo el **código de barras exacto** de B en el buscador y Enter → se agrega al carrito **sin hacer clic**. (Lo quito del carrito antes de cobrar.)

### 7.4 El ticket (modal)

- [ ] Tras confirmar, el ticket aparece **en una ventana modal** con los botones **Imprimir** y **Nueva venta**.
- [ ] Contenido: razón social, "Ticket #N", fecha y hora, "Atendió: …", ítems con monto a la derecha, **TOTAL**, el texto "Gracias por su compra" y "DOCUMENTO NO VÁLIDO COMO FACTURA".
- [ ] **Imprimir** abre el **diálogo de impresión del navegador** con **solo el ticket** (sin el resto de la pantalla).
- [ ] **Nueva venta** cierra el modal y deja el carrito vacío.

### 7.5 Stock y caja después de vender

- [ ] **Stock**: A = **7**, B = **4**, C = **5**.
- [ ] **Caja** tiene un cobro por cada forma de pago usada (la venta 2 genera dos).

### 7.6 Anulación

- [ ] **Ventas → Historial** abre en **Caja actual** y lista las 3 ventas.
- [ ] Abro la **venta 3** → **Anular venta** abre un modal que explica qué pasa y **exige el motivo** ("Prueba").
- [ ] Tras anular: aviso rojo "Esta venta fue anulada" con quién, cuándo y motivo; el monto queda tachado en el historial.
- [ ] **Stock**: A vuelve a **8**. En **Caja** aparece un egreso en efectivo de **$4.500** ("Anulación venta #…").

### 7.7 Historial por período

- [ ] Selector **Caja actual · Hoy · Últimos 7 días · Todas**; la columna **Caja** aparece al mirar más que el turno actual (las ventas del turno abierto dicen **Actual**).
- [ ] Pestañas **Todas (3) · Activas (2) · Anuladas (1)** con sus cantidades.
- [ ] **Reimprimir ticket** desde el detalle abre el modal y deja registrada la reimpresión (aparece en el panel "Reimpresiones").

## 8. Caja — movimientos y acciones (spec 007, parte 2)

Estado esperado de la caja después de las ventas (turno 1):

| Dato | Esperado |
|---|---|
| Efectivo esperado | **$42.000** |
| Ingresos del turno | **$43.000** (efectivo $38.000 · transferencia $5.000) |
| Egresos del turno | **$6.800** (efectivo $6.000 · transferencia $800) |
| Transferencias del turno | **$4.200** |

- [ ] Las **cuatro tarjetas** muestran exactamente esos valores.
- [ ] Pestañas **Todos · Ingresos · Egresos · Por medio de pago** con sus contadores; el tipo es una etiqueta y los montos llevan signo (+/−, egresos en rojo).
- [ ] **Por medio de pago**: Efectivo $38.000 / $6.000 / **$32.000** · Transferencia $5.000 / $800 / **$4.200**, y la cuenta "Efectivo esperado = $10.000 + $32.000 = **$42.000**".
- [ ] En los movimientos que vienen de una venta hay un botón **Acciones** (⋯) con **Ver venta** y **Reimprimir ticket**; los movimientos manuales (aporte, flete, proveedor) **no** lo tienen.
- [ ] *Reimprimir ticket* desde Caja abre el modal del ticket y queda registrado.
- [ ] *Ver venta* abre el detalle de la venta en el historial.

## 9. Pedidos — antes de cerrar la caja (spec 009)

> Los pedidos con seña necesitan caja abierta. Para no cambiar los números del turno 1, primero miramos el Inicio (sección 10), después **cerramos esta caja** (sección 11) y hacemos los pedidos en el **turno 2** (sección 12). Así también probamos un segundo turno en el mismo día.

---

## 10. Inicio con el turno 1 abierto (spec 012)

Mirá el **Inicio** *antes* de cerrar la caja:

| Tarjeta | Esperado |
|---|---|
| **Estado de caja** | Abierta · nombre del Dueño · desde la hora de apertura |
| **Efectivo esperado** | $42.000 |
| **Ventas del turno** | **$36.500** · 2 ventas (la anulada no cuenta) |
| **Transferencias del turno** | $4.200 |
| **Ingresos de hoy** | $43.000 |
| **Egresos de hoy** | $6.800 |
| **Neto de hoy** | $36.200 |
| **Ventas de hoy** | $36.500 · 2 ventas |

- [ ] Las 8 tarjetas coinciden (dos filas de 4: "Turno actual" y "Hoy").
- [ ] Gráfico **Cobrado hoy por medio de pago**: efectivo **$31.500** · transferencia **$5.000** (la dona muestra el total cobrado al centro).
- [ ] Gráfico **Top 5 productos más vendidos hoy**: **C (3)**, **A (2)**, **B (1)** — en ese orden; la venta anulada no cuenta.
- [ ] Lista **Productos bajo el mínimo**: todavía ninguno (A=8, B=4, C=5 → ninguno por debajo).
- [ ] Lista **Pedidos pendientes**: "No hay pedidos pendientes".

## 11. Cierre de caja y turno 2

### 11.1 Cierre del turno 1

- [ ] **Cerrar caja** abre el modal y **no** muestra el efectivo esperado antes de contar.
- [ ] Cuento **$41.000** → **Calcular diferencia** → Esperado **$42.000** · Contado **$41.000** · Diferencia **−$1.000** (en rojo).
- [ ] Sin motivo no deja confirmar; con motivo "Faltante de prueba" cierra.
- [ ] Aparece "Caja cerrada" y la pantalla pasa a "No hay una caja abierta".
- [ ] **Historial de caja** (`/caja/historial`): el turno cerrado muestra su diferencia; su detalle lista los movimientos y se puede **imprimir** el resumen del cierre.
- [ ] Un turno cerrado y sus movimientos **no se pueden editar ni borrar**.

### 11.2 Abrir el turno 2

- [ ] Abro una nueva caja con **$5.000**.
- [ ] En **Ventas → Historial** el selector abre en **Caja actual** (vacía) y en **Hoy** se ven las ventas del turno 1 con su caja indicada.

## 12. Pedidos (spec 009) — en el turno 2

### 12.1 Crear pedidos

- [ ] **Pedidos → Nuevo pedido**: cliente **María Gómez**, teléfono, canal **Instagram**, productos **A × 3** y **B × 2**. Se puede crear **sin seña**.
- [ ] Creo **Juan Pérez** con **C × 2**.
- [ ] Creo **Laura Díaz** con **C × 4** y **la dejo pendiente** (la usamos para la lista de viaje).
- [ ] La lista de pedidos abre en **Pendientes** y muestra los 3.

### 12.2 Detalle del pedido de María

- [ ] Encabezado: nombre, **Pendiente**, teléfono · canal · "Creado por … el …" y los botones **Entregar · Cobrar seña · Cancelar pedido**.
- [ ] Tarjetas: **Entregado 0 de 5** · **Total del pedido $50.500** · **Seña: Sin seña** · **Falta cobrar $50.500**.
- [ ] Panel **Buscar producto**: la lista flota, muestra **stock** y un código de barras exacto agrega solo.
- [ ] Agrego otra vez el producto **A** → **suma a su línea** (no crea otra); lo dejo en 3 con el "−".
- [ ] Cantidad con "−" / "+": **no baja de 1**; en un pedido **no pendiente** no se puede cambiar.
- [ ] **Cobrar seña**: **$10.000** en efectivo → toast "Seña cobrada"; la tarjeta Seña dice **$10.000** y "Saldo a favor $10.000"; el botón *Cobrar seña* desaparece.
- [ ] Una seña por transferencia **exige** los 4 dígitos (probalo en Juan, ver 12.4).

### 12.3 Entregas de María

**Entrega 1 — la seña cubre todo:**

- [ ] **Entregar** → pongo **A en 2** y **B en 0** (con "−" y "+"): total de la entrega **$9.000**, "Se descuenta de la seña −$9.000", **A cobrar $0**.
- [ ] El botón dice **Confirmar entrega** (no pasa al cobro) → aparece el **ticket** con **Seña aplicada $9.000** y **Saldo a favor $1.000**.
- [ ] El pedido sigue **Pendiente**; la tarjeta dice "Entregado 2 de 5"; el producto A queda **Parcial**.
- [ ] No se puede **quitar** A (ya tiene entregas) y su cantidad no baja de 2.

**Entrega 2 — con cobro:**

- [ ] **Entregar** → lo que queda (A × 1 y B × 2): total **$41.500**, se descuentan **$1.000** de la seña, **A cobrar $40.500**.
- [ ] **Continuar al cobro** abre el modal "Cobrar entrega" ("Resto a cobrar $40.500").
- [ ] Pago dividido: **efectivo $20.000** + **transferencia $20.500** (dígitos `9999`) → confirmo.
- [ ] Ticket de la entrega con seña aplicada $1.000 y saldo a favor $0.
- [ ] El pedido pasa a **Cerrado** solo; el detalle muestra el panel **Entregas realizadas** con las 2 y "Ver ticket" abre el modal.

### 12.4 Cancelaciones

- [ ] En la lista de pedidos, el menú **Acciones** (⋯) de **Juan Pérez** tiene **Ver detalle** y **Cancelar pedido**.
- [ ] Primero en el detalle de Juan: **Cobrar seña** **$1.500** por **transferencia** (dígitos `5555`).
- [ ] Vuelvo a la **lista** y cancelo a Juan desde **Acciones → Cancelar pedido**: el modal avisa que la seña no usada se **devuelve como egreso**; exige motivo ("Prueba") → confirmo.
- [ ] Juan queda **Cancelado** (aviso rojo con el motivo en su detalle, sin botones de acción) y en **Caja** hay un **egreso por transferencia de $1.500**.
- [ ] Un pedido **cerrado o cancelado** no tiene "Cancelar pedido" en el menú de la lista.
- [ ] Filtro de estado de la lista: Pendientes / Cerrados / Cancelados / Todos.
- [ ] **Exportar** la lista de pedidos descarga el Excel.

## 13. Pantallas que se alimentan de todo lo anterior

### 13.1 Stock

Stock esperado ahora: **A = 5**, **B = 2**, **C = 5**.

- [ ] **Stock** coincide y señala **B** como producto por debajo del mínimo (2 < 3).
- [ ] La columna **Comprometido** de C muestra **4** (el pedido pendiente de Laura).

### 13.2 Lista de viaje (spec 012)

Se llega desde el menú (**Catálogo y stock → Lista de viaje**) y desde el Inicio.

| Producto | Stock | Mínimo | Pedido | Disponible | Sugerida |
|---|---|---|---|---|---|
| B — Auriculares | 2 | 3 | 0 | 2 | **1** |
| C — Funda | 5 | 5 | 4 | 1 | **4** |

- [ ] La tabla muestra **solo** B y C con esos números (A no aparece: 5 no es menor que 5).
- [ ] Filtros: **Nombre o código**, **Marca** y **Rubro** (los mismos que Productos y Stock) achican la lista; "Filtrar" los aplica.
- [ ] **Copiar** copia el texto `1 x Auriculares…` / `4 x Funda…` (pegalo en el bloc de notas).
- [ ] **Exportar Excel** descarga la hoja con las 6 columnas y respeta el filtro.

### 13.3 Inicio con dos turnos en el día

Con el turno 1 cerrado y el turno 2 abierto (con $5.000 de apertura):

| Tarjeta | Esperado |
|---|---|
| Efectivo esperado (turno actual) | **$35.000** (5.000 + seña 10.000 + cobro 20.000) |
| Ventas del turno | **$50.500** · 2 ventas (las dos entregas: $9.000 + $41.500) |
| Transferencias del turno | **$20.500** (ingresos 20.500 + 1.500 de seña, menos 1.500 devueltos) |
| Ingresos de hoy | **$95.000** |
| Egresos de hoy | **$8.300** |
| Neto de hoy | **$86.700** |
| Ventas de hoy | **$87.000** · 4 ventas |

- [ ] Las tarjetas "Hoy" suman **los dos turnos**; las de "Turno actual" solo el turno 2.
- [ ] Gráfico **Top 5 de hoy**: **A (5)**, **B (3)**, **C (3)** (B antes que C por mayor importe).
- [ ] **Cobrado hoy por medio de pago**: efectivo **$51.500** · transferencia **$25.500**.
- [ ] Lista **Pedidos pendientes**: solo **Laura Díaz** (1).
- [ ] Lista **Productos bajo el mínimo**: **B** y **C**, con su disponible y sugerida.
- [ ] Cerrar la caja del turno 2 y volver al Inicio: "Estado de caja: **Cerrada**", las otras tres tarjetas del turno con "—" y las de "Hoy" siguen calculándose.

### 13.4 Notificaciones (spec 013)

- [ ] La **campanita** del header es visible en todas las pantallas.
- [ ] Hay avisos de **pedido nuevo** (3), de **diferencia de caja** (−$1.000 del turno 1) y de **stock bajo** (B y C).
- [ ] Marco un aviso de pedido como **leído** → deja de contar; el aviso de stock bajo **no** se puede marcar (desaparece solo al reponer).
- [ ] Dejo la pantalla abierta ~1 minuto: se actualiza sola, sin recargar.

## 14. Analíticas (spec 011)

Rango por defecto: **el mes en curso**. Esperado con todo lo anterior:

| Tarjeta | Esperado |
|---|---|
| Total vendido | **$87.000** |
| Cantidad de ventas | **4** |
| Ticket promedio | **$21.750** |
| Unidades vendidas | **11** |
| Ventas anuladas | **1** · $4.500 anulados |
| Venta más grande | **$41.500** (la entrega 2) |
| Costo de lo vendido | **$40.600** |
| Margen | **$46.400** · 53,3 % |

- [ ] Las **8 tarjetas** (dos filas de 4) coinciden; "Período anterior" muestra $0 (no hay ventas el mes pasado).
- [ ] Gráfico **Top 5 productos más vendidos** (A, B, C) y gráfico **Cobrado por medio de pago** (efectivo $51.500 · transferencia $25.500).
- [ ] **Margen por marca** y **por rubro** muestran PruebaMarca / PruebaRubro con $46.400.
- [ ] Tablas **Ventas por empleado**, **por canal** y **por turno de caja** (el turno 1 y el turno 2 aparecen separados).
- [ ] **Filtros**: *Desde*, *Hasta*, *Empleado* y *Medio de pago* (solo esos cuatro). Filtrar por **Transferencia** achica los números.
- [ ] **Exportar Excel** y **Exportar PDF** descargan archivos con los datos filtrados.
- [ ] Un usuario **sin** "ver costos y márgenes" no ve ni Costo, ni Margen ni sus tablas (se prueba en la sección 16).

## 15. Empleados (spec 010)

- [ ] **Empleados → Nuevo**: creo la ficha de un empleado con **usuario nuevo** en el mismo paso.
- [ ] Creo otra ficha vinculada a un **usuario ya existente** sin ficha (ej.: el cajero de prueba).
- [ ] No deja crear una segunda ficha para el mismo usuario ni repetir el **DNI**.
- [ ] Edito datos de la ficha y guardo.
- [ ] La lista muestra **activos** por defecto, con filtro para ver dados de baja o todos.
- [ ] **Dar de baja** a un empleado: queda con fecha de baja, su usuario **no puede iniciar sesión** y su historial se conserva.

## 16. Permisos — probar con el usuario "Cajero de prueba"

Cerrá sesión y entrá como el cajero.

- [ ] El menú **solo** muestra lo permitido (Inicio, Ventas, Caja, Pedidos, Productos, Stock…); **no** aparecen Usuarios, Analíticas ni Configuración.
- [ ] Entrar por URL directa a `/usuarios`, `/analiticas` o `/configuracion` → mensaje de falta de permiso, no datos.
- [ ] Con la caja abierta, el cajero **puede vender** y registrar ingresos/egresos.
- [ ] **No** ve el botón **Cerrar caja** (sin el permiso especial "cerrar caja").
- [ ] En el detalle de una venta **no** ve **Anular** ni **Reimprimir** (sin los permisos especiales).
- [ ] En **Caja → Movimientos**, el menú de acciones solo ofrece lo que tiene permitido (sin "Reimprimir ticket").
- [ ] En **Productos** no ve el **precio de compra** ni el margen.
- [ ] En **Stock** no puede ajustar stock ni confirmar un conteo.
- [ ] En el **Inicio** ve solo las secciones de los módulos que tiene (sin Inventario/Pedidos si no los tiene).
- [ ] Volvé al Dueño y dale al rol el permiso especial **"reimprimir tickets"** → el cajero (al volver a entrar) ve ahora **Reimprimir ticket**.

## 17. Impresora real y dispositivos

> Es lo más importante de probar con el hardware real.

- [ ] Imprimo un **ticket de venta** en la **térmica de 58 mm**: ninguna línea se corta, los montos quedan alineados a la derecha y los separadores `====` / `----` llegan completos.
  - Si se **cortan líneas**: bajar `MAX` en `src/lib/ticket-texto.ts` (hoy 24).
  - Si **sobra margen**: subirlo.
- [ ] Los acentos y la eñe salen bien ("Atendió", "Seña", "VÁLIDO"). Si no: avisar y se cambian por texto sin acentos.
- [ ] Imprimo el ticket de una **entrega de pedido con seña** (muestra "Seña aplicada" y "Saldo a favor").
- [ ] Imprimo el **resumen de cierre de caja** (`/caja/historial/[id]`).
- [ ] Imprimo una **etiqueta con código de barras** y la escaneo con el **lector USB**: en Ventas el producto se agrega solo.
- [ ] **Celular**: el menú es un cajón (☰); la venta muestra la barra fija de abajo con el total y **Cobrar**; las tablas no se salen de la pantalla; los modales caben.
- [ ] **PWA**: instalo la app desde Chrome (desinstalar antes la anterior si estaba instalada) → el ícono es el **logo blanco** sobre la barra oscura y el nombre es "El Maestro".

## 18. Al terminar

- [ ] Si todo pasó, avisame y **tildo los criterios** de las specs 007, 008, 009 y 012 en sus `spec.md` y `tasks.md` (las casillas "Verificación manual").
- [ ] Anoté abajo cada falla para arreglarla en una próxima sesión.
- [ ] Commits: agrupar por bloque (menú y marca · Analíticas · Inicio · Caja · Ventas · Pedidos).

---

## Registro de fallas

| # | Pantalla / paso | Qué pasó | Qué esperaba | Gravedad (alta / media / baja) |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |
