# Spec 019 — Conexión con Mercado Libre

| | |
|---|---|
| **Estado** | Verificada (2026-11-11), con dos puntos pendientes de despliegue (ver sección 8) |
| **Depende de** | 002, 003, 013 |
| **Referencia** | `docs/PROJECT.md`, sección 4 ("Ampliación de alcance") |

## 1. Objetivo

Vincular la cuenta de Mercado Libre del negocio con el sistema y dejar esa conexión funcionando sola: que no se caiga sin que alguien se entere y que el sistema reciba los avisos que Mercado Libre manda cuando pasa algo en la cuenta (una venta, un cambio en una publicación).

Esta spec no publica productos, no mueve stock y no trae órdenes. Es la base sobre la que se apoyan las specs 020 (publicación), 021 (stock), 022 (órdenes) y 024 (factura de órdenes).

## 2. Alcance

**Incluye:**

- Una sección "Mercado Libre" dentro de Configuración para conectar la cuenta, ver el estado de la conexión y desconectarla.
- Renovación automática de la autorización, sin que nadie tenga que volver a entrar a Mercado Libre.
- Recepción y registro de los avisos que manda Mercado Libre, y recuperación de los que se hayan perdido.
- Aviso en la campanita (spec 013) cuando la conexión se cae y hay que volver a conectar.
- Registro en la auditoría (spec 003) de cada conexión y desconexión.

**No incluye:**

- Publicar productos, sincronizar stock, traer órdenes ni facturar (specs 020 a 024).
- Más de una cuenta de Mercado Libre conectada a la vez.
- Preguntas, mensajes, reclamos, publicidad y el resto de lo listado en "Fuera de alcance" de `docs/PROJECT.md`.
- Mercado Pago como medio de cobro.

## 3. Historias de usuario

- Como **dueño**, quiero conectar la cuenta de Mercado Libre del negocio desde Configuración, para que el sistema pueda trabajar con ella.
- Como **dueño**, quiero ver si la conexión está funcionando y con qué cuenta, para no descubrir un problema recién cuando falla una venta.
- Como **dueño**, quiero enterarme por la campanita si la conexión se cayó, para volver a conectarla cuanto antes.
- Como **dueño**, quiero poder desconectar la cuenta, para cortar el acceso del sistema si hace falta.
- Como **dueño**, quiero que el sistema no pierda avisos de Mercado Libre aunque haya estado caído un rato, para que no se escape ninguna venta.

## 4. Requisitos funcionales

**Conexión**

- **RF-1.** Configuración tiene una sección "Mercado Libre". Sin cuenta conectada muestra el botón "Conectar con Mercado Libre".
- **RF-2.** Al conectar, el sistema lleva al usuario a Mercado Libre para que inicie sesión y autorice el acceso, y lo trae de vuelta a la misma sección con el resultado: conectada, o el motivo por el que no se pudo.
- **RF-3.** Con la cuenta conectada, la sección muestra: el nombre de la cuenta de Mercado Libre, desde cuándo está conectada, el estado (conectada / requiere reconexión) y la fecha y hora del último aviso recibido.
- **RF-4.** El sistema renueva la autorización por su cuenta antes de que venza. El usuario no tiene que hacer nada mientras la conexión esté sana.
- **RF-5.** Si la renovación falla de forma definitiva (por ejemplo, porque el acceso se revocó desde Mercado Libre), la conexión pasa a "requiere reconexión", se genera un aviso en la campanita y la sección ofrece "Volver a conectar".
- *(Agregado 2026-11-20, spec 013, sección 11.)* El aviso va en la pestaña **Mercado Libre** de la campanita, se destaca como urgente y lo ve también quien tiene «ver» en Mercado Libre (ver Permisos).
- **RF-6.** "Desconectar" pide confirmación, elimina la autorización guardada y deja la sección como en el RF-1. El historial ya registrado en el sistema no se borra.
- **RF-7.** Solo puede haber una cuenta conectada. Para cambiar de cuenta hay que desconectar primero.
- **RF-8.** Al volver a conectar, si la cuenta autorizada no es la misma que estaba conectada antes, el sistema no la reemplaza: lo informa y pide desconectar primero la actual (RF-7). *(Cambio 2026-11-11, al escribir el plan: antes decía "lo advierte y pide confirmación antes de reemplazarla". Confirmar después de autorizar obligaba a guardar una autorización a medio aceptar.)*

**Avisos de Mercado Libre**

