# Plan 010 — Empleados

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`Turno`** (enum): `MANANA`, `TARDE`.
- **`Employee`**: `id`, `userId` (`String`, único, FK `User` — 1 a 1, blindado a nivel de base, no solo en código), `dni` (`String`, único), `phone` (`String?`), `hireDate` (`DateTime`), `shift` (`Turno`), `terminatedAt` (`DateTime?` — presente = dado de baja), `createdAt`.

El DNI es `String` (no `Int`) para no perder ceros a la izquierda ni chocar con límites de tamaño.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/empleados` | Lista (activos por defecto, filtro de estado) | Permiso "ver" en Empleados |
| `/empleados/nuevo` | Alta: usuario nuevo o existente + ficha | Permiso "crear" en Empleados (usuario nuevo exige además ser Dueño, ver sección 4) |
| `/empleados/[id]` | Detalle, edición y baja | Ver: "ver". Editar: "editar". Dar de baja: "anular". |

## 3. Lógica de servidor

`src/app/(app)/empleados/actions.ts`:

- `createEmployeeWithNewUser(name, email, password, roleId, dni, phone, hireDate, shift)` — exige "crear" en Empleados **y** ser Dueño (`requireOwner`): crea el `User` igual que `createUser` (spec 002, `src/app/(app)/usuarios/actions.ts`) y el `Employee` en la misma transacción. Si falla el guardado en Prisma, borra el usuario de Supabase Auth recién creado (mismo resguardo que spec 002, para no dejar un usuario huérfano).
- `createEmployeeForExistingUser(userId, dni, phone, hireDate, shift)` — exige solo "crear" en Empleados: valida que el usuario no tenga ya una ficha (`Employee.userId` único) y que el DNI no esté en uso.
- `updateEmployee(id, dni, phone, hireDate, shift)` — exige "editar" en Empleados; valida el DNI único excluyendo la propia ficha.
- `deactivateEmployee(id)` — exige solo "anular" en Empleados (sin exigir Dueño: excepción puntual a spec 002, decidida con el cliente — ver spec.md, sección 5). En una transacción, marca `terminatedAt = now()` y desactiva el usuario asociado directo (`tx.user.update({ data: { active: false } })` — no se reutiliza `setUserActive` de spec 002 porque esa función exige `requireOwner` internamente, justo lo que acá no corresponde), y registra auditoría (`logAudit`, acción `USER_DEACTIVATED`, spec 003 — mismo tipo de evento que una baja hecha desde `/usuarios`). Rechaza si ya estaba dado de baja. Mantiene el resguardo de `setUserActive` (spec 002) de no poder quedarse sin ningún Dueño activo: si el usuario de la ficha tiene el rol Dueño y es el único activo, se rechaza — esto protege la integridad del sistema, no es parte de la excepción de permisos.

Ninguna de estas acciones usa `registerStockMovement` ni `registerCashMovement` — Empleados no toca stock ni caja.

## 4. Permisos

El módulo `EMPLEADOS` ya existe en la matriz (spec 002) sin nada que lo usara todavía. Se gobierna igual que Pedidos o Ventas (ver/crear/editar/anular por rol), **con una excepción**: crear la ficha de un empleado junto con un usuario nuevo reutiliza `createUser` de spec 002, que es exclusivo del Dueño (`requireOwner`) — esa restricción no se relaja acá. Vincular un usuario que ya existe no toca esa ruta y solo exige el permiso de la matriz.

## 5. Componentes

- `EmployeeForm` (alta): elegir "Usuario nuevo" o "Usuario existente" (toggle). Con "nuevo", pide los campos de alta de spec 002 (nombre, email, rol, contraseña) — solo visible si quien lo usa es Dueño. Con "existente", un `Select` de usuarios que todavía no tienen ficha. En ambos casos, los campos propios: DNI, teléfono, fecha de ingreso, turno.
- Lista con filtro de estado (activos / dados de baja / todos) — mismo patrón ya armado para `/pedidos` (spec 009): `Select` con `items`, `searchParams`, activos por defecto.
- `DeactivateEmployeeButton`: confirma y llama `deactivateEmployee`.

## 6. Pruebas

- **Unitarias:** esta spec es mayormente CRUD con validaciones de unicidad contra la base (DNI, usuario sin ficha) — no hay cálculos puros que testear como en specs 005-009. Las validaciones se prueban con revisión manual en el navegador (mismo criterio que specs 002 y 003).
- **E2E:** diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas").

## 7. Riesgos y decisiones

- **Se reutiliza la creación de usuario de spec 002 tal cual**, en lugar de duplicar la lógica de Supabase Auth — evita manejar dos caminos distintos para lo mismo y respeta que la creación de usuarios siga siendo exclusiva del Dueño.
- **`Employee.userId` único a nivel de base**, no solo validado en el código, para blindar contra dos altas simultáneas para el mismo usuario.
- **El turno queda como enum fijo (`MANANA`/`TARDE`)**, no texto libre — así se decidió en el alcance de la spec; si en el futuro hace falta algo más flexible (horarios partidos, turnos rotativos), se amplía en una spec aparte.
- **No hay reactivación**: si un ex empleado vuelve, se da de alta como caso nuevo por ahora (spec.md, sección 5) — no se agrega un botón de "reactivar" en esta spec.
