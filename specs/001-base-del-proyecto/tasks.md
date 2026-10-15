# Tareas 001 — Base del proyecto

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.

- [x] **T-001** Crear el proyecto Next.js (App Router, TypeScript estricto, Tailwind, ESLint) dentro del repo existente, sin pisar `docs/`, `specs/`, `AGENTS.md`, `CLAUDE.md`, `README.md`.
  - Hecho cuando: `npm run dev` levanta la página por defecto y la estructura `src/app` convive con `docs/` y `specs/`. — `npm run build` y `npm run lint` pasan limpios.
- [x] **T-002** Instalar y configurar shadcn/ui.
  - Hecho cuando: existe `components.json` y al menos un componente (`Button`) se importa sin error. — se agregaron además `Card`, `Input` y `Sonner`.
- [x] **T-003** Instalar Prisma (`prisma` + `@prisma/client`, versión fijada) y crear `prisma/schema.prisma` con el modelo `User` mínimo.
  - Hecho cuando: `npx prisma validate` no da errores y `npx prisma generate` corre bien. — fijado a `7.10.0` (ver riesgo en `plan.md`). Prisma 7 requiere driver adapter: se agregó `@prisma/adapter-pg` + `pg` y `src/lib/prisma.ts`.
  - Además: proyecto Supabase creado por CLI (`importadora-app`, ref `vkqhwzpavblqxnhskzcd`, org `BoschiAlbano's Org`, región `sa-east-1` — sin tocar el proyecto existente `peluqueria`). `DATABASE_URL`/`DIRECT_URL` cargados en `.env` y `npx prisma migrate dev --name init` aplicado contra la base real.
- [x] **T-004** Instalar `@supabase/supabase-js` y `@supabase/ssr`, con clientes de navegador y de servidor.
  - Hecho cuando: ambos helpers compilan (`tsc --noEmit`) sin usarse todavía en una pantalla real. — `src/lib/supabase/client.ts` y `src/lib/supabase/server.ts`.
- [x] **T-005** Instalar utilidades base: `zod` (validación) y `decimal.js` (dinero).
  - Hecho cuando: están en `package.json` como dependencias de producción.
- [x] **T-006** PWA: manifest, íconos y service worker.
  - Hecho cuando: la app se puede instalar desde Chrome y el catálogo (cuando exista) queda cacheado. — Service worker escrito a mano, no con Serwist (ver riesgo en `plan.md`: su adaptador para Turbopack es un workaround inmaduro). Verificado con `next build` + `next start`: `/manifest.webmanifest`, `/icon-192`, `/icon-512` y `/sw.js` responden bien. Falta probar "Agregar a pantalla de inicio" en un celular real. Íconos son placeholder — reemplazar cuando haya logo.
- [x] **T-007** Layout responsivo base con navegación (celular y PC).
  - Hecho cuando: la navegación se ve correcta en una vista de celular y una de escritorio. — `AppShell` con `SideNav` (desktop, `sm:flex`) y `BottomNav` (celular, `sm:hidden`). Ítems de módulos no construidos (Ventas, Stock, Pedidos, Caja) quedan deshabilitados y marcados "pronto" en vez de linkear a rutas rotas.
- [x] **T-008** Login y logout con Supabase Auth; protección de rutas sin sesión.
  - Hecho cuando: sin sesión redirige a `/login`; con sesión válida entra y puede cerrar sesión. — **Sin middleware** (ver riesgo importante en `plan.md`, sección 7: en este Next+Vercel+Turbopack puntual el middleware no arrancaba en producción). La protección vive en los Server Components: `(app)/layout.tsx` redirige a `/login` sin sesión, `login/page.tsx` redirige a `/` si ya hay sesión. Verificado en local y en producción (Vercel).
  - **Camino "con sesión" verificado** con el usuario de la semilla (T-011): login exitoso, email visible en el header, `/login` con sesión activa redirige a `/`, logout vuelve a `/login`. Probado con Playwright contra el Supabase Auth real.
  - De paso: el login hace `upsert` en la tabla `users` de Prisma (liga el usuario de Supabase Auth con nuestra fila) — primer uso real de la base conectada.
- [x] **T-009** Base de pruebas automáticas (Vitest + Playwright) con al menos una prueba smoke.
  - Hecho cuando: `npm test` corre y pasa en CI local. — `npm run test` (Vitest, 5 casos de `roundToPeso` — regla 6 de la constitución) y `npm run test:e2e` (Playwright, 3 casos contra un build de producción real: redirect sin sesión, error de login inválido y login/logout exitoso con el usuario de la semilla — todo contra el Supabase Auth real, no mockeado).
- [x] **T-010** Variables de entorno documentadas (`.env.example`) y primer despliegue en Vercel (región São Paulo).
  - Hecho cuando: la app responde en la URL de Vercel con las variables cargadas. — El proyecto Vercel original (`importadora-app`) se reemplazó por `el-maestro-ecommerce`, conectado al repo de GitHub con auto-deploy en cada push (decisión del cliente). Las 4 variables de entorno están cargadas en el proyecto nuevo (`DATABASE_URL`/`DIRECT_URL` como "Secret", las dos `NEXT_PUBLIC_*` como "Config"), confirmado por `vercel env ls`. Deploy funcionando según el cliente.

- [x] **T-011** Semilla de Prisma (`prisma/seed.ts`) para crear un usuario de prueba y poder hacer login sin pasar por el dashboard de Supabase.
  - Hecho cuando: `npm run db:seed` crea (o reutiliza) el usuario en Supabase Auth y su fila en `users`, y con esas credenciales se puede hacer login real en la app. — Corrido contra el proyecto real: usuario `dueno@importadora.local` creado y confirmado (`email_confirm: true`), fila en `users` creada vía `upsert`. Login/logout probado de punta a punta con Playwright.

## Verificación final

- [x] Se probaron todos los criterios de aceptación de `spec.md`. — Las 9 cajas de la sección 8 están marcadas, cada una contra algo verificado de verdad (test automático o prueba manual descripta en `tasks.md`), no por descarte.
- [x] Linter, tipos y pruebas unitarias pasan. — `pnpm lint`, `pnpm build` (incluye chequeo de tipos) y `pnpm test` limpios.
- [x] Pruebas E2E. — Hechas en su momento (`pnpm test:e2e`, contra un build de producción real y el Supabase Auth real), antes de la decisión de diferir el E2E a una pasada de endurecimiento (ver `AGENTS.md`, sección "Pruebas").
- [x] `docs/PROJECT.md` actualizado (estado de la spec). — Spec 001 pasada a "Verificada" en la hoja de ruta (sección 11).
