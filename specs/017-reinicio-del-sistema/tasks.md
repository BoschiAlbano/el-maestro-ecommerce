# Tareas 017 — Reinicio del sistema

> Pasos pequeños y verificables. Marcar `[x]` al terminar.
>
> **Importante:** el reinicio real **no se ejecuta durante el desarrollo**. La base es la misma que usa el sitio publicado. Se valida con una corrida que se revierte (T-005).

- [x] **T-001** `src/lib/system-reset.ts` (`RESET_PHRASE`, `validateResetConfirmation`, `summarizeReset`) con pruebas unitarias.
  - Hecho cuando: Vitest cubre frase exacta (mayúsculas y espacios de los extremos), contraseña vacía, singular/plural en el resumen y las advertencias de turno abierto y pedidos pendientes. — `src/lib/system-reset.ts` y `system-reset.test.ts` (8 pruebas).
- [x] **T-002** Migración: valor `SYSTEM_RESET` en el enum `AuditAction`, y etiqueta en la pantalla de Auditoría.
  - Hecho cuando: la migración aplica y el schema no difiere de la base; en Auditoría una entrada `SYSTEM_RESET` se ve como "Sistema reiniciado". — Migración `20261020200000_add_system_reset_audit_action`, sin diferencias entre el schema y la base. La etiqueta se agregó en `auditoria/page.tsx`.
- [x] **T-003** `src/lib/system-reset-data.ts`: `loadResetSummary()` y `wipeBusinessData(tx, owner)`.
  - Hecho cuando: el resumen devuelve las cantidades reales de la base y `wipeBusinessData` cubre todas las tablas de negocio, deja al Dueño, su rol y la configuración, y reinicia el contador de tickets. — `src/lib/system-reset-data.ts` (`loadResetCounts` y `wipeBusinessData`, con `TRUNCATE ... RESTART IDENTITY CASCADE`).
- [x] **T-004** Acción `resetSystem` en `configuracion/sistema-actions.ts`: solo Dueño, valida frase y contraseña, borra en una transacción, deja la entrada de auditoría, y después borra cuentas de acceso y fotos informando las fallas.
  - Hecho cuando: un usuario que no es Dueño es rechazado, una contraseña o una frase incorrectas no borran nada, y la acción devuelve la lista de lo que quedó sin borrar si algo externo falla. — `configuracion/sistema-actions.ts`. La contraseña se verifica con un cliente de Supabase aparte. Las cuentas de acceso se borran listando Supabase Auth (no la tabla `users`, que ya se vació), para que repetir el reinicio también limpie las que hayan quedado.
- [x] **T-005** Verificación del borrado con **rollback**: una corrida de prueba que ejecuta `wipeBusinessData` y la entrada de auditoría dentro de una transacción y la revierte a propósito.
  - Hecho cuando: dentro de la transacción las tablas de negocio quedan en cero, queda solo el Dueño con su rol, el siguiente ticket sería el 1 y, al revertir, la base conserva todos sus datos. — Corrido contra la base real con rollback: dentro de la transacción quedaron 1 usuario, 1 rol, 9 permisos, la configuración, 1 entrada de auditoría y todo el resto en 0; el contador de tickets quedó listo para el Nº 1; al revertir, la base volvió a tener exactamente los mismos datos.
- [x] **T-006** Pestaña "Sistema" en `/configuracion`: `reset-system-tab.tsx`, `settings-form.tsx` y `page.tsx`, visible solo para el Dueño, y aviso `?reiniciado=1` en `/inicio`.
  - Hecho cuando: el Dueño ve el resumen, el botón rojo solo se habilita con contraseña y la frase exacta, y el resto de los roles no ve la pestaña. — Probado en el navegador: pestañas Ticket / Artículos / Sistema, resumen con las cantidades reales y el aviso de 2 pedidos pendientes; el botón solo se habilita con contraseña y frase exacta; con la contraseña incorrecta devuelve "La contraseña es incorrecta. No se borró nada." y no borra. No se probó con un rol que no sea Dueño (no tengo su contraseña).
- [x] **T-007** Eliminar `scripts/reset-database.ts` (desactualizado) y documentar: notas en las specs 003 y 002, `docs/CHECKLIST-PRUEBA-MANUAL.md` y `docs/PROJECT.md`.
  - Hecho cuando: no queda ninguna referencia al script viejo y el checklist tiene los pasos para probar el reinicio a mano. — Script eliminado; el paso 0.2 del checklist ahora usa la pestaña Sistema.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Los prueba el cliente a mano, ya que el reinicio real borra los datos.
- [x] Linter, tipos y pruebas unitarias pasan. — `eslint`, `tsc --noEmit` (sin errores en `src`) y `vitest`.
- [ ] Pruebas E2E. — Pendientes: se hacen en la pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (spec 017 "En desarrollo"; pasa a "Verificada" cuando pruebes el reinicio real).