- **RF-9.** El sistema expone una dirección pública donde Mercado Libre entrega sus avisos. Cada aviso se guarda y se confirma de inmediato; el trabajo que dispare se hace después, sin demorar la confirmación.
- **RF-10.** Un aviso nunca se toma como dato cierto: solo indica que algo cambió. El sistema consulta a Mercado Libre, con la autorización de la cuenta, para saber qué pasó.
- **RF-11.** Los avisos que no correspondan a la cuenta conectada, o que lleguen sin cuenta conectada, se descartan sin procesar.
- **RF-12.** Un mismo aviso recibido más de una vez se procesa una sola vez.
- **RF-13.** El sistema consulta una vez por día a Mercado Libre por los avisos que no pudo entregar y los incorpora como si hubieran llegado. La sección de Configuración tiene además un botón "Buscar avisos pendientes" que hace lo mismo en el momento.
- **RF-14.** Si procesar un aviso falla, queda marcado como fallido con su motivo y se reintenta en la siguiente pasada periódica. La sección muestra cuántos avisos hay pendientes o fallidos.
- **RF-15.** En esta spec todavía no hay nada que hacer con el contenido de los avisos: se reciben, se guardan y quedan como "sin acción". Las specs 020 a 022 definen qué hace el sistema con cada tipo.

**Seguridad**

- **RF-16.** La autorización de la cuenta se guarda cifrada, nunca se envía al navegador y nunca aparece en registros ni mensajes de error.
- **RF-17.** Las claves de la aplicación ante Mercado Libre viven en variables de entorno y se documentan en `.env.example` sin sus valores.

## 5. Reglas de negocio

- **El sistema es el que manda.** La conexión existe para que el sistema publique, actualice y consulte. Nada de lo que llegue por un aviso modifica datos del negocio sin que el sistema lo haya verificado contra Mercado Libre (RF-10).
- **Una sola cuenta**, la del negocio (RF-7).
- **Condiciones que impone Mercado Libre** (ver `docs/investigacion/2026-11-10-mercado-libre-y-arca.md`, secciones 1.1 a 1.3):
  - La autorización vence a las pocas horas y hay que renovarla; cada renovación invalida la anterior. *(Fuente no oficial; a confirmar en la prueba técnica.)*
  - Cada aviso se tiene que confirmar en menos de medio segundo. Si no, Mercado Libre puede dejar de mandar avisos y hay que volver a suscribirse. *(Confirmado en la documentación oficial.)*
  - Un aviso sin confirmar se reintenta durante una hora y después se da por perdido. Los perdidos se pueden recuperar **solo durante 2 días**. *(Confirmado en la documentación oficial.)*
  - No hay ambiente de pruebas: se prueba con usuarios de prueba sobre la plataforma real. *(Confirmado en la documentación oficial.)*
  - Para registrar la aplicación, la cuenta de Mercado Libre tiene que tener los datos del titular validados. *(Confirmado en la documentación oficial.)*
- **Permisos validados en el servidor** (constitución, regla 14). La dirección que recibe avisos no tiene sesión de usuario: su protección es el RF-10 y el RF-11.
- **Los secretos no se suben al repositorio** (regla 16).
- **Fechas en UTC en la base**, mostradas en la zona de Tucumán (regla 9).
- Sin dinero en esta spec.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver la sección y el estado de la conexión | Permiso "ver" en Configuración |
| Conectar, volver a conectar y desconectar | Solo el rol Dueño |
| Buscar avisos pendientes | Permiso "editar" en Configuración |
| Ver el aviso de conexión caída en la campanita | Permiso "ver" en Configuración o, desde el 2026-11-20, en Mercado Libre *(spec 013, sección 11: va en la pestaña Mercado Libre; quien no puede reconectar lo ve sin enlace y con «Avisale al Dueño»)* |

## 7. Casos borde y errores

- **El usuario cancela en Mercado Libre o no autoriza:** vuelve a la sección con el mensaje "No se autorizó la conexión. Podés intentarlo de nuevo." No se guarda nada.
- **La vuelta desde Mercado Libre llega alterada o repetida** (alguien reutiliza o fabrica el enlace de retorno): se rechaza y no se conecta nada.
- **Un empleado sin permiso intenta conectar:** se rechaza en el servidor, aunque la interfaz no le muestre el botón.
- **El acceso se revoca desde el panel de Mercado Libre:** la próxima renovación falla y aplica el RF-5.
- **Dos operaciones intentan renovar la autorización al mismo tiempo:** se renueva una sola vez; la otra usa el resultado. Si esto fallara, la conexión se rompería, porque cada renovación invalida la anterior.
- **Mercado Libre no responde:** la operación falla con un mensaje claro ("Mercado Libre no responde. Probá de nuevo en unos minutos.") y la conexión **no** pasa a "requiere reconexión" por una caída temporal.
- **Mercado Libre limita la cantidad de consultas:** el sistema espera y reintenta más tarde, sin perder el aviso.
- **Llega un aviso de un tipo que el sistema no conoce:** se guarda como "sin acción" y no genera error.
- **Se desconecta con avisos pendientes:** los pendientes se descartan; no se pueden procesar sin autorización.
- **Entornos de prueba y desarrollo:** Mercado Libre solo entrega avisos y devuelve al usuario a direcciones públicas y seguras. La forma de probar sin tocar la cuenta real se define en el plan.

## 8. Criterios de aceptación

