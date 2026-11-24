# Tareas 014 — Caja del día

> Pasos pequeños y verificables. Marcar `[x]` al terminar.

- [x] **T-001** `src/lib/cash-day.ts` (`parseDayKey`, `summarizeDay`, `summarizeSales`, `collectedBySales`) con pruebas unitarias.
  - Hecho cuando: Vitest cubre fecha inválida/futura, neto por medio, ventas activas vs anuladas y cobrado por ventas con anulación.
- [x] **T-002** Pantalla `/caja/dia`: ~~estado actual~~ *(quitado 2026-10-20)*, paneles de Efectivo / Transferencias / Ventas, desglose por turno y movimientos paginados.
  - Hecho cuando: con dos turnos en el mismo día los totales los suman y coinciden con cada turno.
- [x] **T-003** Selector de fecha (anterior / siguiente / hoy / input) y fecha inválida o futura → hoy.
  - Hecho cuando: se puede navegar a un día anterior y una fecha futura por URL vuelve a hoy.
- [x] **T-004** Accesos: botón "Caja del día" en `/caja` y link en la fila "Hoy" del inicio.
  - Hecho cuando: se llega a la pantalla desde ambos lugares.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Revisión manual del cliente el 2026-11-24, con dos turnos de dos usuarios (uno cerrado con diferencia y otro abierto), ventas en efectivo y transferencia, una venta anulada, una seña y un egreso; los totales se recalcularon desde la base turno por turno y coinciden con la pantalla.
- [x] Linter, tipos y pruebas unitarias pasan. — `eslint`, `tsc --noEmit` y `vitest` (156 pruebas, 23 son de `cash-day`). No se corrió `pnpm build` porque el servidor de desarrollo del cliente está levantado en el mismo directorio. *(2026-11-24: `pnpm build` pasa, con 764 pruebas.)*
- [ ] Pruebas E2E. — Pendientes: se hacen en la pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-24)».
