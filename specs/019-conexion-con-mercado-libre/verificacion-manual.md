# Verificación manual 019 — pasos en pantalla

> **Estado (2026-11-11):** verificados C1, C2, D1 y D2 por el desarrollador (desconectar con confirmación, cancelar en Mercado Libre y volver a conectar). La base confirma lo que no se ve en pantalla: tres conexiones y dos desconexiones en la auditoría, la desconexión revocó el permiso en Mercado Libre las dos veces, y quedó una sola cuenta conectada con la autorización cifrada y vigente. **Pendientes:** A, B, C3, C4, E1, E2 (botón) y F.
>
> **E por API (2026-11-11):** se revocó el permiso de la cuenta conectada por la API de Mercado Libre y se esperó a que rechazara la autorización guardada (tardó unos minutos). La pasada diaria detectó la revocación sola: la conexión pasó a `NEEDS_RECONNECT` con su motivo, se creó **un** aviso `ML_RECONEXION` (una segunda pasada no lo duplicó) y la ruta respondió 500 con `MlReconnectRequiredError` en el registro. En pantalla, el desarrollador verificó el mensaje de «Requiere reconexión», el aviso de la campanita y la reconexión (E3 a E5): al volver a conectar el aviso desapareció, y la base lo confirma (conexión `CONNECTED` con la autorización cifrada, aviso marcado como leído, auditoría con `reconexion: true` y una sola cuenta conectada). Falta revocar desde la web de Mercado Libre (E1).

> Tarea T-017. Se hace en **una ventana de incógnito**, entrando por `https://unpersonalizing-backboned-cherry.ngrok-free.dev` (con el túnel y `pnpm dev` levantados) con el usuario `dueno`. Tildar cada casilla y anotar lo que no coincida.
>
> Lo ya comprobado sin pantalla está en `tasks.md` (T-004 a T-012): conexión guardada con la autorización cifrada, renovación automática al vencer, ruta de avisos, pasada diaria y reinicio del sistema.

## A. Estados de la pestaña

- [ ] **A1. Conectada.** Configuración > Mercado Libre muestra la cuenta `TESTUSER1794626107`, el estado "Conectada", desde cuándo, "Último aviso recibido" y "Avisos por procesar".
- [ ] **A2. Botón de avisos.** Tocar "Buscar avisos pendientes" muestra un mensaje del estilo "0 aviso(s) nuevo(s) recuperado(s), 0 procesado(s)". No debe dar error.

## B. Retornos que no valen (RF-2)

Con la sesión del Dueño iniciada:

- [ ] **B1. Retorno inventado.** Abrir `https://unpersonalizing-backboned-cherry.ngrok-free.dev/api/mercadolibre/callback?code=TG-falso&state=falso`. Tiene que volver a la pestaña con el mensaje "El retorno desde Mercado Libre no es válido o ya se usó…". La cuenta conectada no cambia.
- [ ] **B2. Retorno repetido.** Pegar de nuevo la dirección completa a la que volvió Mercado Libre la primera vez (la del `code=TG-6af4cc2f…`). Mismo mensaje.
- [ ] **B3. Sin sesión.** En otra ventana de incógnito, sin iniciar sesión, abrir la dirección de B1. Tiene que llevar al login o a la pantalla con el mensaje "Solo el Dueño puede conectar…". Nunca conectar nada.

## C. Desconectar (RF-6)

- [x] **C1.** Tocar "Desconectar". Aparece la confirmación con el nombre de la cuenta.
- [x] **C2.** Confirmar. La pestaña pasa a "No hay ninguna cuenta de Mercado Libre conectada" con el botón "Conectar con Mercado Libre", y dice que quedó desconectada.
- [ ] **C3.** En Mercado Libre, con la cuenta de prueba, la aplicación ya no figura entre las conectadas.
- [ ] **C4.** Auditoría (Configuración > Auditoría): figura la desconexión con el usuario.

## D. Conectar de nuevo y cancelar (RF-2)

- [x] **D1. Cancelar.** Tocar "Conectar con Mercado Libre", y en Mercado Libre tocar "Por ahora no". Vuelve con "No se autorizó la conexión. Podés intentarlo de nuevo." y sigue sin cuenta conectada.
- [x] **D2. Conectar.** Repetir y esta vez autorizar con la cuenta de prueba. Vuelve conectada.

## E. Permiso revocado desde Mercado Libre (RF-5 y P-7 de la prueba técnica)

- [ ] **E1.** En la web de Mercado Libre, con la sesión de la **cuenta de prueba**, quitar el permiso de "El Maestro Desarrollo" (Mi cuenta > Seguridad > Aplicaciones conectadas).
- [ ] **E2.** Esperar un minuto y, en el sistema, tocar "Buscar avisos pendientes".
- [x] **E3.** Tiene que decir "Hay que volver a conectar la cuenta de Mercado Libre". Al recargar, el estado es **"Requiere reconexión"**, con el motivo y el botón "Volver a conectar".
- [x] **E4.** La campanita muestra un aviso "Se perdió la conexión con Mercado Libre…" que lleva a la pestaña.
- [x] **E5.** Tocar "Volver a conectar" y autorizar. Vuelve a "Conectada", el aviso de la campanita desaparece, y en la auditoría la conexión figura como reconexión.
- [ ] **Anotar:** el error exacto que dio Mercado Libre al revocar desde la web, si apareció algo en el registro del servidor. Sirve para confirmar que es el mismo que al revocar por la API (`invalid_grant`).

## F. Permisos

- [ ] **F1.** Crear (Usuarios) un usuario con un rol que **no** sea Dueño y que tenga permiso "ver" en Configuración, pero no "editar". Entrar con él: ve la pestaña "Mercado Libre", ve el estado, **no** ve "Conectar", "Desconectar" ni "Buscar avisos pendientes".
- [ ] **F2.** Con un rol con permiso "editar" en Configuración (sin ser Dueño): ve "Buscar avisos pendientes", pero no "Conectar" ni "Desconectar".
- [ ] **F3.** Con un rol sin acceso a Configuración: la campanita no muestra el aviso de reconexión.
