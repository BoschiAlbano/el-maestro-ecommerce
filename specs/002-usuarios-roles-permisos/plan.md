# Plan 002 — Usuarios, roles y permisos

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

Se agrega al `schema.prisma` existente (que hoy solo tiene `User.authUserId`):

- **`Role`**
  - `id`, `name` (único), `isOwnerRole` (boolean, `true` solo en la fila "Dueño" — así el código nunca compara por nombre de string para saber si es el rol fijo).
  - Permisos especiales como columnas booleanas propias del rol (no una tabla aparte, son un puñado fijo): `verCostosMargenes`, `anularVentas`, `ajustarStock`, `reimprimirTickets`, `cerrarCaja`, `cambiarPrecios`.
  - Relación 1-a-muchos con `User` y con `RolePermission`.
- **`RolePermission`** (la matriz módulo × acción; una fila por combinación rol+módulo)
  - `roleId`, `module` (enum `ModuloNegocio`: `CATALOGO`, `INVENTARIO`, `INGRESO_MERCADERIA`, `CAJA`, `VENTAS`, `PEDIDOS`, `EMPLEADOS`, `ANALITICAS`, `CONFIGURACION`), y cinco booleanos: `ver`, `crear`, `editar`, `anular`, `exportar`.
  - `@@unique([roleId, module])`.
  - Un enum fijo (no `module: String` libre) para tipado estricto (constitución, regla 18) — agregar un módulo nuevo es una migración chica, y hay ~9 módulos conocidos y estables.
- **`User`** (se extiende, no se recrea):
  - Se agrega `name` (string), `email` (string — copia de conveniencia del email de Supabase Auth, para no pegarle a la API admin solo para listar usuarios; se sincroniza al crear/editar), `roleId` (FK a `Role`, obligatorio), `active` (boolean, default `true`, reemplaza el borrado — conserva ventas/movimientos históricos con su nombre).

