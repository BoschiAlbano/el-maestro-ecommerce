# Tareas 018 — Keep-alive de la base de datos

> Pasos pequeños y verificables. Marcar `[x]` al terminar.

- [x] **T-001** `src/lib/cron-auth.ts` (`isAuthorizedCron`) con pruebas unitarias.
  - Hecho cuando: Vitest cubre secreto correcto, incorrecto, encabezado ausente, secreto sin definir o vacío y esquema distinto de Bearer. — `src/lib/cron-auth.test.ts` (6 pruebas).
- [x] **T-002** Ruta `GET /api/cron/keep-alive`.
  - Hecho cuando: con el secreto responde `200`, sin él `401`, y si la base falla `500` sin detalles; no se cachea.
- [x] **T-003** `vercel.json` con el cron diario y `CRON_SECRET` en `.env.example`.
  - Hecho cuando: el JSON es válido, conserva `regions` y `.env.example` documenta cómo generar el secreto.
- [x] **T-004** Documentar en `docs/PROJECT.md` (hoja de ruta y nota en la sección 10).
  - Hecho cuando: la spec 018 figura en la hoja de ruta.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — El último (ejecución en Vercel) se prueba tras definir `CRON_SECRET` y desplegar.
- [x] Linter, tipos y pruebas unitarias pasan. — `eslint`, `tsc --noEmit` y `vitest` sobre lo nuevo; la ruta se probó en local: 401 sin secreto y con secreto malo, 200 con el correcto.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (spec 018 "En desarrollo"; pasa a "Verificada" cuando el cron corra bien en Vercel).
