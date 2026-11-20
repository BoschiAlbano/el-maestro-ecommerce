# Tareas 019 — Conexión con Mercado Libre

> Pasos pequeños y verificables. Cada tarea indica cómo saber que está hecha. Marcar `[x]` al terminar.
>
> Quién: **(D)** la hace el desarrollador a mano; el resto se hace en el código.

## Entorno y prueba técnica

- [x] **T-001** Entorno local: proyecto de Supabase con Docker en `Desktop\supabase\supabase-el-maestro`, `.env.development.local`, migraciones, semilla y bucket de fotos.
  - Hecho cuando: `pnpm dev` levanta contra la base local y el Dueño de prueba inicia sesión. `.env` y `.env.local` quedan sin tocar.
  - Hecho el 2026-11-11: 17 migraciones aplicadas, usuario `dueno` creado, bucket `product-photos` creado. `next dev` mostró `Environments: .env.development.local, .env.local, .env` y `/login` respondió 200. El inicio de sesión del Dueño se verificó contra la autenticación local por API (200); falta entrar una vez por la pantalla. Guía en `docs/entorno-local.md`.
  - Hallazgo: la migración `20261015003109_require_user_role` falla en una base vacía. Se resolvió solo en la base local, sin tocar el archivo (ver la guía).
- [x] **T-002** **(D)** Dominio fijo de ngrok y aplicación de desarrollo en el portal de Mercado Libre. Cargar `ML_CLIENT_ID`, `ML_CLIENT_SECRET` y `ML_REDIRECT_URI` en `.env.development.local`. Pasos en `prueba-tecnica.md`.
  - Hecho cuando: las tres variables están cargadas y el dominio fijo está reservado. — Hecho el 2026-11-11: aplicación creada, dominio `unpersonalizing-backboned-cherry.ngrok-free.dev` reservado, variables verificadas (sin mostrar la clave).
- [x] **T-003** **(D)** Prueba técnica P-1 a P-8 (sin P-5), con los comandos de `prueba-tecnica.md`.
  - Hecho cuando: cada verificación tiene su resultado anotado en `prueba-tecnica.md`, y el plan está corregido si algo difiere. — Hecho el 2026-11-11. Resultados en `prueba-tecnica.md`; el plan se corrigió en seis puntos (sección 0). P-7 (revocar desde la web) pasa a T-017. Queda sin confirmar si los avisos traen identificador propio: no hubo ningún aviso perdido para mirar.

## Base de datos

- [x] **T-004** Migraciones: `MercadoLibreConnection`, `MercadoLibreNotification`, sus enums, y los valores nuevos de `AuditAction` y `NotificationType`.
  - Hecho cuando: las migraciones aplican en la base local y `prisma generate` compila. — Hecho el 2026-11-11: `prisma/migrations/20261111190000_add_mercadolibre_connection`. Aplicada en la base local; el esquema y la base quedaron sin diferencias. Incluye una restricción a mano que impide una segunda fila en `ml_connections` (probada: la base la rechaza).
  - Nota: `prisma migrate dev` no se puede usar en este proyecto, por la migración histórica rota (ver `docs/entorno-local.md`). El SQL se generó con `prisma migrate diff` contra la base local y se aplicó con `prisma migrate deploy`. **No está aplicada en la base del cliente.**

## Autorización

- [x] **T-005** `token-crypto.ts` con pruebas.
  - Hecho cuando: Vitest cubre ida y vuelta, texto alterado, clave equivocada y cifrados distintos para el mismo texto. — `src/lib/mercadolibre/token-crypto.test.ts` (8 pruebas). Linter y tipos pasan.
- [x] **T-006** `oauth.ts` y `token-policy.ts` con pruebas.
  - Hecho cuando: Vitest cubre la dirección de autorización, el valor de control, PKCE, `shouldRefresh` y `classifyRefreshError` con los errores reales de T-003.
  - Hecho el 2026-11-11: `oauth.ts` (22 pruebas con `token-policy.ts`), incluido el ejemplo oficial de PKCE (RFC 7636) y el error real `invalid_grant` de la prueba técnica.
- [x] **T-007** `config.ts`, `client.ts` y `tokens.ts` (renovación con bloqueo).
  - Hecho cuando: hay una prueba de renovación simultánea en la que el segundo no llama a Mercado Libre, y `mlFetch` traduce los errores a los tres tipos del plan.
  - Hecho el 2026-11-11: `config.ts`, `http.ts`, `token-manager.ts`, `ml-fetch.ts`, `tokens.ts` y `client.ts`. La lógica de renovación es pura, con base y red inyectadas; hay pruebas de renovación simultánea (3 pedidos, 1 sola renovación), permiso revocado (aviso una sola vez), fallas pasajeras y autorización rechazada.
