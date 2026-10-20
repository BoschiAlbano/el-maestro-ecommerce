# Spec 016 — Ingreso por usuario y contraseña

| | |
|---|---|
| **Estado** | Verificada (2026-10-20) |
| **Depende de** | 001, 002, 003 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5. Cambia un punto de la spec 002: el email deja de ser el usuario de ingreso. |

## 1. Objetivo

Que el equipo ingrese al sistema con un **nombre de usuario** (por ejemplo, `El Maestro`) y su contraseña, en vez de con un email.

Hoy el login pide email y contraseña (spec 002). Obliga a recordar y tipear un email que no aporta nada al trabajo diario. El email sigue existiendo por dentro (la autenticación de fondo lo necesita), pero deja de ser lo que la persona escribe para entrar.

## 2. Alcance

**Incluye:**

- Un campo **usuario** por cada persona del sistema: único y sin distinguir mayúsculas de minúsculas.
- El login pide **usuario y contraseña**.
- Alta y edición de usuarios (spec 002) con el campo usuario; el dueño lo puede cambiar.
- Asignar un usuario automático a las cuentas que ya existen, para que sigan pudiendo entrar.
- Mostrar el usuario donde hoy se muestra el email como identificador.

**No incluye:**

- Cambiar cómo se guardan las contraseñas ni la autenticación de fondo: sigue siendo Supabase Auth.
- Recuperar contraseña, "olvidé mi contraseña", que cada persona cambie su propia contraseña, ni doble factor. La contraseña la sigue fijando el dueño (spec 002).
- Inicio de sesión con Google, redes sociales ni enlaces mágicos.
- Cambios en roles, permisos ni en la lógica de usuario activo o desactivado.
- Quitar el email del sistema: se mantiene (ver sección 5).

## 3. Historias de usuario

- Como **empleado**, quiero entrar con mi nombre de usuario y mi contraseña, para no tener que acordarme de un email.
- Como **dueño**, quiero elegir el nombre de usuario de cada persona al crearla, para que sea fácil de recordar y de dictar.
- Como **dueño**, quiero poder cambiarle el usuario a alguien (por ejemplo, si se escribió mal), para no tener que recrear la cuenta ni perder su historial.
- Como **empleado que ya existe**, quiero seguir entrando el día que se estrene el cambio, para no quedarme afuera.
- Como **dueño**, quiero que el sistema no revele si un usuario existe cuando alguien se equivoca al ingresar, para que nadie pueda ir probando nombres.

## 4. Requisitos funcionales

- **RF-1.** Cada usuario del sistema tiene un **nombre de usuario**: obligatorio, único y sin distinguir mayúsculas (`El Maestro`, `el maestro` y `EL MAESTRO` son el mismo usuario). Se muestra tal como lo escribió el dueño.
- **RF-2.** El usuario admite letras (con tildes y ñ), números, espacios, punto, guion y guion bajo; entre 3 y 40 caracteres. Se ignoran los espacios al principio y al final, y los espacios repetidos se reducen a uno.
- **RF-3.** La pantalla de login pide **Usuario** y **Contraseña** (ya no pide email). Si todo está bien, lleva a `/inicio`, igual que hoy.
- **RF-4.** Al ingresar, el sistema busca el usuario ignorando mayúsculas y verifica la contraseña. Si el usuario no existe, la contraseña es incorrecta o ambas cosas, el mensaje es **el mismo**: "Usuario o contraseña incorrectos."
- **RF-5.** Un usuario desactivado o sin configurar sigue sin poder entrar y ve los mismos mensajes que hoy (spec 002).
- **RF-6.** Al crear un usuario (`/usuarios/nuevo`) se pide, además de lo que ya se pide, el **nombre de usuario**. Si ya existe otro igual (ignorando mayúsculas), se rechaza con un mensaje claro.
- **RF-7.** Al editar un usuario (`/usuarios/[id]`) el dueño puede **cambiarle el nombre de usuario**, con la misma validación. El cambio no pierde historial: ventas, caja y demás siguen asociados a la persona.
- **RF-8.** La lista de usuarios y el menú del usuario muestran el **nombre de usuario** donde hoy muestran el email como identificador.
- **RF-9.** Las cuentas que ya existen reciben un nombre de usuario automático, tomado de su **nombre** (por ejemplo, la cuenta cuyo nombre es "El Maestro" queda con el usuario `El Maestro`). Si dos coinciden, la segunda recibe un número al final (`Juan 2`). El dueño puede cambiarlos después (RF-7).
- **RF-10.** Asignar o cambiar un usuario queda en la **auditoría** (spec 003), sin guardar ninguna contraseña.

## 5. Reglas de negocio

