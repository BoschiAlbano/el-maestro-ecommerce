# Spec 017 — Reinicio del sistema

| | |
|---|---|
| **Estado** | Aprobada (2026-10-20) |
| **Depende de** | 002, 003 (y todas las que guardan datos: 004 a 013) |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Que el Dueño pueda **borrar todos los datos del sistema y arrancar desde cero** con un solo procedimiento, desde la pantalla de Configuración, sin tocar la base de datos a mano.

Sirve para pasar de la etapa de pruebas a la operación real: hoy el sistema tiene datos de prueba (productos de ejemplo, ventas, usuarios de práctica) y limpiarlos requiere correr un script por consola. Esta spec lo convierte en una acción controlada y segura dentro de la aplicación.

Es una acción **irreversible**: una vez hecha, los datos no se pueden recuperar desde el sistema.

## 2. Alcance

**Incluye:**

- Una pestaña **"Sistema"** en `/configuracion`, visible solo para el Dueño, con la acción "Reiniciar el sistema".
- Antes de borrar, un resumen de **qué se va a borrar** (cantidades) y una **doble confirmación**: la contraseña del Dueño y escribir una frase exacta.
- Borrar todos los datos de negocio, los demás usuarios (incluida su cuenta de acceso) y las fotos de productos.
- Dejar el sistema usable: el Dueño que hizo el reinicio sigue dentro, con su rol y la configuración del negocio.

**No incluye:**

- Hacer una copia de seguridad ni poder deshacer el reinicio.
- Un reinicio parcial (solo ventas, solo productos, etc.): es todo o nada.
- Reiniciar por programación ni desde la consola; esta spec es solo la pantalla.
- Cambios en el esquema de la base de datos ni en las migraciones.
- Recrear los datos de ejemplo después del reinicio (los roles Encargado y Cajero, el catálogo de ejemplo): el sistema queda vacío.

## 3. Historias de usuario

- Como **dueño**, quiero borrar todos los datos de prueba con un solo procedimiento, para empezar a usar el sistema con datos reales sin arrastrar nada.
- Como **dueño**, quiero que el reinicio me pida contraseña y una frase de confirmación, para no borrar todo por un clic o por haber dejado la sesión abierta.
- Como **dueño**, quiero ver qué se va a borrar antes de confirmar, para estar seguro de lo que estoy haciendo.
- Como **dueño**, quiero que después del reinicio siga pudiendo entrar con mi usuario, para no quedarme sin acceso al sistema.
- Como **empleado**, quiero que esta acción no esté disponible para mí, para que nadie borre todo por error.

## 4. Requisitos funcionales

- **RF-1.** `/configuracion` tiene una pestaña **"Sistema"**, junto a "Ticket" y "Artículos" (spec 003). Solo la ve el Dueño; para cualquier otro rol la pestaña no aparece, aunque tenga permiso de editar Configuración.
- **RF-2.** La pestaña explica en lenguaje claro qué hace el reinicio, que es irreversible y que la base de datos es la misma que usa el sitio publicado.
- **RF-3.** La pestaña muestra un **resumen de lo que se borrará**: cantidad de productos, marcas, rubros, ventas, pedidos, ingresos de mercadería, turnos de caja, empleados, usuarios (sin contar al Dueño) y entradas de auditoría.
- **RF-4.** Para ejecutar el reinicio hay que **escribir la contraseña del Dueño** y **escribir exactamente la frase `REINICIAR EL SISTEMA`**. El botón "Reiniciar el sistema" no se habilita hasta completar ambas.
- **RF-5.** El servidor **vuelve a verificar** que quien lo pide es Dueño, que la contraseña es correcta y que la frase coincide; no confía en lo que haya validado la pantalla (constitución, regla 14). Si algo falla, no se borra nada y se muestra el motivo.
- **RF-6.** El reinicio borra, en una sola operación sobre la base de datos: productos y su historial de precios, marcas, rubros, movimientos y conteos de stock, ingresos de mercadería, turnos y movimientos de caja, ventas y reimpresiones de ticket, pedidos, empleados, notificaciones y el registro de auditoría anterior.
- **RF-7.** El reinicio borra también **todos los usuarios excepto el Dueño que lo ejecuta**, junto con su cuenta de acceso en Supabase Auth, y todos los roles excepto "Dueño" con sus permisos.
- **RF-8.** El reinicio borra las **fotos de productos** guardadas en el almacenamiento (Supabase Storage).
- **RF-9.** Quedan: el usuario Dueño que ejecutó el reinicio (con su contraseña, su usuario y su sesión), el rol "Dueño" con todos sus permisos, la **configuración del negocio** (razón social, texto adicional del ticket, stock mínimo por defecto) y **una única entrada de auditoría** que dice que el sistema fue reiniciado, quién lo hizo y cuándo (RF-13).
- **RF-10.** Los contadores vuelven a empezar: el primer ticket después del reinicio es el número 1, igual que en un sistema nuevo.
- **RF-11.** Al terminar, el Dueño vuelve a `/inicio` con un mensaje de que el sistema se reinició, y ve el sistema vacío (sin productos, sin ventas, sin caja abierta).
- **RF-13.** El reinicio deja **una sola entrada de auditoría**, "Sistema reiniciado", con el usuario que lo ejecutó y la fecha y hora, creada dentro de la misma transacción que el borrado. Es la primera entrada del registro nuevo y se ve en Auditoría como cualquier otra.
- **RF-12.** Si algo falla a mitad de camino, el sistema avisa **qué quedó sin borrar** (por ejemplo, fotos o cuentas de acceso) y permite volver a intentarlo; el reinicio se puede repetir sin problemas.

