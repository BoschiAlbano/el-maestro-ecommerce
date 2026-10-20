# Plan 015 — Tienda online: ruta raíz y landing en blanco

> Cómo se construye lo que dice `spec.md`. Sin base de datos, sin dependencias nuevas: es mover una ruta y agregar una página vacía.

## 1. Modelo de datos

**Sin cambios en Prisma ni migraciones.**

## 2. Rutas y archivos

| Ruta | Archivo | Qué hace | Acceso |
|---|---|---|---|
| `/` | `src/app/page.tsx` (nuevo) | Landing vacía; con sesión redirige a `/inicio` | Público |
| `/inicio` | `src/app/(app)/inicio/page.tsx` (el actual `(app)/page.tsx`, movido con `git mv`) | Inicio del sistema (spec 012), sin cambios de contenido | Sesión activa (layout `(app)`) |

- **Landing (`src/app/page.tsx`)**: Server Component fuera del grupo `(app)`, por lo que no hereda el menú ni el chequeo de sesión (RF-2). Exporta `metadata = { robots: { index: false, follow: false } }` (RF-10) y renderiza un fragmento vacío. Si `supabase.auth.getUser()` devuelve usuario, `redirect("/inicio")` (RF-9).
- **Sin Prisma en la landing (RF-1)**: el chequeo de sesión usa solo el cliente de Supabase Auth (`createClient` de `@/lib/supabase/server`), igual que `login/page.tsx`. No se usa `getCurrentUser()` porque consulta la tabla `users`. Si la sesión es de un usuario desactivado, `/inicio` lo desloguea y lo manda a `/login` (comportamiento actual del layout).
- El `(app)/page.tsx` actual se mueve a `(app)/inicio/page.tsx` **sin tocar su contenido**; solo hay que revisar que no tenga imports relativos que se rompan.

## 3. Referencias que cambian de `/` a `/inicio`

| Archivo | Cambio |
|---|---|
| `src/components/nav/nav-items.ts` | Ítem "Inicio": `href: "/inicio"` (RF-4). Revisar cómo se calcula "activo": hoy es `pathname === item.href` en `app-sidebar.tsx`, sirve tal cual. |
| `src/app/login/actions.ts` | `redirect("/")` → `redirect("/inicio")` (RF-5) |
| `src/app/login/page.tsx` | `redirect("/")` → `redirect("/inicio")` (RF-5) |
| `src/lib/breadcrumbs.ts` | Agregar `inicio: "Inicio"` en `SECTIONS` para que `/inicio` dé `[{ label: "Inicio" }]` (RF-6). Las demás pantallas no muestran "Inicio" como primer nivel hoy; no se agrega. |
| `src/lib/breadcrumbs.test.ts` | Caso `/` → caso `/inicio`; el vacío (`/`) deja de ser una ruta del sistema pero la función se mantiene tolerante. |
| `src/app/manifest.ts` | `start_url: "/inicio"` (RF-8) |
| `docs/CHECKLIST-PRUEBA-MANUAL.md` | Si menciona `/` como inicio, pasarlo a `/inicio` |

Verificación de que no queda nada (criterio de aceptación): buscar `"/"` en `src` (Grep de `href="/"`, `redirect("/")`, `push("/")`, `pathname === "/"`, `start_url`) y revisar cada resultado. Las búsquedas previas a este plan solo encontraron los cuatro lugares de la tabla más `layout.tsx` (el `LayoutProps<"/">` de Next, que es un tipo y no se toca).

## 4. Permisos

Sin permisos nuevos. `/inicio` conserva la barrera del layout `(app)` (sesión + usuario activo, validados en el servidor; el proyecto no usa middleware, ver spec 001). La landing es pública a propósito y no expone datos.

## 5. Decisiones y riesgos

- **Redirección con sesión: solo un chequeo de cookie contra Supabase Auth.** `getUser()` valida el token con el servidor de Auth; para un visitante sin cookie no hay sesión y responde sin costo relevante. Es transitoria: al construir la tienda se quita (queda anotado en la spec, sección 9).
- **Páginas dinámicas.** Al leer cookies, la landing deja de ser estática. Es aceptable mientras esté vacía; la tienda real decidirá su estrategia de cache.
- **`proxy`/middleware: no se agrega.** El proyecto protege rutas en los Server Components; seguir igual.
- **Marcadores viejos a `/`** de gente con sesión siguen funcionando por la redirección; sin sesión caen en una landing en blanco en vez del login (aceptado en la spec, sección 7).
- **Next.js de esta versión tiene cambios:** antes de escribir código, leer en `node_modules/next/dist/docs/` lo relativo a `metadata` (robots), `redirect` y `manifest` (regla de `AGENTS.md`).
- **`docs/PROJECT.md`**: la pregunta abierta de la spec (nota sobre "Tienda online" fuera de alcance) se resuelve en T-005 con la propuesta ya escrita; si no se aprueba, se omite.
