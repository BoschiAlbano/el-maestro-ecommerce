# Tareas 005 — Inventario

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Schema de Prisma: `Product.currentStock`, enum `StockMovementType`, modelo `StockMovement`.
  - Hecho cuando: migración aplicada contra la base real sin drift. — Sin drift confirmado. De paso se actualizó el comentario del enum `AuditAction` (anticipaba una entrada de auditoría para "ajustar stock" que, por el mismo criterio que `cambiarPrecios` en la spec 004, no se usa — `StockMovement` ya cumple ese rol).
- [x] **T-002** `src/lib/stock.ts` (`registerStockMovement`) con pruebas unitarias.
  - Hecho cuando: los tests cubren que incrementa/decrementa `currentStock` según el signo de `quantity`, que permite dejarlo en negativo, y que la fila de `StockMovement` queda con los datos correctos. — Recibe un tipo estructural angosto (`StockTx`) en vez de `Prisma.TransactionClient`, mismo criterio que `BarcodeLookup` en `barcode.ts`: se puede mockear en los tests sin tocar la base ni los tipos pesados de Prisma. 5 tests.
- [x] **T-003** `src/lib/stock-count.ts` (`computeCountAdjustments`) con pruebas unitarias.
  - Hecho cuando: los tests cubren que solo devuelve productos con diferencia real, ignora los que coinciden, y maneja productos sin contar. — Función pura, sin Prisma. 5 tests, incluye el caso de carga inicial (todo en cero) como un conteo más.
- [x] **T-004** Pantalla `/inventario`: stock actual por producto y aviso de bajo stock.
  - Hecho cuando: se ve el stock de cada producto y los que están en o por debajo de su mínimo quedan marcados, gateado por el permiso "ver" en Inventario. — Solo productos activos (igual que el resto de la app no pagina, acá no filtra inactivos tampoco porque no tiene sentido gestionarles el stock). Negativo se distingue de "bajo stock" con su propio badge.
- [x] **T-005** Pantalla `/inventario/[productId]`: historial de movimientos y ajuste manual puntual.
  - Hecho cuando: se ve el historial completo de movimientos de un producto; con el permiso "editar" + especial "ajustar stock" se puede hacer un ajuste o una merma con motivo obligatorio, y aparece en el historial. Sin ese permiso especial, no se puede ajustar (ni por la interfaz ni llamando la Server Action directo). — El formulario de Merma oculta el selector de dirección (siempre resta); eso significa que `direction` llega `null` al servidor cuando el tipo es Merma — mismo tipo de bug que el de los `Select` opcionales de la spec 004 (sentinela/ausente sin traducir), esta vez evitado de entrada haciendo `direction` opcional en el esquema y convirtiendo `null` a `undefined` antes de parsear.
- [x] **T-006** Pantalla `/inventario/conteo`: conteo físico en dos pasos.
  - Hecho cuando: se cargan las cantidades contadas, se previsualizan las diferencias contra lo registrado antes de confirmar, y al confirmar solo se generan movimientos para los productos que realmente difieren. Sirve igual para la primera carga (con todo en cero) que para un conteo periódico. — `confirmCount` recalcula el delta contra el stock actual dentro de la transacción en vez de confiar en el delta de la previsualización (si cambió algo entre previsualizar y confirmar, lo que importa es a qué cantidad contada se quiere llegar, no un delta viejo); si ya coincide, no genera movimiento.
- [x] **T-007** Navegación: agregar "Stock" a la navegación, visible según permiso en Inventario (reemplaza la entrada deshabilitada que ya existe).
  - Hecho cuando: un usuario con permiso "ver" en Inventario ve la entrada; uno sin permiso, no.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Pendiente de tu revisión manual (código y lógica ya cubiertos por los tests unitarios de `stock.ts` y `stock-count.ts`).
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 43 tests).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [ ] Los criterios de aceptación de la spec 004 siguen cumpliéndose. — No debería haber impacto (spec 005 solo agrega campos/tablas nuevas, no toca nada de Catálogo), pero queda para tu revisión.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Se deja en "En desarrollo" hasta que confirmes la revisión manual; recién ahí pasa a "Verificada".