## 5. Reglas de negocio

- **Solo el Dueño.** No existe permiso de matriz para esta acción: es una condición de rol, igual que gestionar usuarios y roles (spec 002).
- **El Dueño que ejecuta no se borra a sí mismo.** Si hay más de un usuario con rol Dueño, los demás también se borran; queda únicamente quien hizo el reinicio.
- **Todo o nada en la base de datos.** El borrado de datos de negocio ocurre en una sola transacción: si falla, la base queda como estaba. Lo que vive fuera de la base (cuentas de acceso y fotos) se borra después y se informa si algo no se pudo (RF-12), porque no puede formar parte de la misma transacción.
- **Nada se borra sin confirmación válida.** Sin la contraseña y la frase correctas no se toca ningún dato.
- **El registro de auditoría anterior se borra** (RF-6), pero el reinicio deja una única entrada propia (RF-13): es la única forma de saber, después, que se hizo un borrado total.
- **Los usuarios borrados pierden el acceso de inmediato**: sus sesiones abiertas dejan de servir porque su cuenta ya no existe.
- **La base de datos es la misma que usa el sitio publicado** (hay un solo proyecto de Supabase). Reiniciar desde el entorno de desarrollo afecta también al sitio publicado.
- Los montos y fechas siguen las reglas de la constitución; esta spec no calcula ninguno.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver la pestaña "Sistema" y el resumen de lo que se borrará | Dueño |
| Ejecutar el reinicio del sistema | Dueño (con su contraseña y la frase de confirmación) |

Ningún otro rol puede verla ni ejecutarla, ni siquiera con permiso "editar" en Configuración.

## 7. Casos borde y errores

- **Contraseña incorrecta o frase mal escrita:** se rechaza con un mensaje claro y no se borra nada.
- **Un usuario que no es Dueño llama a la acción directamente** (sin pasar por la pantalla): el servidor la rechaza.
- **Hay una caja abierta o pedidos pendientes:** el resumen lo destaca ("hay un turno de caja abierto", "hay N pedidos pendientes") y aun así se permite continuar, porque el objetivo es empezar de cero. Queda claro en la pantalla que se pierden.
- **Falla el borrado de la base de datos:** no se borra nada (transacción) y se informa el error.
- **Falla el borrado de alguna cuenta de acceso o de alguna foto:** los datos de la base ya se borraron; se informa cuáles quedaron y se puede repetir el reinicio para limpiarlas (RF-12).
- **El navegador se cierra o se corta la conexión a mitad del proceso:** como el borrado de la base es una sola transacción, queda hecho completo o no hecho; lo externo se completa repitiendo el reinicio.
- **Doble clic en el botón:** el botón se deshabilita mientras se procesa, para no ejecutarlo dos veces.
- **Reiniciar un sistema que ya está vacío:** funciona igual y el resumen muestra ceros.
- **Otro usuario con sesión abierta mientras se reinicia:** al borrarse su cuenta, en su próxima acción es llevado al login.

## 8. Criterios de aceptación

- [ ] Un usuario que no es Dueño no ve la pestaña "Sistema" y, si intenta ejecutar el reinicio directamente contra el servidor, es rechazado.
- [ ] La pestaña "Sistema" muestra el resumen con las cantidades reales de lo que se borrará.
- [ ] El botón "Reiniciar el sistema" no se habilita hasta escribir la contraseña y la frase `REINICIAR EL SISTEMA`.
- [ ] Con la contraseña incorrecta, o con la frase mal escrita, no se borra nada.
- [ ] Después del reinicio no quedan productos, marcas, rubros, stock, ingresos, ventas, pedidos, turnos ni movimientos de caja, empleados ni notificaciones, y la auditoría tiene una sola entrada: "Sistema reiniciado", con quién y cuándo.
- [ ] Después del reinicio no quedan otros usuarios (ni su cuenta de acceso) ni otros roles que no sean "Dueño".
- [ ] Las fotos de productos ya no están en el almacenamiento.
- [ ] El Dueño sigue pudiendo entrar con su usuario y su contraseña, con su rol y todos los permisos, y la configuración del negocio se conserva.
- [ ] La primera venta posterior al reinicio tiene el ticket número 1.
- [ ] Si algo externo falla, se informa qué quedó sin borrar y repetir el reinicio lo completa.
- [ ] Hay pruebas unitarias de la validación de la confirmación (frase exacta, contraseña obligatoria) y del armado del resumen.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Decisiones

Confirmadas con el cliente (2026-10-20):

1. **Auditoría:** el reinicio deja una única entrada de auditoría propia (RF-13).
2. **Contadores:** el número de ticket vuelve a 1 (RF-10).
3. **Qué queda:** solo el Dueño que ejecuta, su rol y la configuración del negocio (RF-9).
4. **Confirmación:** contraseña del Dueño y la frase `REINICIAR EL SISTEMA` (RF-4).
5. **Fotos:** se borran del almacenamiento (RF-8).

No quedan preguntas abiertas.
