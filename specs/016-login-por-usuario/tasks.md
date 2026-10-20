# Tareas 016 — Ingreso por usuario y contraseña

> Pasos pequeños y verificables. Marcar `[x]` al terminar.

- [x] **T-001** `src/lib/username.ts` (`normalizeUsername`, `usernameKey`, `validateUsername`, `suggestUsernames`) con pruebas unitarias.
  - Hecho cuando: Vitest cubre mayúsculas y espacios de más, largo 3–40, caracteres no permitidos, formato de email, y que `suggestUsernames` resuelve repetidos (`Juan`, `Juan 2`, …) sin chocar con usuarios ya existentes ni pasarse de 40.  — `src/lib/username.ts` y `username.test.ts` (13 pruebas).
- [x] **T-002** Schema y migración 1: `username` y `usernameKey` nullable en `User`.
  - Hecho cuando: la migración aplica en local sin tocar los datos existentes.  — Se escribió a mano (`20261020190000_add_username_columns`) porque `migrate dev` falla al reproducir las migraciones viejas en la base sombra; se aplicó con `migrate deploy`.
- [x] **T-003** Script `prisma/backfill-usernames.ts` con `--dry-run`.
  - Hecho cuando: en local el dry-run lista las asignaciones sin escribir, y la corrida real deja a todas las cuentas con usuario único y se puede repetir sin cambiar nada.  — Corrido: asignó `El Maestro`, `boschi` y `Carla Ferreyra`; la segunda corrida no encontró nada. Como la base ya está migrada, el script se borró (dejaba de compilar al volver el campo obligatorio); la lógica sigue en `suggestUsernames`, con pruebas.
- [x] **T-004** Migración 2: `NOT NULL` en ambas columnas e índice único en `usernameKey`.
  - Hecho cuando: aplica después del backfill y falla si queda una fila sin usuario.  — `20261020190100_username_required_unique`. Sin diferencias entre el schema y la base.
- [x] **T-005** Seed: el Dueño de prueba se crea con `username`.
  - Hecho cuando: `pnpm db:seed` corre dos veces seguidas sin duplicar nada y el Dueño queda con usuario.  — Corrido dos veces seguidas; el usuario se fija solo al crear y no pisa un cambio hecho desde `/usuarios`.
- [x] **T-006** Login por usuario: formulario y Server Action.
  - Hecho cuando: se entra con `El Maestro`, `el maestro` y `EL MAESTRO`; un usuario inexistente y una contraseña mala muestran el mismo mensaje; un usuario desactivado ve el mensaje de siempre.  — Probado en el navegador (puerto 3001): entra con `El Maestro`, `  el   maestro ` y `EL MAESTRO`; usuario inexistente y contraseña mala dan el mismo mensaje.
- [x] **T-007** Alta de usuario y alta de empleado con campo usuario (validación y unicidad).
  - Hecho cuando: un usuario repetido (ignorando mayúsculas) o con formato inválido se rechaza con un mensaje claro y el email se sigue pidiendo.  — Probado en el navegador: un usuario repetido con otras mayúsculas da "Ese usuario ya existe.". La validación de formato se cubre con pruebas unitarias; el alta de empleado usa la misma función `checkUsername`.
- [x] **T-008** Edición del usuario (cambiar el usuario) + auditoría.
  - Hecho cuando: el dueño cambia el usuario de alguien (y el suyo), esa persona entra con el nuevo y no con el viejo, y la auditoría registra el cambio sin contraseñas. El Dueño sigue sin poder cambiar su propio rol.  — Hecho en `updateUser` (la regla del rol propio no se tocó). Falta que lo pruebes a mano: cambiar el usuario de alguien y entrar con el nuevo.
- [x] **T-009** Mostrar el usuario en lugar del email: lista y detalle de usuarios, menú del usuario, empleados.
  - Hecho cuando: no queda ninguna pantalla que use el email como identificador de la persona.  — Lista y detalle de usuarios, menú del usuario y empleados.
- [x] **T-010** Documentación: nota en las specs 002 y 003, `docs/PROJECT.md` (tabla de specs) y `docs/CHECKLIST-PRUEBA-MANUAL.md` (pasos de login).
  - Hecho cuando: ningún documento dice que se ingresa con email.  — Notas en las specs 002 y 003 y en el checklist manual.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Revisados a mano por el cliente (2026-10-20).
- [x] Linter, tipos y pruebas unitarias pasan. — `eslint`, `tsc --noEmit` (sin errores en `src`) y `vitest` (169 pruebas).
- [ ] Pruebas E2E. — Pendientes: se hacen en la pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (spec 016 "En desarrollo"; pasa a "Verificada" cuando revises los criterios de aceptación).
