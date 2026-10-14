# Plan 001 — Base del proyecto

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- `User`: vinculado 1 a 1 con el usuario de Supabase Auth (`authUserId`, UUID, único). Sin más campos propios todavía — nombre, rol y permisos llegan con la spec 002.
- Sin más tablas en esta spec. El resto del modelo (productos, stock, caja, pedidos) se define en sus specs respectivas.
- Prisma como fuente de verdad del esquema (`prisma/schema.prisma` + `prisma migrate`). El CLI de Supabase **no** se usa para migrar tablas, solo para el stack local (Docker), generación de tipos de Auth/Storage y configuración de esos productos. Motivo: evitar dos sistemas de migración compitiendo por el mismo esquema.

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/login` | Inicio de sesión | Público (sin sesión) |
| `/` | Layout base con navegación (celular y PC) | Cualquier usuario autenticado |

El contenido real de `/` (inicio del dueño, ventas, etc.) se arma en las specs correspondientes (008, 012...). Acá solo el shell de navegación.

## 3. Lógica de servidor

- Cliente Supabase para Server Components / Route Handlers (`@supabase/ssr`). Sin middleware (ver sección 7) — la sesión se chequea en cada Server Component que la necesita.
- Cliente Supabase de navegador para el formulario de login.
- `src/lib/prisma.ts`: instancia única de `PrismaClient` (evitar múltiples instancias en dev con hot-reload).
- Sin Server Actions de negocio todavía — eso empieza con la spec 002.

## 4. Componentes

- Base de shadcn/ui (`npx shadcn init`, preset `base-nova`) con variables CSS para theming (soporta claro/oscuro a futuro, aunque no es requisito ahora).
- Componentes iniciales: `Button`, `Input`, `Card`, `Sonner` (toasts) — se agregan los que hagan falta a medida que se arman las pantallas.
- Layout con navegación: barra inferior en celular, barra lateral en PC (mobile-first, regla 22 de la constitución).

## 5. Permisos

No aplica todavía (no hay roles ni acciones sensibles en esta spec). Lo único: sin sesión válida, redirigir a `/login`. Eso se resuelve en cada Server Component protegido (`(app)/layout.tsx`, `login/page.tsx`), no en el cliente.

## 6. Pruebas

- Unitarias: Vitest — `src/lib/money.test.ts` (regla 6 de la constitución, redondeo al peso).
- E2E: Playwright Test (`tests/e2e/`), corre contra un build de producción real. MCP de Playwright aparte, para uso interactivo.
- Criterio mínimo: `npm run lint`, `npm run build`, `npm run test` y `npm run test:e2e` pasan sin errores.

## 7. Riesgos y decisiones

- **Sin middleware de Next.js.** Se intentó proteger las rutas con `middleware.ts` (patrón estándar de `@supabase/ssr`), pero en este despliegue puntual (Next.js 16.4.1 + Turbopack, en Vercel) el middleware corre en runtime de Node sin pasar por el bundler: ni los imports del proyecto (alias `@/` o relativos) ni siquiera `next/server` resuelven (`ERR_MODULE_NOT_FOUND`), aunque localmente (`next build` + `next start`) funciona perfecto. Parece un bug de esa combinación puntual de versiones, no algo que dependa de cómo esté escrito el código. Se sacó el middleware; la protección de sesión quedó solo en los Server Components (`(app)/layout.tsx` y `login/page.tsx`, ambos llaman a `supabase.auth.getUser()` y redirigen) — sigue cumpliendo la regla 14 de la constitución ("se valida en el servidor"), pero sin la ventaja de cortar la request antes de renderizar nada. Revisar en una próxima actualización de Next.js si el middleware vuelve a ser viable.
- **PWA sin Serwist.** Next.js 16 usa Turbopack por defecto (dev y build). El adaptador `@serwist/next` no lo soporta, y `@serwist/turbopack` es, según su propio código fuente, un "workaround" temporal (bundlea el service worker con esbuild en una ruta dinámica). Para el alcance real de esta spec ("PWA instalable... sin modo offline", sección 2) no vale la pena esa complejidad: se escribió un service worker a mano (`public/sw.js`, ~50 líneas) con estrategia red-primero para navegación y cache-primero para `/_next/static/`. Sin precache con lista de hashes (eso es justo lo que resuelve Workbox/Serwist) — si más adelante hace falta caché más fina del catálogo (spec 004), se reevalúa.
- **Íconos generados por código.** `src/app/icon.tsx`, `apple-icon.tsx`, `icon-192/route.tsx` e `icon-512/route.tsx` usan `next/og` (`ImageResponse`) para generar un placeholder simple (fondo `#0f172a` + cuadrado blanco), sin depender de archivos de diseño que todavía no existen. **Reemplazar por el logo real cuando el cliente lo provea** (ver pregunta abierta en `spec.md`, sección 10).
- **Versión de Prisma.** El paquete `prisma` publicó `8.0.0-rc.22` bajo el tag `latest` en npm, mientras que `@prisma/client` sigue en `7.10.0` estable. Para evitar mezclar un CLI release-candidate con un client estable, se fijan ambos a **7.10.0** explícito (no `@latest`) hasta que Prisma 8 esté estable en ambos paquetes.
- **Prisma 7 saca `url`/`directUrl` de `schema.prisma`.** Ahora viven en `prisma7.config.ts` (un solo campo `datasource.url`, sin `directUrl`) y el runtime requiere un *driver adapter* explícito. Se resolvió así:
  - `prisma7.config.ts` → `datasource.url = DIRECT_URL` (conexión directa, puerto 5432): la usa Migrate/introspección.
  - `src/lib/prisma.ts` → `@prisma/adapter-pg` con `connectionString = DATABASE_URL` (pooler, puerto 6543): la usa la app en runtime.
  - **Validado contra el proyecto Supabase real** (`importadora-app`, ref `vkqhwzpavblqxnhskzcd`, región `sa-east-1`): conexión directa y pooler funcionan, y `prisma migrate dev` corrió sin problemas de shadow database. Sin el flag `?pgbouncer=true` (no aplica al driver `pg`, confirmado por la skill `prisma-orm-setup`). Falta probar con carga concurrente real antes de producción.
  - **Ojo con el hostname del pooler:** no es un patrón fijo por región (asumí `aws-0-sa-east-1...` y el real era `aws-1-sa-east-1...`). Siempre copiar la URI tal cual la muestra el dashboard (Settings → Database → Connect), nunca construirla a mano.
