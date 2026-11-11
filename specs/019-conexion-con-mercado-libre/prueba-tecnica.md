# Prueba técnica 019 — comandos y resultados

> Tareas T-002 y T-003. Se corre en **PowerShell**, en una sola ventana, de arriba hacia abajo. Las claves quedan en variables de esa ventana: no se guardan en ningún archivo ni se pegan en el chat. Lo único que hay que anotar son los resultados que pide cada paso.
>
> **Cuentas:** la aplicación de desarrollo se crea con la **cuenta personal**; la que autoriza y queda conectada es la **cuenta de prueba vendedora**. Ningún paso publica ni modifica publicaciones.
>
> **Importante:** antes de cada `New-MlAuthorization`, copiar la dirección que se abre y pegarla en una **ventana de incógnito**, e iniciar sesión ahí con la cuenta de prueba. Si se autoriza con la sesión personal abierta, la que queda conectada es la cuenta personal. Si Mercado Libre pide un código de verificación por email, son los últimos 4 o 6 dígitos del identificador de la cuenta de prueba.

## Resultados (2026-11-11)

La prueba se corrió con la cuenta de prueba `TESTUSER1794626107` sobre la aplicación "El Maestro Desarrollo". Los comandos de más abajo quedan como referencia para repetirla; los casilleros de cada paso no se completaron porque los resultados están acá.

| Paso | Resultado | Coincide con lo supuesto |
|---|---|---|
| P-1 Autorizar y canjear | Funciona con PKCE. La autorización dura **21600 segundos (6 horas)**. El canje tarda unos 600 ms. | Sí |
| P-1, primer intento | **No vino credencial de renovación.** La aplicación recién creada solo tenía los flujos "código de autorización" y "credenciales de la aplicación". Hubo que activar el flujo **"Refresh Token"** en la aplicación y volver a autorizar. | **No.** Paso nuevo al crear la aplicación. |
| P-2 Renovar | Entrega una autorización nueva y una credencial de renovación nueva. | Sí |
| P-3 Reusar la credencial vieja | **Siguió sirviendo**, incluso por tercera vez, y cada uso entregó un par nuevo. Las autorizaciones anteriores también siguieron sirviendo hasta su propio vencimiento. | **No.** La documentación dice que es de un solo uso. No se probó si deja de servir pasado un tiempo. |
| P-4 Datos de la cuenta | Sitio `MLA`, habilitada para publicar. Etiquetas: `test_user`, `normal`. **No tiene `user_product_seller`**: no está en el modelo nuevo de publicación. | Dato nuevo, para la spec 020. |
| P-6 Avisos perdidos | Con la autorización de la cuenta conectada: **HTTP 401, "You must be the owner of the app"**. Con el permiso propio de la aplicación (credenciales de la aplicación, sin usuario): HTTP 200. Sin avisos, la respuesta es `{"messages":null}`. | **No.** Cambia cómo se recuperan los avisos. |
| P-7 Revocar desde la web | No se hizo. Se verifica con el sistema ya armado (tarea T-017). | Pendiente |
| P-8 Revocar por la API | Funciona: HTTP 200, "Autorización eliminada". Después, **renovar da HTTP 400 con `invalid_grant`**, y las consultas dan **HTTP 401 con "invalid access token"** tras unos segundos de demora. | Sí |

Otros datos que salieron:

- Límite de la aplicación: 18.000 consultas por hora.
- El permiso propio de la aplicación también dura 6 horas, no trae credencial de renovación (se pide de nuevo) y actúa en nombre de la cuenta dueña de la aplicación.
- En el formulario de la aplicación, marcar el tema "Items" activa cinco temas: publicaciones, preguntas, cotizaciones, precios y ubicaciones de stock.
- La aplicación pide más permisos de los necesarios (mensajes, publicidad, promociones). Para la de producción alcanzan: publicación y sincronización, venta y envíos, y facturación.
- No se pudo ver un aviso perdido real, así que sigue sin confirmarse si cada aviso trae un identificador propio.

La cuenta de prueba quedó sin autorizar la aplicación. Se vuelve a conectar desde el sistema en la tarea T-008.

## Antes de empezar (T-002)