- [x] **T-008** Conectar: `startMercadoLibreConnection` y `GET /api/mercadolibre/callback`, con auditoría.
  - Hecho cuando: el Dueño conecta la cuenta por el túnel; un retorno alterado o repetido se rechaza; otro rol no puede.
  - Hecho el 2026-11-11, probado de punta a punta por el túnel de ngrok con la cuenta de prueba: la conexión quedó guardada con la autorización y la credencial de renovación **cifradas** (ninguna en claro), vigencia de 6 horas y auditoría `ML_CONNECTED`. Sin probar todavía: retorno alterado o repetido, usuario que no es Dueño, y otra cuenta con una ya conectada (cubiertos por pruebas unitarias de la lógica, falta verlo en pantalla).
- [x] **T-009** Desconectar: `disconnectMercadoLibre`, con auditoría.
  - Hecho cuando: borra la conexión, descarta los avisos pendientes y queda en la auditoría.
  - Código hecho el 2026-11-11 (`disconnectMl`, acción solo Dueño, revoca en Mercado Libre, descarta avisos pendientes, auditoría `ML_DISCONNECTED`). Probado en pantalla el 2026-11-11 por el desarrollador: desconecta con la confirmación y vuelve a conectar bien; la base confirma que revocó el permiso en Mercado Libre y dejó la auditoría. **Falta** ver en Mercado Libre que la aplicación ya no figura como conectada (C3) y la entrada en la pantalla de auditoría (C4).
  - Cerrada el 2026-11-11: probado en pantalla y en la base (revocó el permiso en Mercado Libre, descartó los avisos pendientes, auditó). Auditoría vista en pantalla.

## Avisos

- [x] **T-010** `inbox.ts` y `handlers.ts` (vacío) con pruebas.
  - Hecho cuando: Vitest cubre aviso válido, inválido, de otra aplicación, duplicado, sin conexión, de otra cuenta y tema sin función.
  - Hecho el 2026-11-11: `inbox.ts` con 25 pruebas (aviso válido e inválido, otra aplicación, clave de duplicados, descarte por cuenta, tema sin función, errores pasajeros contra errores propios) y `handlers.ts` vacío. `inbox-store.ts` guarda con una sola escritura que ignora repetidos y procesa los pendientes. Pendiente de confirmar: no se pudo ver un aviso perdido real, así que `parseMissedFeeds` acepta las formas probables de la respuesta.

- [x] **T-011** `POST /api/mercadolibre/notificaciones`, con procesamiento en `after`.
  - Hecho cuando: un aviso reenviado desde PowerShell queda guardado y pasa a "sin acción"; reenviarlo no lo duplica; uno de otra aplicación no se guarda.
  - Hecho el 2026-11-11, probado contra el servidor local: aviso propio guardado y pasado a «sin acción»; el mismo aviso repetido no se duplica; el de otra aplicación no se guarda; el de otra cuenta queda descartado; texto o JSON que no es un aviso responde 200 sin guardar. La latencia medida (15 a 25 ms en local; 420 ms por el túnel, en modo desarrollo) **no sirve para el límite de 500 ms**: se mide en Vercel (T-018).

- [x] **T-012** `recovery.ts`, `GET /api/cron/mercadolibre`, tarea en `vercel.json` y acción "Buscar avisos pendientes".
  - Hecho cuando: la ruta rechaza sin `CRON_SECRET`, y con él trae los avisos perdidos, reintenta fallidos y borra los de más de 30 días.
  - Hecho el 2026-11-11: `recovery.ts`, `GET /api/cron/mercadolibre` (401 sin secreto y con secreto malo; 200 con el correcto, 1,1 s, con llamadas reales a Mercado Libre), tarea diaria a las 13:00 UTC en `vercel.json` y botón «Buscar avisos pendientes» (permiso «editar» en Configuración). Mercado Libre aceptó la consulta de avisos perdidos del tema de publicaciones con el sitio. No se pudo verificar la recuperación con avisos reales: no había ninguno perdido.

## Interfaz

- [x] **T-013** Pestaña "Mercado Libre" en Configuración, visible con permiso "ver".
  - Hecho cuando: muestra los tres estados (sin conexión, conectada, requiere reconexión), los botones según el permiso, y los contadores de avisos.
  - Código hecho el 2026-11-11 (`mercadolibre-tab.tsx`). Probado el estado «conectada». Probados en pantalla el estado «conectada» y el estado «sin conexión» (tras desconectar). El estado «requiere reconexión» también se vio en pantalla (mensaje con el motivo y reconexión). **Falta** ver el botón «Buscar avisos pendientes» (T-017, A2).
  - Cerrada el 2026-11-11: probados los estados «conectada», «sin conexión» y «requiere reconexión», y el botón «Buscar avisos pendientes» («0 aviso(s) nuevo(s) recuperado(s), 0 procesado(s).»). Con permiso «ver» se ve la pestaña sin botones; con «editar» aparece «Buscar avisos pendientes»; solo el Dueño ve «Conectar» y «Desconectar».