- **Tailwind v4.** Next.js 16 ya lo trae por defecto (configuración por CSS, sin `tailwind.config.js`). Se usa tal cual viene del scaffold.
- **"Cache Components" desactivado.** El template de Next 16 lo trae activado por defecto (`cacheComponents: true` en `next.config.ts`), pensado para apps con mezcla de páginas estáticas y dinámicas. Acá casi todo vive detrás de sesión (regla 14 de la constitución) — el layout de `(app)` ya usa `cookies()` para validar el usuario — así que casi nada es prerenderizable de verdad. Con Cache Components activado, `next build` fallaba pidiendo envolver todo en `<Suspense>` o marcar segmentos con `instant`/`"use cache"` para algo que total siempre es dinámico. Se desactivó (sacado del config) y se usa el modelo clásico: estático por defecto, dinámico automático en cuanto se usa `cookies()`/sesión. Las rutas de íconos (`icon-192`, `icon-512`) sí necesitan `export const dynamic = "force-static"` explícito porque los Route Handlers son dinámicos por defecto en el modelo clásico.
- **Dinero.** `decimal.js` como dependencia explícita para cálculos fuera de la base (redondeo al peso entero, regla 6 de la constitución), más allá del `Decimal` que ya expone Prisma para columnas numéricas.
- **Validación de datos.** `zod` para validar inputs de formularios y Server Actions.
- **`npm audit`: 9 "high" aceptadas por ahora.** Todas transitivas de herramientas de desarrollo (`eslint-config-next` → `fast-glob`/`micromatch`/`braces`; `prisma` CLI → `@prisma/config` → `deepmerge-ts`/`mysql2`), no viajan al build de producción. Arreglarlas con `npm audit fix --force` bajaría `eslint-config-next` a v14 (incompatible con Next 16) y `prisma` a v6 (pisa la fijación a 7.10.0 de arriba). Se revisa de nuevo cuando esas librerías publiquen una versión que no arrastre la dependencia vulnerable.
- **Vercel: protección SSO bloqueaba el dominio público.** Por defecto, Vercel protege con "Vercel Authentication" cualquier dominio que no sea un dominio propio — incluido `importadora-app.vercel.app`. El dueño y los empleados van a entrar sin cuenta de Vercel, así que hay que desactivarla a mano (Dashboard → proyecto → Settings → Deployment Protection). No se automatizó: es un cambio que debilita una barrera de seguridad, así que lo decide el cliente, no el agente.
