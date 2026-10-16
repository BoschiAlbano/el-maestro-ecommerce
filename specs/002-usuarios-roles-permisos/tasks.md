# Tareas 002 — Usuarios, roles y permisos

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `Role`, `RolePermission` (enum `ModuloNegocio`) y extender `User` (`name`, `email`, `roleId`, `active`).
  - Hecho cuando: `npx prisma validate` y `npx prisma migrate dev` corren sin errores contra la base real, sin romper el usuario existente (ver T-002, van juntas). — Migración en dos pasos (columnas opcionales → backfill por seed → `NOT NULL`), no con `migrate dev` (bloqueado en este entorno no interactivo) sino generando el SQL a mano con `prisma migrate diff --script` y aplicando con `prisma migrate deploy`. Sin drift contra la base real (confirmado con un diff vacío al final).
- [x] **T-002** Actualizar `prisma/seed.ts`: crear (o reutilizar) el rol Dueño con todos los permisos especiales y asignárselo al usuario sembrado.
  - Hecho cuando: `pnpm db:seed` corre dos veces seguidas sin duplicar nada (idempotente) y el usuario de prueba queda con `role.isOwnerRole === true`. — También crea los roles de ejemplo Encargado y Cajero con su matriz. Corrido tres veces seguidas sin duplicar nada.
- [x] **T-003** `src/lib/supabase/admin.ts` (cliente `service_role`) y `src/lib/permissions.ts` (`requireOwner`, `requirePermission`, `requireSpecialPermission`) con pruebas unitarias.
  - Hecho cuando: los tests de Vitest cubren Dueño (siempre pasa), rol sin el permiso (falla) y auto-asignación de rol (falla). — 12 casos nuevos (`permissions.test.ts`): Dueño siempre pasa incluso con matriz vacía, usuario inactivo nunca pasa aunque el rol diga que sí, rol con/sin el permiso puntual. La auto-asignación de rol se prueba en T-005 (es una regla de la Server Action `assignRole`, no de estos helpers genéricos).
- [x] **T-004** Server Actions y pantallas de usuarios (`/usuarios`, `/usuarios/nuevo`, `/usuarios/[id]`).
  - Hecho cuando: el Dueño puede crear un usuario (con contraseña inicial), verlo en la lista, editarlo y desactivarlo; un usuario desactivado no puede iniciar sesión. — `createUser` no deja un usuario de Supabase Auth huérfano si falla el guardado en Prisma (rollback manual). Bloqueado desactivarse a sí mismo y desactivar/cambiarle el rol al único Dueño activo. **Nota de implementación:** el preset de shadcn de este proyecto usa Base UI, no Radix — `Button` no tiene `asChild`; los links con pinta de botón van con `<Link className={buttonVariants()}>` en vez de `<Button asChild><Link/></Button>`.
  - Probado en local contra el Supabase real (no mockeado). La verificación contra el deploy de Vercel queda a cargo del cliente, que a partir de ahora controla él mismo cuándo se commitea/pushea/despliega (ver T-008).
- [x] **T-005** Server Actions y pantallas de roles (`/roles`, `/roles/nuevo`, `/roles/[id]`) con el componente `PermissionMatrix`.
  - Hecho cuando: el Dueño puede crear un rol marcando la matriz y los permisos especiales, editarlo y borrarlo (si no tiene usuarios); el rol Dueño se ve pero no se puede editar ni borrar. — Encontrado y arreglado un bug real de Turbopack con componentes cliente importando del cliente de Prisma (ver riesgo en `plan.md`). `assignRole` se fusionó con `updateUser` (ver riesgo).
- [x] **T-006** Agregar "Usuarios" a la navegación (`nav-items.ts`), visible solo para quien tiene `role.isOwnerRole`.
  - Hecho cuando: un usuario que no es Dueño no ve la entrada "Usuarios" en `SideNav`/`BottomNav`. — Se hizo junto con T-001/T-002 porque el layout necesitaba el mismo dato (`appUser.role`) para las dos cosas; de paso `UserMenu` pasó a ser presentacional (recibe nombre/email por props en vez de volver a consultar la sesión).
- [x] **T-007** Pruebas E2E del flujo completo.
  - Hecho cuando: Playwright cubre: el Dueño crea un rol limitado y un usuario con ese rol; ese usuario loguea y no ve "Usuarios"; una Server Action de administración llamada sin ser Dueño devuelve error (probado aunque la interfaz no muestre el botón). — El "intento directo" se probó navegando por URL a `/usuarios` y `/roles` (la página los bloquea, no la navegación); el rechazo de la Server Action en sí ya está cubierto a nivel función por los 12 tests unitarios de `permissions.test.ts`. Encontrado un falso negativo real: corriendo en paralelo, dos logins casi simultáneos con el mismo usuario invalidaban la sesión del otro — se pasó a `workers: 1` (ver riesgo en `plan.md`).
- [x] **T-008** Cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
  - Hecho cuando: la variable está cargada en el proyecto de Vercel. — Hecho por el cliente. La verificación de `createUser` contra el deploy quedó pendiente porque el código de la spec 002 todavía no estaba commiteado (el repo seguía en el commit de cierre de la spec 001); a partir de acá el cliente controla él mismo los commits/pushes/deploys para agilizar el desarrollo — el agente trabaja solo en local de ahora en más.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Verificados en local contra el Supabase real (Auth + Postgres), no mockeado: tests unitarios de permisos, E2E de login/logout/rol limitado, y el flujo completo de alta de usuario + rol a mano.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [x] Pruebas E2E. — Hechas en su momento (`pnpm test:e2e`), antes de la decisión de diferir el E2E a una pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (estado de la spec).

**Nota post-cierre (2026-10-15, durante la spec 006):** se encontró y corrigió un bug real en el `<Select>` de rol de `/usuarios/nuevo` y `/usuarios/[id]` — mostraba el id crudo del rol en vez de su nombre porque le faltaba el prop `items` de Base UI. Ver el detalle completo en `specs/006-ingreso-de-mercaderia/plan.md`, sección 7.
