# Tareas 010 — Empleados

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: enum `Turno`, modelo `Employee`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado.
- [x] **T-002** `src/app/(app)/empleados/actions.ts`: `createEmployeeWithNewUser`, `createEmployeeForExistingUser`, `updateEmployee`, `deactivateEmployee`.
  - Hecho cuando: se puede crear una ficha con usuario nuevo (solo Dueño) o con uno existente sin ficha, editar sus datos, y dar de baja (desactiva el usuario a la vez, exige motivo nunca repetido). — `deactivateEmployee` exige solo el permiso "anular" de la matriz (sin exigir Dueño, decisión del cliente), pero mantiene el resguardo de no dejar sin ningún Dueño activo.
- [x] **T-003** Pantallas `/empleados` (lista con filtro de estado) y `/empleados/nuevo` (alta).
  - Hecho cuando: la lista muestra activos por defecto con filtro para ver bajas/todos, y se puede crear una ficha de cualquiera de las dos formas (usuario nuevo o existente).
- [x] **T-004** Pantalla `/empleados/[id]`: detalle, edición y baja.
  - Hecho cuando: se ven los datos de la ficha, se pueden editar, y se puede dar de baja (con confirmación) — todo gateado por sus permisos. — Editar sigue permitido para un empleado ya dado de baja (spec.md, casos borde); la baja usa una confirmación inline de dos pasos (no `confirm()` nativo), mismo patrón que anular una venta (spec 008).
- [x] **T-005** Navegación: activar "Empleados", visible según permiso.
  - Hecho cuando: un usuario con permiso "ver" en Empleados ve la entrada; uno sin permiso, no. — `pnpm build`, `pnpm lint`, `tsc --noEmit` y los 65 tests unitarios pasan sin errores.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: alta con usuario nuevo, alta con usuario existente (la lista de usuarios disponibles se actualiza y excluye a quien ya tiene ficha), edición de datos, rechazo de DNI duplicado, baja (con confirmación de dos pasos, desactiva el usuario y queda reflejado en `/usuarios`), edición todavía permitida tras la baja, y el filtro de estado (activos por defecto, dados de baja, todos).
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de la spec 002 siguen cumpliéndose. — Probado en el mismo recorrido: alta/edición de usuarios y la lista de `/usuarios` sin regresiones.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