**Migración de datos (no solo de schema):** hoy existe un usuario real (el de la semilla de la spec 001, `dueno@importadora.local`) sin rol. La migración tiene que:
1. Crear la fila del rol Dueño (`isOwnerRole: true`, todos los permisos especiales en `true`) como parte del seed, no de la migración SQL en sí (la migración solo puede agregar `roleId` como nullable temporalmente o requiere un valor por defecto resuelto a mano).
2. Asignarle ese rol al usuario existente.
3. Recién ahí hacer `roleId` `NOT NULL`.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/usuarios` | Lista de usuarios (nombre, email, rol, activo/inactivo) | Dueño |
| `/usuarios/nuevo` | Alta de usuario (nombre, email, password inicial, rol) | Dueño |
| `/usuarios/[id]` | Editar usuario (nombre, rol) y desactivar/reactivar | Dueño |
| `/roles` | Lista de roles | Dueño |
| `/roles/nuevo` | Crear rol: nombre + matriz de permisos + permisos especiales | Dueño |
| `/roles/[id]` | Editar rol (el rol Dueño se ve, no se edita) | Dueño |

Todas bajo `(app)/`, agregadas al `AppShell` existente (hoy esos ítems de nav no existen todavía — se agrega "Usuarios" como entrada nueva; no estaba en `nav-items.ts` de la spec 001 porque ese módulo no existía).

## 3. Lógica de servidor

- `src/lib/supabase/admin.ts`: cliente de Supabase con `service_role` (nuevo — hasta ahora esa clave solo la usaba `prisma/seed.ts`). Se usa **solo** en Server Actions de este módulo, nunca en código que corra en el navegador.
- `src/lib/permissions.ts`: helpers de verificación, usados al principio de cada Server Action/Route Handler de **cualquier** módulo futuro, no solo este:
  - `requireOwner()`: tira error si el usuario actual no tiene `role.isOwnerRole`. Lo usan todas las acciones de este módulo (crear/editar usuarios y roles).
  - `requirePermission(module, action)`: chequea la matriz (`RolePermission`) del rol del usuario actual.
  - `requireSpecialPermission(name)`: chequea una de las seis columnas booleanas del rol.
  - Las tres leen la sesión con `createClient()` (servidor) + `prisma.user.findUnique(..., include: { role: true } )`.
- Server Actions (`src/app/(app)/usuarios/actions.ts`, `src/app/(app)/roles/actions.ts`):
  - `createUser`: `requireOwner()` → crea en Supabase Auth (`admin.createUser`, `email_confirm: true`) → `prisma.user.create` con `roleId`. Si falla el segundo paso, no queda un usuario de Auth huérfano (se borra con `admin.deleteUser` si el `prisma.user.create` falla).
  - `updateUser` / `setUserActive`: `requireOwner()`; bloquea desactivar si es el único Dueño activo (regla de negocio, sección 5 de `spec.md`).
  - `createRole` / `updateRole` / `deleteRole`: `requireOwner()`; bloquea cualquier cambio si `role.isOwnerRole`; `deleteRole` revisa que no tenga usuarios asignados.
  - `assignRole`: `requireOwner()`; bloquea si `userId === currentUser.id` (nadie se cambia el rol a sí mismo, regla de negocio).

## 4. Componentes

- shadcn nuevos: `Table`, `Select`, `Checkbox`, `Label`, `Badge` (para activo/inactivo).
- `PermissionMatrix`: grilla de checkboxes (filas = módulos del enum, columnas = ver/crear/editar/anular/exportar) + checkboxes aparte para los 6 permisos especiales. Un solo componente, reutilizado en alta y edición de rol.
- `UserTable` / `RoleTable`: listas con shadcn `Table`.

## 5. Permisos

Todo este módulo es, en sí mismo, administración restringida a Dueño (`requireOwner()` en cada Server Action — no es un permiso asignable, lo pide la spec explícitamente en la sección 6). Los helpers `requirePermission`/`requireSpecialPermission` que se escriben acá quedan disponibles para que los módulos de negocio (ventas, caja, stock...) los usen cuando se construyan — por eso viven en `src/lib/permissions.ts`, no adentro de la carpeta de este módulo.

## 6. Pruebas

- Unitarias (Vitest): `requireOwner`, `requirePermission`, `requireSpecialPermission` con roles mockeados — casos: Dueño siempre pasa; rol sin el permiso falla; falla si se intenta auto-asignar un rol.
- E2E (Playwright): el Dueño (usuario de la semilla) crea un rol limitado y un usuario con ese rol; ese usuario loguea y no ve "Usuarios" en la navegación; un intento directo de Server Action sin permiso devuelve error.
- La semilla (`prisma/seed.ts`) se actualiza para crear el rol Dueño y asignárselo al usuario sembrado (ver riesgo).

## 7. Riesgos y decisiones

- **`SUPABASE_SERVICE_ROLE_KEY` todavía no existe en Vercel.** Hoy solo está en el `.env` local (la usa `prisma/seed.ts`). Para que `createUser` funcione en producción, hay que cargarla ahí como variable "Secret" antes de desplegar esta spec — se lo pido al cliente cuando esté el código listo para probarlo en producción.
- **Enum de módulos fijo vs. string libre:** se eligió enum (ver sección 1) por tipado estricto; el costo es una migración chica cada vez que se agregue un módulo de negocio nuevo (specs 004 en adelante).
- **Seed de la spec 001 cambia de forma:** al agregar `roleId` obligatorio a `User`, `prisma/seed.ts` pasa a crear primero el rol Dueño (si no existe) y recién después el usuario, en vez de solo el usuario. Se mantiene idempotente (upsert por `name` en `Role`, por `authUserId` en `User`).
- **Permisos especiales como columnas vs. tabla aparte:** son un conjunto fijo y chico (6), así que van como columnas booleanas en `Role` en vez de una tabla `RolePermission`-like — más simple de leer y no necesitan la flexibilidad de la matriz por módulo.
- **`prisma migrate dev` no funciona en este entorno** (de nuevo, como en la spec 001 con el middleware): tira "environment is non-interactive" apenas hay un warning que confirmar, sin flag para saltearlo en Prisma 7. La forma de migrar quedó así, a mano, para cualquier cambio de schema de acá en adelante:
  1. Editar `schema.prisma`.
  2. `prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --script` para generar el SQL (de solo lectura, no toca la base).
  3. Guardarlo en `prisma/migrations/<timestamp>_<nombre>/migration.sql` a mano.
  4. `prisma migrate deploy` (sí es no interactivo) para aplicarlo.
  5. Si algo rompe a mitad de camino: `prisma migrate resolve --rolled-back <nombre>`, arreglar los datos o el SQL, y repetir el paso 4 — ojo que un `DROP CONSTRAINT`/`ALTER COLUMN` que ya corrió **no se deshace solo** aunque el comando haya fallado (no asumir que fue atómico; volver a generar el diff contra el estado real antes de reintentar, no reusar el SQL viejo a ciegas — así se encontró este caso).
  - Cambios con pérdida de datos en columnas que ya tienen filas (agregar una columna `NOT NULL` sin default) necesitan el paso intermedio de columna opcional → backfill → `NOT NULL`, como en T-001.
- **Nunca importar valores (no tipos) de `@/generated/prisma/client` desde un componente cliente.** `ModuloNegocio` se usa en `permission-matrix.tsx` y `edit-role-form.tsx` (ambos `"use client"`) para armar la grilla. Importarlo desde `client.ts` (el módulo completo de Prisma Client) hace que Turbopack intente empaquetar el runtime de Prisma para el navegador y explota (`the chunking context does not support external modules (request: node:module)`). Se usa `@/generated/prisma/enums` en su lugar — ese archivo es solo el objeto del enum, sin nada del runtime. Los `import type` (como `Accion`, `PermisoEspecial`) no tienen este problema porque se borran en compilación.
- **E2E en serie, no en paralelo.** Varios tests loguean al mismo usuario sembrado (Dueño) contra el Supabase Auth real. En paralelo, dos logins casi simultáneos del mismo usuario invalidan la sesión del otro (rotación de refresh token de Supabase) y un test falla de forma intermitente, no por un bug real de la app. `playwright.config.ts` quedó con `workers: 1`.
- **`assignRole` no quedó como Server Action separada.** Asignar rol a un usuario se resolvió dentro de `updateUser` (nombre + rol en el mismo formulario) — tiene más sentido en la pantalla de edición de usuario que como una acción aparte, y cubre el mismo caso de uso que pedía `spec.md`.
