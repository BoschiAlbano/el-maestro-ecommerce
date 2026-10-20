# Spec 002 — Usuarios, roles y permisos

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 001 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Que el dueño cree usuarios y roles, y controle qué puede ver y hacer cada uno en cada módulo.

## 2. Alcance

**Incluye:**

- Alta, edición y desactivación de usuarios
- Roles creados por el dueño, con algunos roles de ejemplo cargados de inicio
- Matriz de permisos por módulo y acción: ver, crear, editar, anular y exportar
- Permisos especiales: ver costos y márgenes, anular ventas, ajustar stock, reimprimir tickets, cerrar caja y cambiar precios
- El rol Dueño es fijo: no se puede borrar ni quedar sin permisos
- Verificación de permisos en el servidor y ocultamiento en la interfaz

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. Tampoco incluye el registro de auditoría en sí (quién hizo qué y cuándo queda guardado) — eso es la spec 003. Esta spec define **quién puede** hacer cada cosa; la 003 define **qué queda anotado** cuando la hace.

## 3. Historias de usuario

- Como dueño, quiero crear una cuenta para cada empleado, para que cada uno entre con su propio usuario y contraseña.
- Como dueño, quiero editar o desactivar la cuenta de un empleado que ya no trabaja conmigo, para que no pueda seguir entrando al sistema.
- Como dueño, quiero crear roles con un nombre y una matriz de permisos, para no tener que configurar los permisos uno por uno para cada empleado.
- Como dueño, quiero asignarle un rol a cada usuario, para que tenga acceso solo a lo que necesita para su trabajo.
- Como dueño, quiero decidir qué roles pueden ver los costos y márgenes, para no exponer esa información a quien no corresponde.
- Como dueño, quiero decidir qué roles pueden anular ventas, ajustar stock, reimprimir tickets, cerrar caja o cambiar precios, porque son acciones delicadas que pueden generar pérdidas si se usan mal.
- Como empleado, quiero ver en la interfaz solo las opciones que mi rol me permite usar, para no confundirme con botones que no puedo tocar.
- Como dueño, quiero que mi propio rol (Dueño) no se pueda borrar ni quedar sin permisos, para no bloquearme a mí mismo el acceso al sistema por error.

## 4. Requisitos funcionales

- El sistema permite al dueño crear un usuario con email; la cuenta queda lista para iniciar sesión.
- El sistema permite al dueño cambiarle a un usuario el email (que es su usuario de ingreso) y fijarle una contraseña nueva, sin que la contraseña quede guardada en la auditoría (solo que se cambió). *(Agregado 2026-10-20 a pedido del cliente.)*
- Desde la lista de usuarios, un menú de acciones por fila permite ver el detalle o desactivar/reactivar directamente. *(Agregado 2026-10-20.)*
- El menú lateral tiene una entrada "Roles" (junto a "Usuarios", solo para el Dueño) que lleva a la lista de roles, desde donde se crean, editan y borran. *(Agregado 2026-10-20: el CRUD existía pero no tenía acceso desde el menú.)*
- El sistema permite al dueño editar los datos de un usuario y desactivarlo sin borrar su historial (ventas, movimientos de caja, etc. siguen existiendo con su nombre).
- Un usuario desactivado no puede iniciar sesión, aunque conserve su contraseña.
- El sistema permite al dueño crear, editar y borrar roles, salvo el rol Dueño.
- Cada rol tiene una matriz de permisos por módulo de negocio, con cinco acciones posibles por módulo: ver, crear, editar, anular y exportar.
- Cada rol puede tener, además, cualquiera de los permisos especiales: ver costos y márgenes, anular ventas, ajustar stock, reimprimir tickets, cerrar caja, cambiar precios.
- El sistema permite asignarle un rol a cada usuario (un usuario tiene un solo rol a la vez).
- El rol Dueño existe siempre, no se puede borrar ni editar, y siempre tiene todos los permisos.
- Cada acción sensible (ver costos, anular venta, ajustar stock, reimprimir ticket, cerrar caja, cambiar precio) se valida contra el permiso real del usuario del lado del servidor, sin confiar en lo que muestre la interfaz (constitución, regla 14).
- La interfaz oculta — no solo deshabilita — las opciones que el rol del usuario no tiene permitidas.

## 5. Reglas de negocio

- El rol Dueño es fijo: no se puede eliminar, renombrar ni quitarle ningún permiso. Siempre tiene acceso total a todo.
- El dueño, y cualquier empleado al que se le asigne el permiso especial correspondiente, puede anular ventas y ajustar stock (`docs/PROJECT.md`, sección 5).
- Un usuario sin el permiso "ver costos y márgenes" no ve esos datos en ninguna pantalla ni en ninguna exportación (constitución, regla 17).
- Un usuario no puede modificar sus propios permisos ni su propio rol (evita que alguien se autoasigne más acceso).
- Siempre tiene que quedar al menos un usuario con el rol Dueño activo — el sistema no permite desactivar al último.
- Cada acción sensible queda registrada en la auditoría; el detalle de ese registro lo define la spec 003, no esta.

