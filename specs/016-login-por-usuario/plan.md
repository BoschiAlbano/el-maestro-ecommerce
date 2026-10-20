# Plan 016 — Ingreso por usuario y contraseña

> Cómo se construye lo que dice `spec.md`. La autenticación de fondo sigue siendo Supabase Auth con email y contraseña: el login solo traduce "usuario" → email antes de autenticar.

## 1. Modelo de datos

Dos columnas nuevas en `User` (`prisma/schema.prisma`):

- `username String`: el nombre como lo escribió el dueño (`El Maestro`), para mostrarlo.
- `usernameKey String @unique`: la forma normalizada (minúsculas, sin espacios de más) sobre la que se busca y se garantiza la unicidad sin distinguir mayúsculas (RF-1).

`email` se mantiene tal cual (único, sincronizado con Supabase Auth).

**Migración en tres pasos**, para no dejar filas sin usuario (RF-9):

1. Migración 1: agrega `username` y `usernameKey` **nullable**.
2. Script de asignación (idempotente, se corrió una vez y se borró): a cada cuenta sin usuario le asigna uno a partir de su `name`, con la lógica de `src/lib/username.ts` (sección 2), e imprime a quién le asignó qué.
3. Migración 2: pasa ambas columnas a `NOT NULL` y crea el índice único de `usernameKey`. Si quedó alguna fila sin asignar, esta migración falla en vez de seguir.

El orden importa: la restricción nunca se crea antes del backfill.

## 2. Lógica (`src/lib/username.ts`, pura y con pruebas)

- `normalizeUsername(raw)`: recorta y reduce espacios repetidos a uno. Es lo que se guarda en `username`.
- `usernameKey(raw)`: `normalizeUsername(raw).toLowerCase()`. Es lo que se guarda en `usernameKey` y lo que se busca.
- `validateUsername(raw)`: devuelve el mensaje de error o `null`. Reglas del RF-2: 3 a 40 caracteres tras normalizar; solo letras (con tildes y ñ), números, espacios, `.`, `-` y `_`; y rechaza lo que tenga forma de email.
- `suggestUsernames(rows)`: para el backfill. Recibe `{ id, name }` ordenadas por fecha de alta y devuelve `{ id, username }`: limpia el nombre (saca caracteres no permitidos, completa con `usuario` si queda muy corto, recorta a 40) y, si la clave ya está tomada, agrega ` 2`, ` 3`, … cuidando que el sufijo no pase de 40 ni choque con otro ya existente.

## 3. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` + migraciones | Sección 1 |
| `prisma/backfill-usernames.ts` | Script del paso 2 (ya corrido; se borró después porque dejó de compilar con el campo obligatorio) |
| `prisma/seed.ts` | El Dueño de prueba se crea con `username` (variable `SEED_ADMIN_USERNAME`, por defecto su nombre) |
| `src/app/login/login-form.tsx` | Campo "Usuario" (`name="username"`, `autoComplete="username"`) en lugar de email |
| `src/app/login/actions.ts` | Normaliza, busca `User` por `usernameKey`, toma su email y llama `signInWithPassword`. Si no existe o falla, devuelve el **mismo** error "Usuario o contraseña incorrectos." (RF-4). Los chequeos de activo y de cuenta sin configurar quedan igual (RF-5). |
| `src/app/(app)/usuarios/actions.ts` | `createUser`: agrega `username` (valida con `validateUsername`, chequea unicidad por `usernameKey`, guarda ambos). `updateUser`: permite cambiar el usuario con la misma validación; el Dueño puede editar el suyo (el límite sobre el propio rol no cambia). La auditoría suma `usuarioViejo` / `usuarioNuevo` (RF-10), nunca contraseñas. |
| `src/app/(app)/empleados/actions.ts` y `empleados/nuevo/employee-form.tsx` | El alta de empleado también crea un `User`: se agrega el campo usuario con la misma validación y unicidad. |
| `usuarios/nuevo/new-user-form.tsx`, `usuarios/[id]/edit-user-form.tsx` | Campo "Usuario"; el email queda como "Email" con la nota "No se usa para ingresar." |
| `usuarios/page.tsx`, `users-table.tsx`, `usuarios/[id]/page.tsx` | Mostrar el usuario donde hoy se muestra el email como identificador (RF-8) |
| `src/components/nav/user-menu.tsx`, `src/app/(app)/layout.tsx` | Mostrar `username` en lugar de `email` |
| `empleados/[id]/page.tsx`, `employee-form.tsx` (lista de usuarios disponibles) | Mostrar el usuario en lugar del email |

## 4. Permisos

Sin permisos nuevos. Elegir y cambiar el usuario es `requireOwner`, igual que el resto de la administración de usuarios (spec 002). El formato y la unicidad se validan **en el servidor**, y la unicidad además en la base (índice único). El login es público por definición.

## 5. Decisiones y riesgos

- **Dos columnas en vez de un índice sobre `lower(...)`.** Prisma no maneja bien índices únicos sobre expresiones; una columna normalizada es simple, se prueba con tests y funciona igual en Supabase.
- **Mensaje único en el login** (RF-4). Buscar en la base y luego autenticar tarda distinto si el usuario no existe; en esta etapa se acepta (la spec no pide igualar tiempos) y la protección contra fuerza bruta es la de Supabase Auth (decisión 3 de la spec).
- **Backfill sobre datos reales.** El script toca todas las cuentas. Se corre primero con `--dry-run` (imprime las asignaciones sin escribir) y recién después de verdad. El cliente maneja producción (ver memoria del proyecto): el agente trabaja solo en local y avisa qué comandos correr.
- **Colisión del sufijo.** Si el backfill genera `Juan 2` y ya hay alguien llamado `Juan 2`, `suggestUsernames` salta al siguiente número; la migración 2 es la red de seguridad si aun así hubiera un choque.
- **Acceso del Dueño.** Su usuario se toma de su nombre; si no le gusta, lo cambia desde `/usuarios/[id]` (RF-7).
- **Sesiones abiertas.** Cambiar el usuario no toca la sesión de Supabase (decisión 4 de la spec): no hay que invalidar nada.
- **Next.js de esta versión tiene cambios:** antes de tocar el login (Server Actions, `redirect`, formularios), revisar `node_modules/next/dist/docs/` según `AGENTS.md`.
