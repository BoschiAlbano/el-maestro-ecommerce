# Tareas 011 — Analíticas y exportación

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** `src/lib/analytics.ts` (`toTucumanDateKey`, `computePreviousPeriod`, `computeTicketPromedio`, `computeMarginSummary`, `computeStockValuation`, `groupBy`) con pruebas unitarias.
  - Hecho cuando: los tests cubren el cruce de medianoche UTC/Tucumán, rangos de distinto largo, y los guardas contra división por cero. — 10 tests.
- [x] **T-002** `src/lib/analytics-data.ts`: `loadAnalyticsData(filters, currentUser)`.
  - Hecho cuando: devuelve el resumen, la evolución diaria, las tres agrupaciones (empleado/turno/canal), top/sin-movimiento, diferencias de caja, y margen/valorización `null` sin el permiso especial.
- [x] **T-003** Pantalla `/analiticas`: filtros + todas las secciones.
  - Hecho cuando: se pueden combinar los filtros de la spec, se ve cada sección de la sección 2 del plan, y margen/valorización solo aparece con el permiso especial.
- [x] **T-004** Exportación a Excel (`/analiticas/exportar/excel`).
  - Hecho cuando: descarga un `.xlsx` con las hojas de la sección 6 del plan, respetando el mismo filtro de la pantalla.
- [x] **T-005** Exportación a PDF (`/analiticas/exportar/pdf`), con `@react-pdf/renderer`.
  - Hecho cuando: descarga un resumen de una página con los indicadores principales. — `@react-pdf/renderer` 4.9.0 instalado, compatible con React 19 sin problema.
- [x] **T-006** Navegación: activar "Analíticas", visible según permiso.
  - Hecho cuando: un usuario con permiso "ver" en Analíticas ve la entrada; uno sin permiso, no. — `pnpm build`, `pnpm lint`, `tsc --noEmit` y los 84 tests unitarios pasan sin errores.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: filtros combinados (empleado) propagando correctamente a todas las secciones (resumen, evolución diaria, agrupaciones, top/sin-movimiento, margen, valorización, diferencias de caja), y las dos exportaciones descargadas y verificadas (Excel con sus 9 hojas, PDF de una página) con el mismo filtro aplicado.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 84 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de las specs 008 y 009 siguen cumpliéndose. — Sin cambios en esos módulos; solo lectura de sus datos.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
