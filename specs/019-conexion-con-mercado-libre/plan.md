# Plan 019 — Conexión con Mercado Libre

> Cómo se construye lo que dice `spec.md`: autorización de la cuenta con renovación automática, recepción de avisos con una tabla que funciona como cola, y una pasada diaria de recuperación. Sin SDK: un cliente propio sobre `fetch` (ver `docs/investigacion/2026-11-10-tecnologias.md`, sección 2).

## 0. Prueba técnica previa

Se hace antes de escribir código, con la cuenta del desarrollador (spec, sección 9, decisión 1). Si algún resultado difiere de lo supuesto, se corrige este plan antes de seguir con las tareas de código.

**Decisión 2026-11-11 (segunda, reemplaza a la anterior del mismo día): se prueba con una cuenta de prueba como vendedora.** El desarrollador creó una cuenta de prueba desde su panel de Mercado Pago; sirve también en Mercado Libre. El reparto queda así:

- **Cuenta personal del desarrollador:** dueña de la aplicación de desarrollo en el portal. No se conecta al sistema ni publica.
- **Cuenta de prueba vendedora:** es la que autoriza la aplicación y queda conectada al sistema.
- **Cuenta de prueba compradora:** hace falta recién en la spec 022. Tiene que ser otra cuenta de prueba: según la documentación de Mercado Libre, las cuentas de prueba solo operan con publicaciones de otras cuentas de prueba, y pagan con tarjetas de prueba. Una cuenta real no puede comprarle a una de prueba.

Al autorizar hay que hacerlo con la sesión de la cuenta de prueba, en una ventana de incógnito: si el navegador tiene abierta la sesión personal, la que autoriza es la cuenta personal.

**Preparación (en el portal de desarrolladores de Mercado Libre):**

1. Crear una aplicación de desarrollo, solo de Mercado Libre, con permisos de lectura y escritura.
2. Cargar como dirección de retorno la del túnel (sección 7).
3. Activar la verificación adicional (PKCE).
4. Dejar sin configurar los temas de avisos por ahora: se activan cuando exista la ruta que los recibe.

**Qué se verifica y qué se anota:**

| N.º | Verificación | Dato que define |
|---|---|---|
| P-1 | Autorizar la aplicación y canjear el código por la autorización. | Vigencia real de la autorización (se espera 6 horas) y forma de la respuesta. |
| P-2 | Renovar la autorización. | Que la renovación entregue una credencial nueva y que la anterior deje de servir. |
| P-3 | Renovar con una credencial ya usada. | Qué error exacto devuelve: es el que el sistema debe tratar como "requiere reconexión". |
| P-4 | Consultar los datos de la cuenta. | Identificador, apodo y sitio de la cuenta, y si ya está en el modelo nuevo de publicación. |
| P-5 | *(Quitada el 2026-11-11: no se usan usuarios de prueba.)* | |
| P-6 | Consultar los avisos perdidos de la aplicación. | Forma de la respuesta y si cada aviso trae un identificador propio. |
| P-7 | Quitar el permiso de la aplicación desde la cuenta de Mercado Libre y volver a consultar. | Qué error devuelve una cuenta que revocó el acceso. |
| P-8 | Quitar el permiso por API. | Si "Desconectar" puede además revocar el acceso del lado de Mercado Libre. |

Los comandos de PowerShell y el lugar para anotar cada resultado están en `prueba-tecnica.md`. Las credenciales se cargan en variables de la sesión de PowerShell; no se pegan en el chat ni se guardan en el repositorio.

La medición de los 500 ms (sección 8, riesgo 1) no entra acá: necesita la ruta desplegada y se hace dentro de las tareas.

**Resultados (2026-11-11).** La prueba se hizo; el detalle está en `prueba-tecnica.md`. Cambios que produjo en este plan:

1. **La aplicación necesita el flujo "Refresh Token" activado.** Sin eso Mercado Libre no entrega credencial de renovación. Se suma como paso al crear la aplicación, también la de producción (sección 7).
2. **Los avisos perdidos se consultan con el permiso propio de la aplicación**, no con la autorización de la cuenta conectada (secciones 3.1 y 3.5).
3. **Errores confirmados:** renovar con un permiso revocado da HTTP 400 con `invalid_grant` (definitivo); consultar da HTTP 401 con "invalid access token" (sección 3.3).
4. **"Desconectar" revoca también del lado de Mercado Libre** (sección 3.6).
5. **La credencial de renovación vieja siguió sirviendo** después de renovar, al revés de lo que dice la documentación. El bloqueo de la sección 3.3 se mantiene igual, por prudencia, pero una renovación simultánea ya no es un riesgo grave (sección 8, riesgo 2).
6. **La cuenta de prueba no está en el modelo nuevo de publicación.** No afecta a esta spec; queda anotado para la 020.

