# Plan 018 — Keep-alive de la base de datos

> Cómo se construye lo que dice `spec.md`: un Route Handler protegido con un secreto y un cron diario en `vercel.json`.

## 1. Modelo de datos

Sin cambios. Sin migraciones.

## 2. Lógica (`src/lib/cron-auth.ts`, pura y con pruebas)

`isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean`

- Devuelve `false` si `secret` es `undefined` o vacío (RF-3).
- Devuelve `false` si el encabezado falta o no tiene la forma exacta `Bearer <secret>` (RF-2).
- Compara con `timingSafeEqual` de `node:crypto` sobre los hashes SHA-256 de ambos valores (así tienen el mismo largo y no se filtra información por tiempo de respuesta).

## 3. Ruta (`src/app/api/cron/keep-alive/route.ts`)

`GET(request: Request)`:

1. `isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)`; si no, `401` con `{ ok: false }` (RF-2, RF-3).
2. Consulta `SELECT 1` con el singleton de `src/lib/prisma.ts` (pooler, `DATABASE_URL`).
3. `200` con `{ ok: true, at: <ISO> }` (RF-1). Si lanza, `console.error` y `500` con `{ ok: false }` (RF-4).
4. `export const dynamic = "force-dynamic"` para que nunca se cachee (RF-5).

No hay `proxy.ts` ni `middleware.ts` en el proyecto, así que la ruta no pasa por ninguna redirección de login.

## 4. Configuración

- `vercel.json`: se agrega `"crons": [{ "path": "/api/cron/keep-alive", "schedule": "0 12 * * *" }]` (RF-6), conservando `regions`.
- `.env.example`: `CRON_SECRET` con instrucciones para generarlo en PowerShell (RF-7).
- En Vercel: definir `CRON_SECRET` en Settings > Environment Variables (Production) y volver a desplegar. Vercel lo envía solo como `Authorization: Bearer <CRON_SECRET>`.

## 5. Permisos

Sin matriz de permisos: la barrera es el secreto compartido, validado en el servidor (constitución, regla 14).

## 6. Decisiones y riesgos

- **Hash antes de `timingSafeEqual`:** la función exige buffers del mismo largo; hashear evita filtrar el largo del secreto y no lanza excepciones.
- **Un cron una vez por día:** límite del plan Hobby; sobra frente al umbral de una semana de Supabase.
- **Un proyecto ya pausado no se despierta con esto.** Es preventivo.
- **Next.js de esta versión tiene cambios:** se revisó `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` antes de escribir el handler.
