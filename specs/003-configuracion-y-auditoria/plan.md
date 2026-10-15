# Plan 003 — Configuración y auditoría

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`Setting`**: fila única (no clave/valor genérico — son 3 campos conocidos, no vale la pena la flexibilidad de un key-value store todavía). `id` fijo (`"singleton"`) para que la app siempre lea/escriba la misma fila. Campos: `razonSocial` (String), `textoTicketAdicional` (String?, opcional), `stockMinimoDefault` (Int, default 5).
- **`AuditLog`**: `id`, `userId` (FK a `User` — nunca se borran usuarios, solo se desactivan, así que la relación siempre es válida), `action` (enum `AuditAction`, empieza con las de usuarios/roles de la spec 002 — `USER_CREATED`, `USER_UPDATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED` — las specs 005-009 agregan sus propios valores cuando las construyan), `targetType` + `targetId` (strings, **no** FK — ver riesgo), `detail` (JSON, lo que corresponda a cada acción: nombre, rol viejo/nuevo, etc.), `reason` (string opcional, el "motivo" de la constitución regla 13 — sin uso todavía en esta spec, lo van a usar las de negocio), `createdAt`.
- `User` necesita la relación inversa `auditLogs AuditLog[]` (Prisma la pide declarada de los dos lados).

## 2. Rutas y pantallas

| Ruta | Pantalla | Quién accede |
|---|---|---|
| `/configuracion` | Razón social, texto del ticket, stock mínimo por defecto | Permiso "ver"/"editar" en Configuración |
| `/configuracion/auditoria` | Registro de auditoría, con filtros por fecha/usuario/acción | Permiso "ver" en Configuración |

Se agrega "Configuración" a la navegación (`nav-items.ts`), visible según el permiso (no hardcodeado a Dueño como "Usuarios" — este módulo sí usa la matriz de la spec 002).

## 3. Lógica de servidor

- `src/lib/audit.ts`: `logAudit(tx, { userId, action, targetType, targetId, detail?, reason? })`. Recibe el cliente de transacción (`Priska.TransactionClient`), no una conexión nueva — así la entrada de auditoría se guarda **siempre** junto con la acción que audita, en el mismo `$transaction`, nunca por separado (regla de negocio de `spec.md`, sección 5).
- Se retocan las Server Actions de la spec 002 para pasar su escritura principal + `logAudit` dentro de un mismo `prisma.$transaction`:
  - `createUser`: después de crear en Supabase Auth, `prisma.user.create` + `logAudit(USER_CREATED)`.
  - `updateUser`: `prisma.user.update` + `logAudit(USER_UPDATED, detail: { nombreViejo, nombreNuevo, rolViejo, rolNuevo })`.
  - `setUserActive`: `prisma.user.update` + `logAudit(USER_ACTIVATED | USER_DEACTIVATED)`.
  - `createRole`: `prisma.role.create` + `logAudit(ROLE_CREATED)`.
  - `updateRole`: ya usa `$transaction` (la matriz) — se le agrega `logAudit(ROLE_UPDATED)` al array.
  - `deleteRole`: captura el nombre del rol antes de borrar, `prisma.role.delete` + `logAudit(ROLE_DELETED)`.
- `src/app/(app)/configuracion/actions.ts`: `updateSettings` (upsert de la fila única, con `requirePermission(..., CONFIGURACION, "editar")`).
- `src/app/(app)/configuracion/auditoria/page.tsx`: lee filtros de `searchParams` (fecha desde/hasta, usuario, acción) — formulario `GET`, sin JavaScript de por medio, mismo estilo que el resto de la app.

## 4. Componentes

- Formulario simple de parámetros (`Input`, sin matriz ni nada especial).
- Tabla de auditoría (`Table`, reutilizada) + filtros con `Select` (usuario, acción) e `Input type="date"` (desde/hasta).

## 5. Permisos

