# Tareas 015 — Tienda online: ruta raíz y landing en blanco

> Pasos pequeños y verificables. Marcar `[x]` al terminar.

- [x] **T-001** Mover el inicio interno de `src/app/(app)/page.tsx` a `src/app/(app)/inicio/page.tsx` (con `git mv`, sin tocar el contenido).
  - Hecho cuando: `/inicio` muestra el mismo inicio que antes, con sesión; sin sesión lleva a `/login`. — Movido sin tocar el contenido; pendiente de tu revisión en el navegador.
- [x] **T-002** Landing: crear `src/app/page.tsx` vacía, pública, con `robots: noindex` y redirección a `/inicio` si hay sesión (solo Supabase Auth, sin Prisma).
  - Hecho cuando: `/` sin sesión es una página en blanco sin menú y con `<meta name="robots" content="noindex, nofollow">`; con sesión redirige a `/inicio`. — `src/app/page.tsx`; pendiente de tu revisión en el navegador.
- [x] **T-003** Actualizar las referencias: ítem "Inicio" del menú, `redirect` de `login/actions.ts` y `login/page.tsx`, `start_url` del manifiesto, migas de pan (`inicio` en `SECTIONS`) y su prueba unitaria.
  - Hecho cuando: iniciar sesión lleva a `/inicio`, "Inicio" del menú se resalta ahí, `breadcrumbs.test.ts` pasa con la ruta nueva y el manifiesto devuelve `start_url: "/inicio"`. — Hecho en código; `breadcrumbs.test.ts` pasa (8 pruebas).
- [x] **T-004** Barrido final de referencias a `/` como inicio (Grep en `src` y en `docs/CHECKLIST-PRUEBA-MANUAL.md`).
  - Hecho cuando: no queda ningún enlace, redirección ni texto que trate a `/` como el inicio del sistema. — Grep sin resultados; el checklist manual suma la prueba de `/`.
- [x] **T-005** `docs/PROJECT.md`: nota en "Fuera de alcance" que aclare que la landing en blanco de `/` (spec 015) no es la tienda online, y la spec 015 agregada a la tabla de estado.
  - Hecho cuando: `PROJECT.md` menciona la spec 015 y la nota sobre la tienda.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Revisados a mano por el cliente (2026-10-20).
- [x] Linter, tipos y pruebas unitarias pasan. — `eslint` y `vitest` limpios. `tsc --noEmit` solo marca `.next/types/validator.ts` (apunta al `(app)/page.tsx` viejo); se regenera al recompilar el servidor de desarrollo.
- [ ] Pruebas E2E. — Pendientes: se hacen en la pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (spec 015 "En desarrollo" en la tabla y nota en "Fuera de alcance"). Pasa a "Verificada" cuando revises los criterios de aceptación.
