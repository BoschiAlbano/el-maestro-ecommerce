# Tareas 025 — Publicar productos en Mercado Libre desde el sistema

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** necesita al desarrollador (cuentas de prueba o revisión manual); el resto se hace en el código.

## Preparación

- [x] **T-001** **(D)** Prueba técnica (plan, sección 0) con la cuenta vendedora de prueba.
  - Hecho cuando: cada pregunta de la spec tiene resultado en `prueba-tecnica.md`.
  - Hecha el 2026-11-24, con una compra de prueba con retiro en el local. Cambios aprobados en las specs 025 (modelo de publicación) y 022 (RF-20b).
- [x] **T-002** Con la cuenta de prueba: ¿se puede crear una publicación con 0 unidades? Define el RF-7 (plan, sección 3.4).
  - Hecho cuando: el resultado está en `prueba-tecnica.md` y el plan lo tiene en cuenta.
  - Hecha el 2026-11-24: sí, se crea pausada por falta de stock. También se vio que la validación responde 400 con solo advertencias.

## Base de datos

- [x] **T-003** Migración: `ml_publication_data`, los valores por defecto en `settings`, `publishedFromSystem` en `ml_listings` y `localPickUp` en `ml_orders`. Copia previa.
  - Hecho cuando: aplica en la base de la nube, sin diferencias con el esquema.

## Lógica pura (con pruebas)

- [x] **T-004** `category-form.ts`: características de la categoría → campos del formulario.
  - Hecho cuando: Vitest cubre las características reales del cable y de la billetera.
  - Hecha el 2026-11-24, con las características reales guardadas en `src/lib/mercadolibre/publish/__fixtures__/`. La marca quedó en el formulario (ajuste en el plan, sección 3.1).
- [x] **T-005** `publication-rules.ts` y `publication-body.ts`: qué falta, decisión del código universal y cuerpo de alta y de edición.
  - Hecho cuando: Vitest cubre cada dato faltante, los tres casos del código y el cuerpo de la prueba técnica.
- [x] **T-006** `ml-validation.ts` y `estimate.ts`.
  - Hecho cuando: Vitest cubre las causas reales de la prueba técnica y la estimación con y sin cargo fijo, envío gratis y permiso de costos.
  - Hecha el 2026-11-24. Una característica obligatoria faltante se muestra una sola vez (Mercado Libre la avisa como advertencia y como error).
- [x] **T-007** Retiro en el local (spec 022, RF-20b): `order-read.ts` y `mapOrderStatus`.
  - Hecho cuando: Vitest cubre la compra sin envío, entregada por `fulfilled` y por la marca `delivered`, y las pruebas de la spec 022 siguen pasando.
  - Hecha el 2026-11-24, con la orden real de la compra con retiro (comprador reemplazado por datos falsos).

## Servidor

- [x] **T-008** `publish-api.ts`: llamadas a Mercado Libre, con categoría y características en memoria.
  - Hecho cuando: con la cuenta de prueba trae la categoría sugerida, las características, la comisión y el costo del envío.
  - Hecha el 2026-11-24: además, la revisión previa detecta una obligatoria faltante y la búsqueda por SKU encuentra una publicación vigente. Apareció la advertencia de envío gratis obligatorio, ya traducida.
- [x] **T-009** `publications.ts`: guardar, revisar, publicar (con reclamo y búsqueda por SKU sin respuesta) y editar.
  - Hecho cuando: con la cuenta de prueba publica un producto y queda vinculado; publicar dos veces no duplica; editar la descripción la cambia en Mercado Libre.
  - Hecha el 2026-11-24 con el producto de prueba «Cargador USB-C 20W Prueba 025» (sin stock): `MLA2318269041` quedó vinculada y pausada por falta de stock; dos publicaciones a la vez dieron una sola; la tercera se rechazó; la descripción editada llegó a Mercado Libre. La búsqueda por SKU tarda unos segundos en ver una publicación nueva: si Mercado Libre no responde, el reclamo no se libera (ajuste en el plan, sección 3.4).

## Pantallas

- [x] **T-010** `/productos/[id]/mercadolibre`: el formulario, la estimación y los botones; el acceso desde la ficha del producto.
  - Hecho cuando: se prepara, revisa y publica un producto de prueba desde la pantalla.
  - Hecha el 2026-11-24 en el código (tipos, linter, build y 758 pruebas). La prueba desde la pantalla queda para T-013: pide iniciar sesión.
- [x] **T-011** Configuración (valores por defecto), marca en Publicaciones y «Retiro en el local» en Órdenes.
  - Hecho cuando: los valores por defecto se aplican a una publicación nueva y una compra con retiro se ve como tal.
  - Hecha el 2026-11-24 en el código; la revisión en pantalla queda para T-013.

## Documentación

- [x] **T-012** Notas en las specs 004, 020 y 022, y la sección de publicar en la guía de Mercado Libre.
  - Hecho cuando: cada documento tiene su nota con fecha.
  - Hecha el 2026-11-24: specs 004 y 020 (la 022 ya tiene el RF-20b), y la sección «Publicar desde el sistema» de `docs/guia-mercado-libre.md`.

## Cambio 2026-11-24: precio en el formulario y pestañas (spec, sección 10; plan, sección 7)

- [x] **T-014** Precio en el formulario: se guarda como en la ficha del producto (historial y envío a Mercado Libre), con el permiso «cambiar precios»; la estimación usa el precio que se escribe.
  - Hecho cuando: Vitest cubre la decisión del cambio de precio; con la cuenta de prueba, cambiar el precio de la publicación de prueba llega a Mercado Libre.
  - Hecha el 2026-11-24 (`price-change.test.ts`). Con la publicación de prueba: la estimación a $12.000 no guardó nada; sin el permiso se rechazó; con el permiso el precio quedó en el producto, en el historial y en Mercado Libre.
- [x] **T-015** Pestañas Producto y Mercado Libre en la ficha; la ruta vieja redirige.
  - Hecho cuando: tipos, linter y build pasan; los enlaces de Publicaciones y de la ficha abren la pestaña.
  - Hecha el 2026-11-24 en el código (763 pruebas); la revisión en pantalla queda para T-013.

## Verificación final

- [x] **T-013** **(D)** Verificación manual con la cuenta de prueba (plan, sección 5).
  - Hecha el 2026-11-24: el cliente publicó y editó desde la pantalla, revisó la compra con retiro en el local, los valores por defecto, el precio en el formulario y las pestañas.
- [x] Se probaron todos los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas").
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test` — 763 pruebas).
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — «Verificada (2026-11-24)».
- [ ] Antes del arranque: revisión previa sin publicar con la cuenta del cliente (plan, sección 6).