Primer uso real de `requirePermission(user, ModuloNegocio.CONFIGURACION, acción)` (spec 002) fuera de los tests — hasta ahora esa fila de la matriz existía pero nada la consultaba. Sin cambios al seed: el Dueño ya tiene "ver"/"editar"/"exportar" en Configuración desde la spec 002 (`seedOwnerRole` recorre todos los módulos); Encargado y Cajero siguen sin ese permiso por defecto, asignable después desde `/roles`.

## 6. Pruebas

- Sin tests unitarios nuevos: `logAudit` es un wrapper fino sobre `prisma.auditLog.create`, no tiene lógica propia que valga la pena aislar.
- E2E (Playwright): crear un usuario y confirmar que aparece una entrada `USER_CREATED` en `/configuracion/auditoria`; filtrar por acción y por usuario y confirmar que los resultados son los esperados; confirmar que no hay ningún botón de editar/borrar en esa pantalla.

## 7. Riesgos y decisiones

- **`targetId` no es una foreign key.** Es un string suelto a propósito: si se borra un rol (acción permitida), su entrada de auditoría tiene que seguir existiendo y legible — una FK real rompería ahí (`ON DELETE RESTRICT` bloquearía el borrado, o `SET NULL` perdería el dato). El costo es no poder hacer `include` directo desde `AuditLog` hacia la entidad afectada; para esta spec no hace falta (el `detail` ya guarda lo necesario para mostrarlo).
- **`Setting` como fila única con id fijo**, no un key-value genérico. Más simple de tipar y de leer; si más adelante hacen falta muchos parámetros más, se reconsidera.
- **Se retocan Server Actions ya existentes de la spec 002.** No es ideal cambiar código ya cerrado, pero la alternativa (auditoría "por fuera", sin transacción) viola la regla de negocio de esta spec. Se verifica de nuevo todo lo de la spec 002 (sus propios criterios de aceptación) después del cambio, no solo lo nuevo.
- **No se pueden pasar los íconos de la navegación desde el servidor.** Al agregar "Configuración" con permiso real (no `ownerOnly` hardcodeado), la primera versión calculaba `visibleNavItems(appUser)` en el layout (Server Component) y pasaba el array ya filtrado — con los íconos de `lucide-react` adentro — como prop a `AppShell`/`SideNav`/`BottomNav`. React tira "Functions cannot be passed directly to Client Components" porque un componente de ícono es una función, y las Server Components no pueden serializar funciones como prop (solo Server Actions o JSX ya armado). La solución: el layout le pasa a `AppShell` el **usuario** (dato plano, serializable — `UserLike`), y el filtrado con íconos pasa a hacerse adentro de `SideNav`/`BottomNav` (ya son `"use client"`), llamando `visibleNavItems(user)` ahí. Ningún Server Component debe pasarle a un Client Component un array que contenga componentes de React u otras funciones — pasar los datos crudos y dejar que el cliente decida qué renderizar con ellos.
- **`permissions.ts` se separó de `getCurrentUser` (ahora en `src/lib/current-user.ts`).** Hacía falta para este mismo motivo: la navegación (cliente) necesita las funciones puras de permisos, y si `getCurrentUser` seguía en el mismo archivo, importar cualquier cosa de ahí arrastraba Prisma/Supabase al bundle del navegador — el mismo bug de Turbopack de la spec 002 (sección 7 de su `plan.md`), pero esta vez con `permissions.ts` en lugar del cliente de Prisma directamente.
- **Se agregó el paquete `server-only`** a `src/lib/prisma.ts`, `src/lib/current-user.ts`, `src/lib/supabase/{admin,server}.ts` y `src/lib/audit.ts`. No hace nada en tiempo de ejecución; si alguno de estos módulos se llega a importar por error desde un componente cliente, falla el build con un mensaje claro en vez de un panic críptico de Turbopack como los que ya encontramos dos veces. Barato de mantener, vale la pena en cualquier archivo que toque Prisma, Supabase admin, o la sesión del servidor.
