# Tareas 012 — Inicio del dueño y lista de viaje

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** `src/lib/travel-list.ts` (`computeTravelList`) con pruebas unitarias.
  - Hecho cuando: los tests cubren un producto por encima del mínimo (no entra), por debajo sin comprometido, por debajo con comprometido que lo empuja más abajo, y disponible negativo (sugerida más alta, sin tope). — 5 tests.
- [x] **T-002** `src/lib/home-data.ts`: `loadHomeData(currentUser)`.
  - Hecho cuando: devuelve `null` en cada sección (caja, pedidos, inventario) sin el permiso correspondiente, y los datos reales con el permiso — turno abierto + efectivo esperado, neto de movimientos de hoy (todos los turnos), cantidad de pedidos pendientes, y la lista de viaje (conteo y detalle) vía `computeTravelList`. — `loadTravelList` queda exportada aparte para que `/lista-de-viaje` la reuse.
- [x] **T-003** Pantalla `/` (Inicio): estado de caja + resumen de hoy, pedidos pendientes, alerta de stock.
  - Hecho cuando: cada sección aparece u oculta según su propio permiso (Caja/Pedidos/Inventario), sin romper el saludo genérico de la spec 001 para quien no tenga ninguno.
- [x] **T-004** Pantalla `/lista-de-viaje`: detalle completo + botón "Copiar" (texto).
  - Hecho cuando: se ve la lista completa con la cantidad sugerida, el botón copia el texto armado en el cliente (sin otra consulta), y el caso de lista vacía muestra el mensaje de la spec en vez de quedar en blanco.
  - Nota post-cierre: a pedido del cliente, se agregó un filtro de marca y rubro en `/lista-de-viaje` (`loadTravelList` ahora acepta `{brandId?, rubroId?}`) para poder comprar por categoría — por ejemplo, filtrar a rubro "Tecnología" y llevarse esa parte de la lista. La alerta del inicio sigue sin filtro (RF-6, spec.md).
- [x] **T-005** Exportación a Excel (`/lista-de-viaje/exportar`).
  - Hecho cuando: descarga un `.xlsx` de una sola hoja (producto, disponible, mínimo, sugerida), gateado por el permiso "ver" en Inventario (no "exportar"). — La hoja no repite "mínimo" por separado: "disponible" y "sugerida" ya alcanzan para saber qué comprar.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Probado a mano en el navegador: inicio sin caja abierta y con caja abierta (estado + efectivo esperado correctos), resumen de movimientos de hoy, pedidos pendientes, alerta de stock con link a la lista de viaje, lista completa con cantidad sugerida, filtro por marca/rubro (probado con rubro "Tecnología"), copiar al portapapeles (con timeout de seguridad) y exportación a Excel (filtrada y sin filtrar, contenido verificado). Confirmado por el cliente.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 89 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] Los criterios de aceptación de las specs 005, 007 y 009 siguen cumpliéndose. — Sin cambios en esos módulos; solo lectura de sus datos.
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