## 6. Permisos

Acciones de administración de usuarios y roles — estas no están en la matriz por módulo, son del módulo "Usuarios y roles" en sí:

| Acción | Quién puede |
|---|---|
| Crear, editar y desactivar usuarios | Dueño |
| Crear, editar y borrar roles (salvo el rol Dueño) | Dueño |
| Asignar permisos a un rol | Dueño |
| Asignar un rol a un usuario | Dueño |

Permisos especiales (se activan por rol, no dependen de la matriz por módulo):

| Permiso especial | Quién lo tiene por defecto |
|---|---|
| Ver costos y márgenes | Dueño, y quien tenga el permiso asignado |
| Anular ventas | Dueño, y quien tenga el permiso asignado |
| Ajustar stock | Dueño, y quien tenga el permiso asignado |
| Reimprimir tickets | Dueño, y quien tenga el permiso asignado |
| Cerrar caja | Dueño, y quien tenga el permiso asignado |
| Cambiar precios | Dueño, y quien tenga el permiso asignado |

Matriz por módulo (estructura; las filas se van confirmando a medida que cada módulo tenga su propia spec — esto no es la lista final):

| Módulo | Ver | Crear | Editar | Anular | Exportar |
|---|---|---|---|---|---|
| Catálogo de productos | | | | | |
| Inventario | | | | | |
| Ingreso de mercadería | | | | | |
| Caja | | | | | |
| Ventas | | | | | |
| Pedidos | | | | | |
| Empleados | | | | | |
| Analíticas | | | | | |
| Configuración | | | | | |

## 7. Casos borde y errores

- Un usuario sin permiso para una acción intenta hacerla igual (por ejemplo, entrando a una URL directamente): el servidor la rechaza con un mensaje claro, no alcanza con que la interfaz la haya ocultado.
- Se intenta borrar, renombrar o quitarle permisos al rol Dueño: el sistema lo bloquea con un mensaje claro.
- Se intenta guardar un usuario sin ningún rol asignado: no se permite, todo usuario activo tiene un rol.
- Se intenta desactivar al único usuario con rol Dueño: el sistema lo bloquea.
- Se desactiva un usuario que tiene una caja abierta a su nombre: no afecta la caja ya abierta (eso se resuelve en la spec 007); solo se bloquea su próximo inicio de sesión.
- Se borra un rol que todavía tiene usuarios asignados: no se permite borrarlo mientras tenga usuarios (hay que reasignarlos primero).

## 8. Criterios de aceptación

- [ ] El dueño puede crear un usuario nuevo con email, y ese usuario puede iniciar sesión con la contraseña que se le asignó.
- [ ] El dueño puede editar y desactivar un usuario, y ese usuario ya no puede iniciar sesión.
- [ ] El dueño puede crear un rol, marcar su matriz de permisos por módulo y sus permisos especiales, y guardarlo.
- [ ] El dueño puede asignarle un rol a un usuario y el usuario ve reflejado el cambio en su próximo ingreso.
- [ ] Un usuario con un rol sin el permiso "ver costos y márgenes" no ve esos datos en ninguna pantalla donde aparezcan.
- [ ] Un usuario sin alguno de los permisos especiales (anular ventas, ajustar stock, reimprimir tickets, cerrar caja, cambiar precios) no puede hacer esa acción probando directamente contra el servidor, no solo contra la interfaz.
- [ ] El rol Dueño no se puede borrar, renombrar ni editar sus permisos desde la interfaz.
- [ ] No se puede desactivar al único usuario con rol Dueño.
- [ ] Probado con un usuario de rol distinto a Dueño: ve y hace solo lo que sus permisos permiten (criterio global de `docs/PROJECT.md`, sección 9).

## 9. Entidades previstas

A confirmar en el plan: `Role` (con un flag que marque al rol Dueño como fijo), `Permission`/matriz de permisos por rol y módulo, permisos especiales por rol, y `User` con su rol asignado (hoy `User` solo tiene `authUserId`; acá se le agrega nombre y rol).

## 10. Decisiones (ya confirmadas con el cliente)

- **Roles de ejemplo al inicio:** además de Dueño, se cargan *Encargado* (todo lo operativo, sin gestión de usuarios/roles ni ver costos) y *Cajero* (ventas, caja y pedidos, sin costos, sin anular ni ajustar stock).
- **Sin excepciones de permisos por usuario individual.** Solo por rol — si un empleado necesita algo puntual distinto, se le crea un rol nuevo.
- **Puede haber más de un usuario con rol Dueño**, sin límite, mientras siempre quede al menos uno activo.
- **Datos del usuario:** nombre y email alcanzan para esta etapa. Sin foto de perfil (no está pedida en ningún lado del alcance; se agrega en otra spec si hace falta más adelante).