- **El email se mantiene.** La autenticación de fondo (Supabase Auth) identifica cada cuenta por un email, así que cada usuario sigue teniendo uno. Se sigue pidiendo al crear la cuenta, como hasta ahora; **ya no se usa para ingresar** y la persona no tiene que recordarlo.
- **El usuario es solo para ingresar y reconocerse**: no es un permiso ni reemplaza al nombre real de la persona (el campo "nombre" sigue existiendo).
- **La contraseña no cambia**: cada persona sigue entrando con la que ya tenía. Esta spec no resetea ni toca contraseñas.
- **Único sin distinguir mayúsculas**: la unicidad se garantiza en el servidor y también en la base de datos, no solo en el formulario.
- **Mensaje genérico en el login** (RF-4): no se revela si el usuario existe, para que no se pueda ir probando nombres.
- **Sin cambios en los permisos**: el ingreso por usuario no cambia qué puede ver o hacer cada rol. Las validaciones siguen del lado del servidor (constitución, regla 14).
- **Nunca se guardan ni se muestran contraseñas** en la documentación, el código ni la auditoría.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ingresar con usuario y contraseña | Cualquier persona con cuenta activa |
| Elegir el usuario al crear una cuenta | Dueño |
| Cambiarle el usuario a alguien | Dueño |
| Ver el usuario de las personas en la lista | Dueño (la lista de usuarios ya es solo del Dueño, spec 002) |

Nadie que no sea Dueño puede cambiar un usuario, ni el propio. El Dueño puede cambiar su propio usuario y sus datos, pero no su propio rol (spec 002).

## 7. Casos borde y errores

- **Mayúsculas o espacios de más** (`  el   maestro `): se normaliza antes de buscar y funciona igual que `El Maestro`.
- **Usuario inexistente o contraseña mala**: "Usuario o contraseña incorrectos.", sin distinguir.
- **Dos usuarios que solo difieren en mayúsculas** al crear o editar: se rechaza el segundo ("Ese usuario ya existe.").
- **Caracteres no permitidos** (por ejemplo `@`, `/`, emojis) o largo fuera de rango: se rechaza con un mensaje que explique qué se permite.
- **Usuario con formato de email** (por ejemplo `juan@gmail.com`): se rechaza, para no confundirlo con el login anterior.
- **El Dueño se cambia su propio usuario o sus datos**: se permite; la sesión abierta sigue válida. Su rol sigue sin poder cambiarlo (spec 002).
- **Se cambia el usuario de alguien con la sesión abierta**: la sesión no se cierra; usa el usuario nuevo la próxima vez que ingrese.
- **Cuenta existente sin usuario**: no debe quedar ninguna; la migración asigna uno a todas (RF-9) y el campo queda obligatorio.
- **Muchos intentos fallidos seguidos**: los limita la protección propia de Supabase Auth; esta spec no agrega un bloqueo propio.
- **Gestor de contraseñas del navegador**: el campo usuario usa `autocomplete="username"` para que lo recuerde bien.

## 8. Criterios de aceptación

- [x] El login muestra "Usuario" y "Contraseña", sin campo de email.
- [x] Ingresar con `El Maestro` y la contraseña correcta lleva a `/inicio`; con `el maestro` o `EL MAESTRO` también.
- [x] Un usuario inexistente y una contraseña incorrecta muestran **exactamente el mismo** mensaje.
- [x] Un usuario desactivado no puede entrar y ve el mensaje actual.
- [x] Al crear un usuario se pide el nombre de usuario; uno repetido (ignorando mayúsculas) se rechaza.
- [x] El dueño puede cambiar el usuario de alguien y la persona entra con el nuevo; con el viejo ya no.
- [x] Un usuario que ya existía antes del cambio entra con el usuario que le asignó la migración y su misma contraseña.
- [x] Ninguna cuenta existente queda sin nombre de usuario ni hay dos iguales.
- [x] La lista de usuarios y el menú del usuario muestran el usuario.
- [x] El cambio de usuario figura en la auditoría y no contiene contraseñas.
- [x] Un usuario con formato de email, con símbolos no permitidos o de largo inválido se rechaza con un mensaje claro.
- [x] Hay pruebas unitarias de la normalización, la validación y la generación de usuarios automáticos para las cuentas existentes.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Decisiones

Confirmadas con el cliente (2026-10-20):

1. **El email se sigue pidiendo al crear un usuario**, pero no se usa en el login.
2. **El Dueño puede cambiarse sus propios datos (incluido su usuario) pero no su propio rol.**
3. **Alcanza con la protección contra intentos fallidos de Supabase Auth**; no se agrega un bloqueo propio.
4. **Cambiar el usuario de alguien no le cierra la sesión abierta.**

No quedan preguntas abiertas.