1. **Dominio fijo de ngrok.** En el panel de ngrok, sección de dominios, reservar el dominio gratuito. Anotarlo: `https://unpersonalizing-backboned-cherry.ngrok-free.dev`
2. **Aplicación de desarrollo.** En el portal de desarrolladores de Mercado Libre, "Crear nueva aplicación":
   - Nombre: por ejemplo "El Maestro (desarrollo)".
   - Dirección de retorno: `https://unpersonalizing-backboned-cherry.ngrok-free.dev/api/mercadolibre/callback`
   - Verificación adicional (PKCE): activada.
   - Flujos de autorización: marcar también **"Refresh Token"**. Sin eso la conexión se cae a las 6 horas (ver Resultados).
   - Permisos: lectura y escritura.
   - Dirección de avisos (el formulario la exige): `https://unpersonalizing-backboned-cherry.ngrok-free.dev/api/mercadolibre/notificaciones`
   - Temas de avisos: **no marcar ninguno por ahora**. Se activan cuando exista la ruta que los recibe (tarea T-011). Si el formulario obliga a marcar alguno, marcar solo "Items".
3. Copiar el identificador y la clave secreta de la aplicación en `ML_CLIENT_ID` y `ML_CLIENT_SECRET` de `.env.development.local`, y la dirección de retorno en `ML_REDIRECT_URI`.

No hace falta tener el túnel ni el sistema levantados para esta prueba: al volver de Mercado Libre el navegador va a mostrar un error, pero la dirección trae el código que se necesita.

## Preparación de la ventana

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ClientId     = Read-Host "ML_CLIENT_ID"
$ClientSecret = Read-Host "ML_CLIENT_SECRET"
$RedirectUri  = Read-Host "ML_REDIRECT_URI (la misma que cargaste en Mercado Libre)"
$TokenUrl     = "https://api.mercadolibre.com/oauth/token"

function Show-MlError($e) {
  "HTTP " + [int]$e.Exception.Response.StatusCode
  if ($e.ErrorDetails.Message) { $e.ErrorDetails.Message }
  else { (New-Object IO.StreamReader($e.Exception.Response.GetResponseStream())).ReadToEnd() }
}

function New-MlAuthorization {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $script:Verifier = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  $hash = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($script:Verifier))
  $challenge = [Convert]::ToBase64String($hash).TrimEnd('=').Replace('+','-').Replace('/','_')
  $script:State = [guid]::NewGuid().ToString("N")
  $url = "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$ClientId" +
         "&redirect_uri=$([uri]::EscapeDataString($RedirectUri))&state=$($script:State)" +
         "&code_challenge=$challenge&code_challenge_method=S256"
  Set-Clipboard $url
  "La dirección de autorización quedó copiada. Pegala en una ventana de incógnito e iniciá sesión con la cuenta de prueba."
  "Valor de control esperado (state): $($script:State)"
}

function Get-MlToken($code) {
  Invoke-RestMethod -Method Post -Uri $TokenUrl -ContentType "application/x-www-form-urlencoded" -Body @{
    grant_type = "authorization_code"; client_id = $ClientId; client_secret = $ClientSecret
    code = $code; redirect_uri = $RedirectUri; code_verifier = $script:Verifier
  }
}

