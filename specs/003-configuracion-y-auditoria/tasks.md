# Tareas 003 — Configuración y auditoría

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `Setting` (fila única), `AuditLog` (enum `AuditAction`), relación inversa en `User`.
  - Hecho cuando: migración aplicada contra la base real sin drift (mismo flujo manual de `plan.md` de la spec 002: `migrate diff --script` + `migrate deploy`). — Sin drift confirmado al final.
- [x] **T-002** `src/lib/audit.ts` (`logAudit`, recibe el cliente de transacción).
  - Hecho cuando: compila y lo puede llamar cualquier Server Action dentro de su propio `$transaction`.
- [x] **T-003** Retocar las Server Actions de usuarios y roles (spec 002) para auditar dentro de la misma transacción.
  - Hecho cuando: `createUser`, `updateUser`, `setUserActive`, `createRole`, `updateRole` y `deleteRole` generan su entrada de `AuditLog` correspondiente, y los criterios de aceptación de la **spec 002** siguen cumpliéndose (correr de nuevo sus tests). — `updateRole` pasó de `$transaction([...])` (array) a `$transaction(async (tx) => ...)` (callback) porque el array no permite llamar a `logAudit` en el medio. Los 17 tests unitarios y los 4 E2E de las specs 001/002 siguen pasando.
- [x] **T-004** Pantalla y Server Action de parámetros (`/configuracion`).
  - Hecho cuando: se puede editar razón social, texto del ticket y stock mínimo por defecto, gateado por el permiso "editar" en Configuración (no hardcodeado a Dueño). — `Setting` se auto-crea con `upsert` en el primer acceso (sin necesitar seed). Si el permiso es solo "ver", se muestra de solo lectura.
- [x] **T-005** Pantalla de auditoría (`/configuracion/auditoria`) con filtros por fecha, usuario y acción.
  - Hecho cuando: los filtros devuelven resultados correctos y no hay ninguna acción de editar/borrar en la pantalla. — Filtros por formulario `GET` sin JavaScript (searchParams), consistente con el resto de la app. Sin botón de editar ni borrar en ningún lado de la pantalla.
- [x] **T-006** Agregar "Configuración" a la navegación, visible según permiso (no `ownerOnly` como "Usuarios").
  - Hecho cuando: un usuario con permiso "ver" en Configuración (aunque no sea Dueño) ve la entrada; uno sin permiso, no. — Encontrado y arreglado un bug real de React/RSC: no se pueden pasar los íconos (son funciones) como prop desde un Server Component a uno Client; el filtrado pasó a hacerse en el cliente (ver riesgo en `plan.md`). De paso, se separó `getCurrentUser` de `permissions.ts` (ahora en `src/lib/current-user.ts`) para que la navegación pueda importar las funciones puras sin arrastrar Prisma, y se agregó el paquete `server-only` como resguardo en todos los módulos que tocan sesión/base.
- [x] **T-007** Pruebas E2E.
  - Hecho cuando: Playwright cubre crear un usuario → verlo en la auditoría, filtrar por acción/usuario, y confirmar que no hay edición/borrado posible desde la interfaz. — Se agregó además un test para el caso nuevo de permisos (no solo Dueño): un rol con "ver" en Configuración ve esa sección y no "Usuarios"; sin "editar", la ve de solo lectura. 6 tests E2E en total, todos en verde.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [x] Pruebas E2E. — Hechas en su momento (`pnpm test:e2e`), antes de la decisión de diferir el E2E a una pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] Los criterios de aceptación de la **spec 002** siguen cumpliéndose después de los cambios de T-003. — Los 2 tests E2E originales de la spec 002 (`login.spec.ts`, `usuarios-roles.spec.ts`) siguen pasando.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).

**Nota post-cierre (2026-10-15, durante la spec 006):** se encontró y corrigió un bug real en los `<Select>` de usuario/acción de `/configuracion/auditoria` — mostraban el id/nombre técnico crudo en vez de la etiqueta porque les faltaba el prop `items` de Base UI. Ver el detalle completo en `specs/006-ingreso-de-mercaderia/plan.md`, sección 7.
