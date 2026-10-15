# Spec 001 — Base del proyecto

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | — |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Dejar creado el esqueleto técnico sobre el que se construyen los demás módulos.

## 2. Alcance

**Incluye:**

- Proyecto Next.js (App Router) con TypeScript en modo estricto
- Tailwind CSS y shadcn/ui configurados
- Conexión a Supabase (Auth y Postgres) y a Prisma (DATABASE_URL y DIRECT_URL)
- PWA: manifest, íconos y service worker con caché del catálogo
- Layout responsivo base, con navegación para celular y PC
- Inicio y cierre de sesión con Supabase Auth
- Despliegue inicial en Vercel (región São Paulo) y variables de entorno
- Linter, chequeo de tipos y base de pruebas automáticas

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. Tampoco incluye el catálogo en sí (spec 004) ni roles y permisos granulares (spec 002) — acá solo existe "tener sesión" o "no tenerla".

## 3. Historias de usuario

- Como dueño o empleado, quiero iniciar sesión con mi email y contraseña para poder usar el sistema.
- Como dueño o empleado, quiero cerrar sesión para dejar la PC de caja (un dispositivo compartido) sin mi cuenta abierta.
- Como dueño, quiero instalar la aplicación en mi celular como una app para acceder rápido sin buscarla en el navegador.
- Como dueño o empleado, quiero una navegación clara y pensada para el tamaño de mi pantalla (celular o la PC de caja) para no perderme entre módulos.
- Como dueño o empleado, quiero que si intento entrar sin haber iniciado sesión, el sistema me lleve directo a la pantalla de login, para que nadie entre al sistema sin autenticarse.

## 4. Requisitos funcionales

- El sistema permite iniciar sesión con email y contraseña.
- Si el email o la contraseña son incorrectos, se muestra un mensaje de error claro (regla 24 de la constitución) sin indicar cuál de los dos está mal.
- El sistema permite cerrar sesión desde cualquier pantalla.
- Cualquiera que intente acceder sin sesión activa es redirigido a la pantalla de login.
- Quien ya tiene sesión activa y entra a la URL de login es redirigido a la pantalla de inicio.
- La navegación se adapta al tamaño de pantalla: barra inferior en celular, barra lateral en PC.
- La aplicación se puede instalar desde el navegador (PWA) en celular y en PC.
- La interfaz está en español de Argentina (regla 23 de la constitución).

## 5. Reglas de negocio

- No hay registro público: las cuentas las crea el dueño (se implementa en la spec 002). Esta spec no agrega una pantalla de "crear cuenta".
- La sesión se verifica siempre del lado del servidor, nunca confiando en lo que mande el navegador (constitución, regla 14).
- Se recomienda verificación en dos pasos para la cuenta del dueño (`docs/PROJECT.md`, sección 7) — queda como mejora a futuro, no bloqueante para esta spec.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver el layout y navegar por la aplicación | Cualquier usuario con sesión activa |
| Iniciar sesión | Cualquiera con una cuenta creada previamente (no hay autoregistro) |
| Cerrar sesión | El usuario que inició esa sesión |

Permisos granulares por rol (ver costos, anular ventas, etc.) se definen en la spec 002 — todavía no existen roles.

## 7. Casos borde y errores

- Email o contraseña incorrectos: mensaje de error claro, sin indicar cuál de los dos campos está mal (para no filtrar qué emails tienen cuenta).
- Usuario sin sesión intenta entrar a cualquier pantalla: redirige a `/login`.
- Usuario con sesión activa intenta entrar a `/login`: redirige a la pantalla de inicio.
- Falla la conexión a Supabase o a la base: se muestra un error, nunca una pantalla en blanco ni el detalle técnico.
- El navegador no soporta instalar la PWA: la aplicación igual funciona normalmente como sitio web.
- Sin conexión a internet: no hay modo offline (fuera de alcance, ver `docs/PROJECT.md`); se asume conexión estable en el local (supuesto del cliente, sección 8).

## 8. Criterios de aceptación

- [x] Un usuario sin sesión que intenta entrar a cualquier pantalla es redirigido a `/login`.
- [x] Un usuario puede iniciar sesión con email y contraseña válidos y llega a la pantalla de inicio.
- [x] Si el email o la contraseña son incorrectos, se muestra un mensaje de error claro y la pantalla no se rompe.
- [x] Un usuario con sesión activa puede cerrar sesión y vuelve a la pantalla de login.
- [x] Un usuario con sesión activa que entra a `/login` es redirigido a la pantalla de inicio.
- [x] La navegación se ve y funciona correctamente en una vista de celular y en una de PC.
- [x] La aplicación se puede instalar desde Chrome (PWA): manifest, íconos y service worker responden correctamente.
- [x] El código pasa el linter, el chequeo de tipos y las pruebas automáticas (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`).
- [x] La aplicación está desplegada y responde en una URL pública (`el-maestro-ecommerce`, Vercel, región São Paulo).

## 9. Entidades previstas

`User`: vinculado al usuario de Supabase Auth (`authUserId`). Sin más datos propios en esta spec — nombre, rol y permisos se agregan en la spec 002.

## 10. Preguntas abiertas

- Nombre de la aplicación y dominio: por ahora se usa "Importadora" como nombre genérico (metadata, manifest) y el dominio por defecto de Vercel. Falta que el cliente defina el nombre comercial final y si va a tener dominio propio (`docs/PROJECT.md`, sección 12).