- [x] **T-014** Aviso `ML_RECONEXION` en la campanita.
  - Hecho cuando: aparece al fallar la renovación de forma definitiva, se ve con permiso "ver" en Configuración y desaparece al reconectar.
  - Avance 2026-11-11 (adelantado porque el valor nuevo del enum rompía los tipos): permiso por tipo de aviso en `src/lib/notification-types.ts` con 5 pruebas, `notifyMlReconexion` en `notifications.ts` (no se repite si hay uno sin leer) y enlace en la campanita. Falta generarlo desde la renovación (T-007), marcarlo leído al reconectar (T-008) y verlo en pantalla.
  - Hecho el 2026-11-11, probado en pantalla: al revocarse el permiso apareció el aviso en la campanita (con enlace a la pestaña) y al reconectar desapareció. La base confirma que se crea un solo aviso aunque la pasada corra dos veces.

## Cierre

- [x] **T-015** Reinicio del sistema (spec 017): vaciar `ml_notifications`, conservar `ml_connections`. Anotar el cambio en la spec 017.
  - Hecho cuando: la prueba unitaria del reinicio contempla la tabla nueva.
  - Hecho el 2026-11-11: `ml_notifications` se vacía y `ml_connections` se conserva. La lista de tablas pasó a `system-reset.ts` (pura) con 4 pruebas nuevas. Probado en la base local con una transacción deshecha: `TRUNCATE … CASCADE` deja la conexión intacta. Además, si la cuenta la conectó otro usuario con rol Dueño, el reinicio la reasigna a quien reinicia: sin eso, borrar a ese usuario hacía fallar todo el reinicio por la clave foránea. Cambio anotado en la spec 017.

- [x] **T-016** `.env.example` con las cuatro variables y una guía corta del entorno local en `docs/`.
  - Hecho cuando: siguiendo la guía en PowerShell se levanta el entorno desde cero.
  - Hecho el 2026-11-11: `.env.example` con las cuatro variables y su explicación, y `docs/entorno-local.md` con el entorno completo (Supabase local, variables, túnel de ngrok). La guía se escribió a partir de lo hecho; falta probarla desde cero en otra máquina.
- [x] **T-017** **(D)** Verificación manual con la cuenta real (plan, sección 6).
  - Hecho cuando: cada criterio de aceptación de la spec tiene su resultado anotado acá abajo.
  - Pasos en `verificacion-manual.md` (A a F). Esa lista es la que cierra T-009, T-013 y T-014 y los criterios de aceptación de la spec que dependen de la pantalla.
  - Hecha el 2026-11-11 entre el desarrollador (conectar, desconectar, cancelar en Mercado Libre, reconectar, mensaje y campanita de reconexión) y una verificación en el navegador (pestaña, botón de avisos, retorno inventado, retorno sin sesión, auditoría, permisos con usuarios que no son Dueño; los usuarios de prueba se borraron). **No se hicieron:** C3 (ver en la web de Mercado Libre que la aplicación ya no figura; la API respondió «Autorización eliminada» y renovar después da `invalid_grant`), E1 (revocar desde la web: se revocó por la API), B2 (repetir el retorno real ya usado: el código es de un solo uso y la cookie se borra, y B1 ejercita el mismo rechazo) y F3 (campanita sin acceso a Configuración: cubierto por pruebas unitarias).

- [ ] **T-018** Medición de los 500 ms en Vercel, antes de la salida a producción. **Pendiente de despliegue: no bloquea el cierre de la spec.**
  - Hecho cuando: está medido el tiempo de respuesta de la ruta de avisos en un despliegue de Vercel, en frío y en caliente, y decidido si hace falta el plan B (plan, sección 8, riesgo 1).

## Verificación final

- [x] Se probaron los criterios de aceptación de `spec.md` (revisión manual o prueba unitaria documentada; ver `AGENTS.md`, sección "Pruebas"). — 11 de 13 con evidencia; **quedan 2 pendientes de despliegue o de un caso real** (los 500 ms en Vercel y la recuperación de un aviso perdido real), más la cobertura E2E diferida. Detalle en `spec.md`, sección 8.
- [x] Linter, tipos y pruebas unitarias pasan (`pnpm lint`, `pnpm build`, `pnpm test`). — Hecho el 2026-11-11: `tsc --noEmit`, `eslint src`, `pnpm build` y 300 pruebas sin errores.
- [ ] Pruebas E2E. — Pendiente (diferido a la pasada de endurecimiento previa al cierre del MVP, ver `AGENTS.md`).
- [x] `docs/PROJECT.md` actualizado (estado de la spec).