function Update-MlToken($refreshToken) {
  Invoke-RestMethod -Method Post -Uri $TokenUrl -ContentType "application/x-www-form-urlencoded" -Body @{
    grant_type = "refresh_token"; client_id = $ClientId; client_secret = $ClientSecret
    refresh_token = $refreshToken
  }
}
```

## P-1 — Autorizar y canjear el código

```powershell
New-MlAuthorization
```

Pegar la dirección en una ventana de incógnito, iniciar sesión con la cuenta de prueba y autorizar la aplicación. Al volver, la dirección tiene la forma `…/api/mercadolibre/callback?code=TG-…&state=…`. Verificar que `state` coincide con el valor de control y copiar el valor de `code`.

```powershell
$Code = Read-Host "Pegá el valor de code"
$T1 = Get-MlToken $Code
$T1 | Select-Object token_type, expires_in, scope, user_id
```

- [ ] `state` coincide: sí / no
- [ ] `expires_in` (segundos): \***\*\_\_\*\*** (se espera 21600, que son 6 horas)
- [ ] `scope`: ****\*\*****\_\_****\*\*****

## P-2 — Renovar

```powershell
$T2 = Update-MlToken $T1.refresh_token
$T2 | Select-Object expires_in, user_id
"La credencial de renovación cambió: " + ($T1.refresh_token -ne $T2.refresh_token)
"La autorización cambió: " + ($T1.access_token -ne $T2.access_token)
```

- [ ] La credencial de renovación cambió: sí / no
- [ ] La autorización cambió: sí / no

## P-3 — Renovar con una credencial ya usada

```powershell
try { Update-MlToken $T1.refresh_token | Out-Null; "NO dio error: la credencial vieja sigue sirviendo" } catch { Show-MlError $_ }
```

- [ ] Resultado (código HTTP y texto del error): ****\*\*****\_\_****\*\*****

Si no dio error, puede que haya entregado otra credencial nueva. En ese caso, para seguir: `$T2 = Update-MlToken $T2.refresh_token`.

## P-4 — Datos de la cuenta

```powershell
$H = @{ Authorization = "Bearer $($T2.access_token)" }
$Me = Invoke-RestMethod -Uri "https://api.mercadolibre.com/users/me" -Headers $H
$Me | Select-Object id, nickname, site_id, @{ n = "tags"; e = { $_.tags -join ", " } }
```

- [ ] ¿El `nickname` es el de la cuenta de prueba (suele empezar con TEST o TETE)? sí / no. Si es el de la cuenta personal, se autorizó con la sesión equivocada: repetir P-1 en incógnito.
- [ ] `site_id`: \***\*\_\_\*\*** (se espera MLA)
- [ ] ¿`tags` incluye `user_product_seller`? sí / no (indica si la cuenta ya publica con el modelo nuevo; importa para la spec 020)

## P-6 — Avisos perdidos

```powershell
try {
  Invoke-RestMethod -Uri "https://api.mercadolibre.com/missed_feeds?app_id=$ClientId" -Headers $H | ConvertTo-Json -Depth 6
} catch { Show-MlError $_ }
```

Sin temas configurados lo esperable es una lista vacía. Sirve para ver la forma de la respuesta.

- [ ] Resultado (pegar la respuesta, sin datos personales): ****\*\*****\_\_****\*\*****

## P-7 — Revocar desde la cuenta de Mercado Libre

En la web de Mercado Libre, con la sesión de la **cuenta de prueba**, entrar a la configuración de la cuenta, sección de seguridad, aplicaciones conectadas, y quitar el permiso de la aplicación de desarrollo. Después:

```powershell
"--- Consulta con la autorización vigente:"
try { Invoke-RestMethod -Uri "https://api.mercadolibre.com/users/me" -Headers $H | Select-Object id; "NO dio error" } catch { Show-MlError $_ }
"--- Renovación:"
try { Update-MlToken $T2.refresh_token | Out-Null; "NO dio error" } catch { Show-MlError $_ }
```

- [ ] Consulta (código HTTP y error): ****\*\*****\_\_****\*\*****
- [ ] Renovación (código HTTP y error): ****\*\*****\_\_****\*\*****

Este es el error que el sistema va a tratar como "requiere reconexión". Comparar con el de P-3: ¿es el mismo?

- [ ] ¿Mismo error que P-3? sí / no

## P-8 — Revocar por la API

Primero hay que volver a autorizar:

```powershell
New-MlAuthorization
$Code = Read-Host "Pegá el valor de code"
$T3 = Get-MlToken $Code
$H3 = @{ Authorization = "Bearer $($T3.access_token)" }

try {
  Invoke-RestMethod -Method Delete -Uri "https://api.mercadolibre.com/users/$($Me.id)/applications/$ClientId" -Headers $H3 | ConvertTo-Json -Depth 4
} catch { Show-MlError $_ }

"--- Renovación después de revocar por API:"
try { Update-MlToken $T3.refresh_token | Out-Null; "NO dio error" } catch { Show-MlError $_ }
```

- [ ] Respuesta de la revocación: ****\*\*****\_\_****\*\*****
- [ ] Renovación posterior (código HTTP y error): ****\*\*****\_\_****\*\*****

## Al terminar

```powershell
Remove-Variable ClientSecret, T1, T2, T3, H, H3, Code -ErrorAction SilentlyContinue
```

La cuenta queda sin autorizar la aplicación. Se vuelve a conectar más adelante, ya desde el sistema (tarea T-008).

## Qué define cada resultado

| Resultado          | Qué decide en el código                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `expires_in` (P-1) | Cada cuánto renovar. El plan asume 6 horas y renovar cuando faltan 5 minutos.                  |
| P-2                | Si hay que guardar la credencial de renovación nueva en cada renovación. El plan asume que sí. |
| P-3 y P-7          | Qué error marca la conexión como "requiere reconexión" (`classifyRefreshError`).               |
| P-4                | Qué datos de la cuenta se muestran, y cómo se publica en la spec 020.                          |
| P-6                | Si los avisos traen un identificador propio para no duplicarlos (`dedupeKey`).                 |
| P-8                | Si "Desconectar" además revoca el acceso del lado de Mercado Libre.                            |