## 1. Modelo de datos

**Tablas nuevas**

`MercadoLibreConnection` → `ml_connections`. Fila única, igual que `Setting` (`id` fijo `"singleton"`): garantiza una sola cuenta conectada (RF-7).

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default("singleton")` | |
| `mlUserId` | `String` | Identificador de la cuenta en Mercado Libre. |
| `nickname` | `String` | Para mostrar (RF-3). |
| `siteId` | `String` | Se espera `MLA`. |
| `accessTokenEnc` | `String` | Cifrado (RF-16). |
| `refreshTokenEnc` | `String` | Cifrado (RF-16). |
| `accessTokenExpiresAt` | `DateTime` | |
| `status` | `MlConnectionStatus` | `CONNECTED` o `NEEDS_RECONNECT`. |
| `statusReason` | `String?` | Motivo cuando requiere reconexión. |
| `connectedAt` | `DateTime` | |
| `connectedByUserId` | `String` | Relación a `User`. |
| `lastRefreshedAt` | `DateTime?` | |
| `lastNotificationAt` | `DateTime?` | RF-3. |
| `lastRecoveryAt` | `DateTime?` | Última pasada de recuperación. |
| `updatedAt` | `DateTime @updatedAt` | |

`MercadoLibreNotification` → `ml_notifications`. Es la cola de avisos.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `dedupeKey` | `String @unique` | El identificador del aviso si viene; si no, un hash de tema, recurso y fecha de envío (RF-12). Se confirma con P-6. |
| `topic` | `String` | Texto libre: llegan temas que el sistema no conoce. |
| `resource` | `String` | |
| `mlUserId` | `String` | |
| `source` | `MlNotificationSource` | `WEBHOOK` o `RECOVERY`. |
| `status` | `MlNotificationStatus` | `PENDING`, `PROCESSED`, `NO_ACTION`, `FAILED`, `DISCARDED`. |
| `attempts` | `Int @default(0)` | Intentos de procesamiento propios. |
| `lastError` | `String?` | RF-14. |
| `sentAt` | `DateTime?` | Fecha que informa Mercado Libre. |
| `receivedAt` | `DateTime @default(now())` | |
| `processedAt` | `DateTime?` | |

Índice por `status` y `receivedAt`. Sin relación a `ml_connections`: un aviso sobrevive a una desconexión como dato histórico.

**Enums nuevos:** `MlConnectionStatus`, `MlNotificationSource`, `MlNotificationStatus`.

**Enums que se amplían** (cada uno en su migración, como `SYSTEM_RESET` en la spec 017):

- `AuditAction`: `ML_CONNECTED`, `ML_DISCONNECTED`.
- `NotificationType`: `ML_RECONEXION`.

**Lo que no se guarda en la base:** el valor de control del retorno y el verificador de PKCE van en una cookie de corta duración (sección 3.2). Las claves de la aplicación van en variables de entorno.

**Reinicio del sistema (spec 017):** `ml_notifications` se suma a las tablas que se vacían. `ml_connections` se conserva, igual que `settings`: es configuración, no datos del negocio. Se anota el cambio en la spec 017.

## 2. Rutas y pantallas

| Ruta | Qué es | Quién accede |
|---|---|---|
| `/configuracion`, pestaña "Mercado Libre" | Estado de la conexión y acciones (RF-1, RF-3). | Permiso "ver" en Configuración. |
| `GET /api/mercadolibre/callback` | Retorno desde Mercado Libre (RF-2). | Sesión con rol Dueño. |
| `POST /api/mercadolibre/notificaciones` | Recepción de avisos (RF-9). | Pública. Su protección es la sección 3.4. |
| `GET /api/cron/mercadolibre` | Pasada diaria (RF-13, RF-14). | Solo con `CRON_SECRET` (`isAuthorizedCron`, spec 018). |

## 3. Lógica de servidor

Todo lo de Mercado Libre vive en `src/lib/mercadolibre/`. La lógica de decisión es pura y con pruebas; lo que toca red o base queda en módulos finos alrededor.

### 3.1 Módulos

| Archivo | Responsabilidad |
|---|---|
| `config.ts` | Lee las variables de entorno. Si falta alguna, todas las acciones fallan con un mensaje claro (falla cerrada). |
| `token-crypto.ts` (pura) | `encryptToken` / `decryptToken` con AES-256-GCM de `node:crypto`. Formato con versión, para poder rotar la clave. |
| `oauth.ts` (pura) | Arma la dirección de autorización, genera el valor de control y el par de PKCE, y compara el valor de control con `timingSafeEqual`. |
| `token-policy.ts` (pura) | `shouldRefresh(expiresAt, now)`: renueva si faltan menos de 5 minutos. `classifyRefreshError(status, body)`: definitivo o transitorio. |
| `tokens.ts` | `getValidAccessToken()`: única puerta para obtener la autorización de la cuenta conectada (sección 3.3). `getAppAccessToken()`: permiso propio de la aplicación, sin usuario, para lo que solo puede hacer la dueña de la aplicación; se pide cada vez que hace falta y no se guarda. |
| `client.ts` | `mlFetch(path, init)`: agrega la autorización, valida la respuesta con `zod` y traduce errores a `MlUnavailableError`, `MlRateLimitError` y `MlReconnectRequiredError`. |
| `inbox.ts` | `parseNotification` y `dedupeKey` (puras); `acceptNotification` (guarda); `processPending` (procesa). |
| `handlers.ts` | Registro `tema → función`. **Vacío en esta spec** (RF-15); las specs 020 a 022 agregan los suyos. |
| `recovery.ts` | Consulta los avisos perdidos y los incorpora (RF-13). |

### 3.2 Conectar (RF-2, RF-7, RF-8)

**Server Action `startMercadoLibreConnection`:**

1. `requireOwner`.
2. Genera el valor de control y el par de PKCE. Los guarda en una cookie `httpOnly`, `secure`, `sameSite=lax`, de 10 minutos.
3. `redirect` a la dirección de autorización de Mercado Libre.

**Route Handler `GET /api/mercadolibre/callback`:**

1. Sin sesión de Dueño: redirige a `/configuracion` con error. No procesa nada.
2. Si Mercado Libre informa que el usuario no autorizó: redirige con el mensaje de la spec (sección 7).
3. Compara el valor de control con el de la cookie. Si falta o no coincide, rechaza. Borra la cookie en todos los casos (un retorno no se puede reutilizar).
4. Canjea el código por la autorización, con el verificador de PKCE.
5. Consulta los datos de la cuenta.
6. Si ya hay una conexión de **otra** cuenta: no guarda nada y redirige con "Autorizaste una cuenta distinta. Para cambiar de cuenta, desconectá primero la actual." (RF-7, RF-8).
7. En una transacción: crea o actualiza la fila con la autorización cifrada y `status = CONNECTED`, registra `ML_CONNECTED` en la auditoría y marca como leídos los avisos `ML_RECONEXION` abiertos.
8. Redirige a `/configuracion` con el resultado.

### 3.3 Renovación (RF-4, RF-5)

`getValidAccessToken()`:

1. Lee la fila. Sin fila, o con `NEEDS_RECONNECT`: lanza `MlReconnectRequiredError`.
2. Si `shouldRefresh` es falso: descifra y devuelve.
3. Si hay que renovar, abre una transacción y toma la fila con `SELECT … FOR UPDATE`.
4. Ya con el bloqueo, **vuelve a leer**. Si otro proceso renovó mientras esperaba, usa ese resultado y no llama a Mercado Libre.
5. Si no, pide la renovación, guarda la autorización y la credencial nuevas y `lastRefreshedAt`.
6. Si la renovación falla:
   - **Definitivo** (HTTP 400 con `invalid_grant`, confirmado en P-8): `status = NEEDS_RECONNECT`, motivo, y un aviso `ML_RECONEXION` en la campanita. Lanza `MlReconnectRequiredError`.
   - **Transitorio** (red, error del servidor, límite de consultas): no toca el estado. Lanza `MlUnavailableError`.

El bloqueo es por fila y dentro de una transacción porque la aplicación se conecta por el pooler de Supabase en modo transacción, donde los bloqueos de sesión no sirven.

Además, `mlFetch` reintenta una vez con renovación forzada si Mercado Libre responde HTTP 401 ("invalid access token"). Es el camino por el que se detecta un permiso revocado antes de que venza la autorización: la renovación forzada da `invalid_grant` y la conexión pasa a requerir reconexión.

### 3.4 Recepción de avisos (RF-9 a RF-12, RF-15)

`POST /api/mercadolibre/notificaciones`, con `dynamic = "force-dynamic"`:

1. Lee el cuerpo y lo valida con `parseNotification`. Si no tiene la forma de un aviso: responde `200` y no guarda nada.
2. Si el identificador de aplicación del aviso no es el nuestro: responde `200` y no guarda nada (RF-11). Es una comparación en memoria.
3. Guarda el aviso como `PENDING` con una sola escritura que ignora duplicados (`dedupeKey` único, RF-12).
4. Programa el procesamiento con `after` y responde `200`.
5. Si la escritura falla: responde `500`, para que Mercado Libre reintente.

En el camino de la respuesta hay una sola operación de base. La comparación con la cuenta conectada necesita leer la base, así que va en el procesamiento.

`processPending`, para cada aviso `PENDING` o `FAILED` con menos de 5 intentos:

1. Sin conexión, o de otra cuenta: `DISCARDED` (RF-11).
2. Busca la función del tema en `handlers.ts`. Si no hay: `NO_ACTION` (RF-15 y temas desconocidos).
3. Si hay: la ejecuta. La función consulta a Mercado Libre el recurso; nunca usa el aviso como dato (RF-10). Bien: `PROCESSED`. Error: `FAILED` con `lastError` y suma un intento (RF-14).
4. `MlRateLimitError` o `MlUnavailableError`: queda `PENDING` sin sumar intento, para la próxima pasada.

Actualiza `lastNotificationAt` de la conexión.

### 3.5 Pasada diaria y botón manual (RF-13, RF-14)

`GET /api/cron/mercadolibre`, protegida con `isAuthorizedCron`:

1. Sin conexión: responde bien y no hace nada.
2. `getValidAccessToken()`. Esto además mantiene viva la credencial de renovación aunque nadie use el sistema.
3. `recovery`: pide el permiso propio de la aplicación (`getAppAccessToken()`), trae los avisos perdidos, descarta los que no son de la cuenta conectada y guarda el resto con `source = RECOVERY`, ignorando duplicados. Una respuesta sin avisos llega como `{"messages":null}`.
4. `processPending`.
5. Borra los avisos con más de 30 días.
6. Guarda `lastRecoveryAt` y responde un resumen.

**Server Action `fetchMissedNotifications`** ("Buscar avisos pendientes"): `requirePermission(CONFIGURACION, "editar")` y ejecuta los pasos 2 a 4. Devuelve cuántos encontró y cuántos procesó.

`vercel.json`: se agrega la tarea diaria de esta ruta. Si el plan gratuito admite varias tareas diarias (ver sección 8, riesgo 5), se programa a cuatro horas distintas del día.

### 3.6 Desconectar (RF-6)

**Server Action `disconnectMercadoLibre`:** `requireOwner`. Revoca el acceso del lado de Mercado Libre (confirmado en P-8); si esa llamada falla, sigue igual con el resto. En una transacción: borra la fila de conexión, pasa los avisos `PENDING` y `FAILED` a `DISCARDED` y registra `ML_DISCONNECTED` en la auditoría.

## 4. Componentes

- **`mercadolibre-tab.tsx`**, pestaña nueva en `settings-form.tsx`:
  - Sin conexión: explicación y botón "Conectar con Mercado Libre".
  - Conectada: apodo de la cuenta, fecha de conexión, estado, último aviso recibido, y cantidad de avisos pendientes y fallidos.
  - Requiere reconexión: motivo y botón "Volver a conectar".
  - "Desconectar", con confirmación en una ventana modal.
  - "Buscar avisos pendientes", con el resultado en un mensaje.
  - El resultado del retorno desde Mercado Libre se muestra con `sonner`.
- **`page.tsx` de Configuración:** hoy solo muestra el formulario a quien puede editar. La pestaña "Mercado Libre" tiene que verse con permiso "ver" (spec, sección 6), con los botones según el permiso de cada uno.
- **`notifications-bell.tsx` y `notifications-data.ts`:** tipo `ML_RECONEXION`, visible con permiso "ver" en Configuración, con enlace a la pestaña.
- **`.env.example`:** variables nuevas, sin valores (RF-17).

## 5. Permisos

| Acción | Verificación | Dónde |
|---|---|---|
| Ver la pestaña | `hasPermission(CONFIGURACION, "ver")` | `page.tsx` |
| Conectar, reconectar | `requireOwner` | `startMercadoLibreConnection` y el retorno |
| Desconectar | `requireOwner` | `disconnectMercadoLibre` |
| Buscar avisos pendientes | `requirePermission(CONFIGURACION, "editar")` | `fetchMissedNotifications` |
| Ver y marcar el aviso de reconexión | `hasPermission(CONFIGURACION, "ver")` | `notifications-data.ts` |
| Recibir avisos | Sin sesión; secciones 3.4 y RF-10 | Route Handler |
| Pasada diaria | `isAuthorizedCron` | Route Handler |

Ninguna respuesta al navegador incluye la autorización ni las claves (RF-16).

## 6. Pruebas

**Unitarias (Vitest):**

- `token-crypto`: ida y vuelta; texto alterado; clave equivocada; dos cifrados del mismo texto dan resultados distintos.
- `oauth`: dirección de autorización completa; valor de control correcto, incorrecto y ausente; desafío de PKCE.
- `token-policy`: `shouldRefresh` en los bordes de los 5 minutos; `classifyRefreshError` para los errores de P-3 y P-7, error de servidor, límite de consultas y falla de red.
- `inbox`: aviso válido; sin campos; de otra aplicación; `dedupeKey` estable para el mismo aviso y distinta para otro.
- Decisión de procesamiento: sin conexión, otra cuenta, tema sin función, función que falla, límite de consultas.
- Renovación simultánea, con una transacción simulada: el segundo que entra ve la autorización ya renovada y no llama a Mercado Libre.

**Manuales, con el usuario de prueba** (se documentan en `tasks.md`):

- Conectar, ver el estado, desconectar.
- Forzar el vencimiento (cambiando la fecha en la base de pruebas) y ver que se renueva sola.
- Revocar desde Mercado Libre y ver "requiere reconexión" y el aviso.
- Conectar con otra cuenta mientras hay una conectada.
- Un usuario que no es Dueño, desde la interfaz y llamando directo al servidor.
- Un aviso real (pausar y reactivar una publicación de prueba) y el mismo aviso reenviado dos veces.
- Avisos perdidos: con la ruta respondiendo error un rato, y después "Buscar avisos pendientes".
- Revisar en la base que la autorización está cifrada.

**E2E:** pendiente para la pasada de endurecimiento.

## 7. Entornos y configuración

**Variables de entorno nuevas:**

| Variable | Contenido |
|---|---|
| `ML_CLIENT_ID` | Identificador de la aplicación. |
| `ML_CLIENT_SECRET` | Clave secreta de la aplicación. |
| `ML_REDIRECT_URI` | Dirección de retorno, igual a la cargada en Mercado Libre. |
| `ML_TOKEN_ENCRYPTION_KEY` | 32 bytes en base64, para cifrar la autorización. |

**Entorno de desarrollo (decisión 2026-11-11).** Mercado Libre exige una dirección pública con https, tanto para el retorno como para los avisos, y los avisos van a **una sola dirección por aplicación**. La aplicación de desarrollo no puede apuntar al sitio que usa el cliente: sus avisos y conexiones de prueba caerían en la base real. Se resuelve todo en la máquina del desarrollador:

- **Base, autenticación y almacenamiento:** un proyecto de Supabase local con Docker, en `C:\Users\boschi albano jose\Desktop\supabase\supabase-el-maestro`, levantado con la CLI de Supabase (ya instalada).
- **Variables:** en `.env.development.local`, que `next dev` carga con prioridad sobre `.env.local` y `.env`, y que el despliegue ignora. Ya está cubierto por `.gitignore`. Los archivos `.env` y `.env.local` existentes no se tocan.
- **Comandos que no pasan por Next** (migraciones, semilla, bucket): leen `.env` por su cuenta. Se corren con las variables locales cargadas antes en la sesión, verificando que la base apunte a `127.0.0.1` antes de ejecutar.
- **Dirección pública:** `ngrok` (ya instalado) sobre el puerto de `next dev`, con un **dominio fijo** de ngrok, para no tener que cambiar la dirección de retorno y la de avisos en Mercado Libre cada vez que se reinicia el túnel.

**Paso a producción.** Aplicación nueva en la cuenta del cliente, sus cuatro variables en Vercel, y el cliente conecta su cuenta. Nada se migra. Al crear esa aplicación:

- Activar el flujo "Refresh Token" y PKCE.
- Pedir solo los permisos que el sistema usa: publicación y sincronización, venta y envíos, y facturación. La de desarrollo pide además mensajes, publicidad y promociones, que están fuera de alcance.
- Marcar solo los temas de avisos que tengan una función que los procese.

En producción la cuenta dueña de la aplicación y la cuenta conectada son la misma (la del cliente). En desarrollo son distintas; por eso los avisos perdidos se piden con el permiso propio de la aplicación, que funciona en los dos casos.

## 8. Riesgos y decisiones

1. **Responder en 500 ms.** Es el mayor riesgo. El primer pedido después de un rato sin uso incluye el arranque de la función y la conexión a la base. Mitigación: la ruta no carga nada de sesión ni de interfaz, hace una sola escritura, y Vercel y Supabase están los dos en São Paulo. **Con el entorno local no se puede medir:** el tiempo por el túnel hasta la máquina del desarrollador no representa a Vercel. La medición real queda como tarea previa a la salida a producción. Si no alcanza, el plan B es responder primero y guardar dentro de `after`, aceptando que un aviso se puede perder si la función muere; lo cubren los controles propios de las specs 021 y 022.
2. **Llamada a Mercado Libre dentro de una transacción** (sección 3.3). Mantiene una conexión de base ocupada mientras dura la renovación, unos 600 ms según la prueba técnica. Se acepta: es la forma simple de garantizar una sola renovación a la vez. Tiempo máximo de la transacción: 15 segundos. La prueba técnica mostró que una credencial de renovación ya usada siguió sirviendo, así que una renovación simultánea no rompería la conexión; el bloqueo se mantiene porque la documentación dice lo contrario y ese comportamiento puede cambiar.
3. **El identificador de la aplicación no es secreto.** Cualquiera que lo conozca puede mandar avisos falsos. No pueden causar daño (RF-10), pero sí llenar la tabla. Mitigación: borrado a los 30 días, y un filtro opcional por las direcciones de red que publica Mercado Libre.
4. **RF-8 simplificado.** La spec decía "advierte y pide confirmación antes de reemplazar". Confirmar después del retorno obligaba a guardar una autorización a medio aceptar. Queda: si la cuenta es otra, no se reemplaza y se pide desconectar primero. Se corrige la spec.
5. **Cantidad de tareas programadas.** La spec 018 anotó una tarea por día; una página de Vercel indica hasta 100 por proyecto, cada una diaria. Se verifica al desplegar. Si solo se admite una, la recuperación de avisos se llama desde la ruta de la spec 018.
6. **Valor de control en cookie y no en la base.** Evita una tabla más. La cookie es `httpOnly` y `sameSite=lax`, que el navegador sí envía al volver desde Mercado Libre.
7. **Sin SDK.** El oficial está abandonado. Son cuatro llamadas en esta spec.
8. **Credencial de renovación que vence por falta de uso.** La pasada diaria renueva aunque nadie use el sistema.
9. **Next.js de esta versión tiene cambios.** Antes de escribir cada pieza se lee su guía en `node_modules/next/dist/docs/`: Route Handlers (incluye una sección de webhooks), `after`, cookies y `redirect` en Server Actions. `after` ya se revisó.

10. **Límites de las cuentas de prueba** (decisión 2026-11-11). Según la documentación de Mercado Libre:
    - Las publicaciones de prueba se titulan "Item de Prueba - Por favor, NO OFERTAR", van de preferencia en la categoría "Otros" y no en los tipos de mayor exposición. Eso limita lo que se puede probar de la spec 020 sobre categorías reales y sus características.
    - Las cuentas de prueba se eliminan tras 60 días sin actividad, y sus publicaciones se borran periódicamente. Usuario y contraseña no se pueden volver a consultar.
    - Si Mercado Libre pide un código de verificación por email, es igual a los últimos 4 o 6 dígitos del identificador de la cuenta.
    - Habilitar una cuenta de prueba para el modelo nuevo de publicación se pide por un formulario y **tarda dos semanas**, sin aviso (ver `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, sección 1.4). La verificación P-4 muestra si la cuenta ya lo tiene; no la tenía el 2026-11-11, así que conviene pedirlo enseguida para no frenar la spec 020.

## 9. Preguntas abiertas

Ninguna. La del entorno de pruebas se resolvió el 2026-11-11 (sección 7).
