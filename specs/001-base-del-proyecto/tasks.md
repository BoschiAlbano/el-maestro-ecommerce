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
  - **Falta verificar el camino "con sesión"** — el proyecto Supabase está recién creado y no tiene ningún usuario todavía. Hace falta crear uno de prueba (dashboard → Authentication → Users → Add user) para probar login exitoso y logout de punta a punta.
  - De paso: el login hace `upsert` en la tabla `users` de Prisma (liga el usuario de Supabase Auth con nuestra fila) — primer uso real de la base conectada.
- [x] **T-009** Base de pruebas automáticas (Vitest + Playwright) con al menos una prueba smoke.
  - Hecho cuando: `npm test` corre y pasa en CI local. — `npm run test` (Vitest, 5 casos de `roundToPeso` — regla 6 de la constitución) y `npm run test:e2e` (Playwright, contra un build de producción real: redirect sin sesión y error de login inválido contra el Supabase Auth real, no mockeado). Falta un test E2E del login exitoso — necesita el usuario de prueba pendiente de T-008.
- [x] **T-010** Variables de entorno documentadas (`.env.example`) y primer despliegue en Vercel (región São Paulo).
  - Hecho cuando: la app responde en la URL de Vercel con las variables cargadas. — Proyecto Vercel `importadora-app` creado (sin tocar los 13 proyectos existentes de la cuenta), región `gru1`/São Paulo confirmada por `X-Vercel-Id` en las respuestas reales. Las 4 variables cargadas (`DATABASE_URL`/`DIRECT_URL` como "Secret", las dos `NEXT_PUBLIC_*` como "Config"). Deploy a producción funcionando.
  - **Falta un paso tuyo:** Vercel protege por defecto con SSO cualquier dominio que no sea propio, así que `importadora-app.vercel.app` devuelve 404 a quien no tenga cuenta de Vercel. Hay que desactivarlo a mano: Dashboard → proyecto → Settings → Deployment Protection → Vercel Authentication → Disable. No lo hice yo porque es debilitar una barrera de seguridad — eso lo decidís vos.

## Verificación final

- [ ] Se probaron todos los criterios de aceptación de `spec.md`. — Pendiente: `spec.md` todavía tiene varias secciones "Por completar" (historias de usuario, requisitos funcionales, criterios de aceptación). Hay que completarla antes de poder decir que la spec está "Verificada".
- [x] Linter, tipos y pruebas pasan. — `npm run lint`, `npm run build` (incluye chequeo de tipos) y `npm run test` limpios; `npm run test:e2e` pasa contra un build de producción real.
- [ ] `docs/PROJECT.md` actualizado (estado de la spec). — Pendiente: pasar la fila de la spec 001 de "Borrador" a "En desarrollo" (todavía no "Verificada", por el punto anterior).
