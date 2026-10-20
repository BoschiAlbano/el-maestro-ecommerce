# Plan 017 — Reinicio del sistema

> Cómo se construye lo que dice `spec.md`. Una acción de servidor que vacía las tablas de negocio en una transacción y después limpia lo que vive fuera de la base (cuentas de acceso y fotos).

## 1. Modelo de datos

**Una migración mínima:** se agrega el valor `SYSTEM_RESET` al enum `AuditAction` (`ALTER TYPE "AuditAction" ADD VALUE 'SYSTEM_RESET'`), para poder registrar la entrada del RF-13. Se escribe a mano (la base sombra de `migrate dev` no reproduce las migraciones viejas) y se aplica con `migrate deploy`. Es compatible hacia atrás: el código ya publicado no conoce el valor pero tampoco se rompe.

Sin tablas ni columnas nuevas.

## 2. Lógica (`src/lib/system-reset.ts`, pura y con pruebas)

- `RESET_PHRASE = "REINICIAR EL SISTEMA"`.
- `validateResetConfirmation({ password, phrase })`: devuelve el mensaje de error o `null`. La frase debe coincidir **exacta** (mayúsculas incluidas, solo se ignoran los espacios de los extremos); la contraseña es obligatoria.
- `summarizeReset(counts)`: arma las filas del resumen del RF-3 (etiqueta singular/plural y cantidad) y las advertencias del caso borde (turno abierto, pedidos pendientes). Se usa en la pantalla y se prueba aparte.

## 3. Acceso a datos (`src/lib/system-reset-data.ts`, `server-only`)

- `loadResetSummary()`: cuenta productos, marcas, rubros, ventas, pedidos, ingresos, turnos, empleados, usuarios (sin el Dueño que mira), entradas de auditoría, y si hay un turno abierto y cuántos pedidos pendientes.
- `wipeBusinessData(tx, owner)`: el borrado de la base, dentro de la transacción que le pasa la acción:
  1. `TRUNCATE TABLE` de todas las tablas de negocio con `RESTART IDENTITY CASCADE`: `audit_logs`, `notifications`, `ticket_reprints`, `sale_items`, `sales`, `order_items`, `orders`, `cash_movements`, `cash_shifts`, `stock_entry_items`, `stock_entries`, `stock_movements`, `product_price_history`, `products`, `brands`, `rubros`, `employees`. `RESTART IDENTITY` reinicia el contador de `sales.ticketNumber` (RF-10). `CASCADE` es seguro porque todo lo que referencia a esas tablas está en la misma lista.
  2. Borra los `users` distintos del Dueño que ejecuta, los `role_permissions` y los `roles` que no son el rol Dueño.
  3. No toca `settings` ni al Dueño ni a su rol (RF-9).
- Los nombres de tabla son fijos en el código (no vienen de la entrada del usuario); se usan con `$executeRawUnsafe` solo por eso.

## 4. Acción de servidor (`src/app/(app)/configuracion/sistema-actions.ts`)

`resetSystem(_prev, formData)`:

1. `requireOwner(currentUser)` (RF-5). Un rol sin Dueño no llega a nada más.
2. `validateResetConfirmation` con la frase y la contraseña enviadas.
3. **Verificar la contraseña** con un cliente de Supabase sin sesión ni cookies (`createClient` de `@supabase/supabase-js` con la clave anónima, `persistSession: false`) y `signInWithPassword({ email: currentUser.email, password })`. Así no se pisa la sesión actual. Si falla: "Contraseña incorrecta." y no se borra nada.
4. Leer los `authUserId` de los demás usuarios y la lista de fotos **antes** de borrar.
5. `prisma.$transaction(async (tx) => { await wipeBusinessData(tx, currentUser); await logAudit(tx, { action: "SYSTEM_RESET", userId: currentUser.id, targetType: "System", targetId: "system", detail: { usuario: currentUser.username } }); }, { timeout: 60_000 })` (RF-13: la entrada nace en la misma transacción; si algo falla, todo vuelve atrás).
6. Después de confirmada la transacción: borrar las cuentas de acceso de los demás usuarios con `admin.auth.admin.deleteUser` y las fotos del bucket `product-photos` (`list` + `remove` en tandas). Cada falla se acumula en una lista (RF-12).
7. `revalidatePath("/", "layout")`. Sin fallas: `redirect("/inicio?reiniciado=1")` (RF-11). Con fallas: devuelve el estado con la lista de lo que quedó sin borrar, para mostrarlo en la pestaña.

## 5. Pantalla

| Archivo | Cambio |
|---|---|
| `configuracion/page.tsx` | Calcula `esDueno` y, solo si lo es, carga `loadResetSummary()` y lo pasa al formulario |
| `configuracion/settings-form.tsx` | Tercera pestaña "Sistema", renderizada solo si `esDueno` (RF-1) |
| `configuracion/reset-system-tab.tsx` (nuevo, cliente) | Texto de advertencia (irreversible, misma base que el sitio publicado, RF-2), tabla del resumen (RF-3), campos de contraseña y frase, botón rojo deshabilitado hasta que la frase coincida y haya contraseña (RF-4) y mientras se procesa; muestra errores y la lista de pendientes (RF-12) |
| `(app)/inicio/page.tsx` | Si llega `?reiniciado=1`, muestra un aviso "El sistema se reinició" (RF-11) |
| `configuracion/auditoria/page.tsx` | Etiqueta "Sistema reiniciado" para `SYSTEM_RESET` |
| `scripts/reset-database.ts` | Se elimina: quedó desactualizado (no conoce ventas, pedidos, empleados ni notificaciones) y duplica esta función de forma peligrosa |

## 6. Permisos

Sin permisos de matriz: es `requireOwner`, igual que Usuarios y Roles (spec 002), validado en el servidor. La pestaña además no se renderiza para otros roles, pero eso es solo comodidad: la barrera real es el servidor.

## 7. Decisiones y riesgos

- **`TRUNCATE` en vez de `deleteMany`.** Es mucho más rápido, reinicia los contadores (RF-10) y es transaccional en Postgres: si algo falla, vuelve atrás. Requiere ser dueño de las tablas, lo cual se cumple con la conexión que ya usa Prisma.
- **Lo externo no es transaccional** (cuentas de Auth y fotos). Se borra después de confirmar la base, se acumulan las fallas y se informa; repetir el reinicio es seguro porque no depende de nada que ya se haya borrado.
- **Verificación de contraseña con un cliente aparte** para no tocar la sesión del Dueño ni sus cookies.
- **No se ejecuta el reinicio real durante el desarrollo.** La base es la del sitio publicado y tiene los datos del cliente. Se valida con una corrida dentro de una transacción que se **revierte a propósito** (T-005), que comprueba el SQL y los conteos sin borrar nada. La prueba real la hace el cliente a mano.
- **Timeout.** Aunque el volumen actual es chico, la transacción lleva un límite de 60 s por si el sistema crece.
- **Doble envío.** El botón se deshabilita mientras la acción corre; el `TRUNCATE` también toma un bloqueo que serializa dos intentos simultáneos.
- **Next.js de esta versión tiene cambios:** antes de escribir la acción (Server Actions, `redirect`, `revalidatePath` con `layout`), revisar `node_modules/next/dist/docs/` según `AGENTS.md`.