- [x] El dueño conecta la cuenta desde Configuración y la sección muestra el nombre de la cuenta, la fecha de conexión y el estado "conectada". — Probado en pantalla con la cuenta de prueba.
- [x] Pasado el vencimiento de la autorización, el sistema sigue pudiendo consultar a Mercado Libre sin que nadie intervenga. — Se forzó el vencimiento en la base y la pasada diaria renovó sola contra Mercado Libre real.
- [x] Al revocar el acceso desde Mercado Libre, la conexión pasa a "requiere reconexión" y aparece el aviso en la campanita. — Revocado por la API; la pasada diaria lo detectó. Visto en pantalla el estado, el motivo y el aviso. Revocar desde la web de Mercado Libre no se probó: Mercado Libre tarda unos minutos en rechazar la autorización ya emitida.
- [x] El dueño vuelve a conectar y el estado vuelve a "conectada". — Probado en pantalla; el aviso de la campanita desaparece y la auditoría lo registra como reconexión.
- [x] El dueño desconecta, con confirmación, y la sección vuelve al estado inicial. — Probado en pantalla; además revoca el permiso del lado de Mercado Libre.
- [x] Un usuario que no es Dueño no puede conectar ni desconectar, ni desde la interfaz ni llamando directo al servidor. — En pantalla, con un usuario que solo ve Configuración y otro que también edita: ninguno ve "Conectar" ni "Desconectar"; el retorno de Mercado Libre lo rechaza con "Solo el Dueño puede conectar…", y sin sesión lleva al login sin tocar la conexión. Las acciones del servidor validan `requireOwner` en su primera línea (cubierto por las pruebas de permisos); no se llamó una acción directamente con un identificador armado a mano.
- [ ] Un aviso enviado por Mercado Libre queda guardado y confirmado dentro del tiempo exigido. — **Pendiente de despliegue (T-018).** El aviso se guarda con una sola escritura y responde en 15 a 25 ms en local, pero el límite de 500 ms se mide en Vercel, en frío y en caliente.
- [x] El mismo aviso recibido dos veces se procesa una sola vez. — Probado contra la ruta real.
- [x] Un aviso de otra cuenta, o recibido sin cuenta conectada, se descarta. — De otra cuenta: probado contra la ruta real (queda descartado), y el de otra aplicación no se guarda. Sin cuenta conectada: cubierto por pruebas unitarias.
- [ ] Con el sistema sin poder recibir durante un rato, los avisos de ese período aparecen después de la pasada periódica o de "Buscar avisos pendientes". — **Pendiente de un aviso perdido real.** La pasada y el botón funcionan y Mercado Libre acepta las consultas, pero no había ningún aviso perdido para recuperar; el lector acepta las formas probables de la respuesta y se corrige si la real difiere.
- [x] Conectar y desconectar quedan en la auditoría con usuario, fecha y cuenta. — Visto en la pantalla de Auditoría, con filtro por acción.
- [x] La autorización guardada está cifrada en la base y no aparece en ninguna respuesta al navegador ni en los registros. — Cifrada en la base (formato `v1.…`, ninguna en claro); ninguna autorización en los registros del servidor ni del túnel. En la dirección del retorno queda el código de autorización de un solo uso, que vence en minutos y no sirve sin la clave secreta ni el verificador de PKCE.
- [x] Hay pruebas unitarias de: cuándo corresponde renovar la autorización, renovación simultánea, descarte de avisos ajenos o duplicados, y validación de la vuelta desde Mercado Libre. — 300 pruebas en total pasan; las de esta spec están en `src/lib/mercadolibre/` y `src/lib/notification-types.test.ts`.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Decisiones (confirmadas el 2026-11-10)

1. **La aplicación ante Mercado Libre se registra con la cuenta del cliente**, dueño del negocio, para que quede a su nombre.
   - *(Agregado 2026-11-11.)* **Durante el desarrollo se usa una aplicación registrada en la cuenta del desarrollador**, con usuarios de prueba. Antes de salir a producción se registra la aplicación definitiva en la cuenta del cliente, se cambian las credenciales del sistema y el cliente conecta su cuenta. No hay nada que migrar: los datos de prueba no pasan a producción.
2. **Se sigue en el plan gratuito de Vercel.** La recuperación de avisos perdidos (RF-13) corre una vez por día, más el botón manual. Se acepta que un aviso perdido puede tardar hasta un día en recuperarse. Como Mercado Libre guarda los avisos perdidos solo 2 días, si la pasada diaria falla dos días seguidos esos avisos se pierden del todo: por eso las specs 021 y 022 suman controles propios contra Mercado Libre que no dependen de los avisos.
3. **Solo el rol Dueño conecta y desconecta** la cuenta.
4. **Se hace una prueba técnica** antes de escribir el código de esta spec. *(Cambio 2026-11-11: sobre un entorno local con túnel. La aplicación de desarrollo es de la cuenta personal del desarrollador y la cuenta que se conecta es una de prueba; ver `plan.md`, secciones 0 y 7.)*

## 10. Preguntas abiertas

- Resultado de la prueba técnica: confirmar las condiciones de Mercado Libre de la sección 5 que todavía no son oficiales. Si alguna resulta distinta, se corrige esta spec antes de escribir el plan.
- La prueba técnica se hace con la cuenta del desarrollador, que ya está validada, sin esperar la del cliente.
