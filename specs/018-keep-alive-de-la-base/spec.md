# Spec 018 — Keep-alive de la base de datos

| | |
|---|---|
| **Estado** | Verificada (2026-11-24) |
| **Depende de** | 001 |
| **Referencia** | `docs/PROJECT.md`, secciones 3 y 10 |

## 1. Objetivo

Evitar que Supabase **pause el proyecto por inactividad**. El plan gratuito pausa la base tras una semana sin actividad, y si el negocio no usa el sistema durante varios días (feriados, vacaciones, viaje del dueño) el sitio publicado deja de funcionar hasta que alguien lo reactive a mano desde el panel de Supabase.

Esta spec agrega una **tarea programada diaria** que hace una consulta mínima a la base, para que siempre registre actividad.

No reemplaza al plan de pago: `docs/PROJECT.md` (sección 10) recomienda Supabase Pro, que no se pausa. Esto es un paliativo para seguir en el plan gratuito.

## 2. Alcance

**Incluye:**

- Un endpoint interno que hace una consulta trivial a la base y responde si pudo.
- Una tarea programada de Vercel (cron) que lo llama una vez por día.
- Protección del endpoint con un secreto, para que no sea público.

**No incluye:**

- Monitoreo, alertas o avisos si la consulta falla.
- Guardar historial de las ejecuciones ni mostrarlo en pantalla.
- Mantener "despiertos" otros servicios (Auth, Storage): la actividad de la base alcanza.
- Cambios de esquema, migraciones ni pantallas.

## 3. Historias de usuario

- Como **dueño**, quiero que la base de datos no se pause aunque nadie use el sistema por varios días, para encontrar el sistema funcionando cuando vuelvo a abrirlo.
- Como **dueño**, quiero que esa tarea no abra una puerta a terceros, para que nadie pueda usarla para sobrecargar el sistema.

## 4. Requisitos funcionales

- **RF-1.** Existe la ruta `GET /api/cron/keep-alive`. Hace una consulta mínima de lectura a la base (sin leer ni modificar datos de negocio) y responde `200` con `{ "ok": true }` y la hora del servidor.
- **RF-2.** La ruta **exige** el encabezado `Authorization: Bearer <CRON_SECRET>`, que es el que Vercel envía en cada ejecución del cron. Sin él, o con un valor distinto, responde `401` y **no consulta la base**.
- **RF-3.** Si la variable de entorno `CRON_SECRET` no está definida o está vacía, la ruta rechaza **todos** los pedidos (falla cerrada): nunca queda abierta por un olvido de configuración.
- **RF-4.** Si la consulta a la base falla, la ruta responde `500` con un mensaje genérico, sin detalles internos. El error queda en el registro del servidor.
- **RF-5.** La respuesta nunca se guarda en caché: cada ejecución llega a la base.
- **RF-6.** `vercel.json` declara el cron: una ejecución diaria a las 12:00 UTC (09:00 en Tucumán), sobre la ruta del RF-1.
- **RF-7.** `.env.example` documenta `CRON_SECRET`.

## 5. Reglas de negocio

- **Un solo pedido por día alcanza.** El umbral de pausa es de una semana; una ejecución diaria deja un margen amplio incluso si algunas fallan.
- **No toca datos de negocio.** La consulta es de solo lectura y no depende de ninguna tabla.
- **Permisos validados en el servidor** (constitución, regla 14): la ruta no tiene sesión de usuario, su barrera es el secreto compartido.
- **Los secretos no se suben al repositorio** (regla 16): `CRON_SECRET` vive en Vercel y en `.env.local`.
- Sin dinero ni fechas de negocio: no aplican las reglas de la constitución sobre ARS y zona horaria.

## 6. Permisos

No hay roles: la ruta no es para personas. Solo la ejecuta el cron de Vercel (o quien conozca el `CRON_SECRET`, es decir, el dueño del proyecto).

## 7. Casos borde y errores

- **Falta `CRON_SECRET` en Vercel:** todos los pedidos dan `401` (RF-3) y el cron falla visiblemente en el panel de Vercel. Hay que definir la variable y volver a desplegar.
- **Alguien prueba la URL sin el secreto:** `401`, sin consulta a la base.
- **La base ya está pausada cuando corre el cron:** la consulta falla (`500`). Hay que reactivar el proyecto a mano en Supabase; el cron es preventivo y no despierta de forma confiable una base ya pausada.
- **Despliegues de prueba (preview):** Vercel solo ejecuta crons en el despliegue de producción.
- **Plan Hobby de Vercel:** permite un cron por día como máximo y no garantiza el minuto exacto (corre dentro de la hora indicada). Alcanza para esta spec. Ese plan se limita a uso personal no comercial (ver `docs/PROJECT.md`, sección 10).
- **Pedidos concurrentes:** no generan problema, la consulta es de solo lectura.

## 8. Criterios de aceptación

- [x] Con el secreto correcto, `GET /api/cron/keep-alive` responde `200` y la base recibe la consulta. *(En local con un secreto de prueba, y en producción con «Run» desde Vercel, 2026-11-24.)*
- [x] Sin el encabezado, o con un secreto equivocado, responde `401`. *(Probado contra producción, `el-maestro-ecommerce.vercel.app`, 2026-11-24.)*
- [x] Con `CRON_SECRET` sin definir, responde `401` aunque se mande un encabezado. *(En local, sin definir y vacío; prueba unitaria de `isAuthorizedCron`.)*
- [x] Si la base falla, responde `500` sin exponer detalles. *(En local, con la base apuntando a un puerto cerrado: `500 {"ok":false}` y el error solo en el registro del servidor.)*
- [x] `vercel.json` tiene el cron diario y el proyecto sigue compilando. *(Vercel lo muestra activo a las 12:00 UTC.)*
- [x] En Vercel, la ejecución del cron aparece como exitosa (panel del proyecto > Settings > Cron Jobs, o "Run" manual). *(«Run» manual del cliente, 2026-11-24: 200 en los registros. En el plan Hobby los registros duran alrededor de una hora: las ejecuciones de las 12:00 UTC no se ven más tarde.)*
- [x] Hay pruebas unitarias de la validación del secreto (correcto, incorrecto, ausente, secreto vacío, esquema distinto de Bearer). *(`src/lib/cron-auth.test.ts`.)*
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Decisiones

1. **Cron de Vercel** (no GitHub Actions): el sitio ya está en Vercel y no suma otra herramienta.
2. **Consulta `SELECT 1`**: no depende de tablas ni de datos, y cuenta como actividad de la base.
3. **Una vez por día**, 12:00 UTC: es lo máximo que permite el plan Hobby.
4. **Falla cerrada** ante un `CRON_SECRET` ausente (RF-3).

No quedan preguntas abiertas.
