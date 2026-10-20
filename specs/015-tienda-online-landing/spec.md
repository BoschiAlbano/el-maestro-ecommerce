# Spec 015 — Tienda online: ruta raíz y landing en blanco

| | |
|---|---|
| **Estado** | Verificada (2026-10-20) |
| **Depende de** | 001, 002, 012 (el inicio del dueño pasa a otra ruta) |
| **Referencia** | `docs/PROJECT.md`, sección 6 ("Fuera de alcance": tienda online) |

## 1. Objetivo

Reservar la ruta raíz `/` (hoy `http://localhost:3000/`) para la **futura tienda online**, donde los clientes van a poder ver el catálogo y hacer pedidos. Hasta que se construya, `/` muestra una **landing en blanco**.

Hoy `/` es el inicio del sistema interno (spec 012). Si la tienda se construyera más adelante sobre esa misma ruta, habría que mover el inicio interno y todo lo que apunta a él al mismo tiempo. Esta spec hace esa mudanza **ahora**, que es barata, y deja documentado hacia dónde va la tienda.

Esta spec **no construye la tienda**: solo libera la ruta raíz, deja una página vacía y documenta la intención.

## 2. Alcance

**Incluye:**

- Una página pública en `/` (la landing), **en blanco**: sin contenido, sin datos y sin pedir sesión. Si quien entra ya tiene sesión, se lo lleva a `/inicio` (RF-9).
- Marcar la landing como **no indexable** (`noindex`) mientras esté vacía.
- Mover el **inicio del sistema interno** (spec 012) de `/` a una ruta nueva (`/inicio`), con el mismo contenido y los mismos permisos.
- Actualizar lo que hoy apunta a `/` como inicio interno: el ítem "Inicio" del menú lateral, la redirección después de iniciar sesión, la migas de pan y cualquier enlace "volver al inicio".
- Documentar la **visión de la tienda online** (sección 9) para que la spec futura parta de algo escrito.

**No incluye:**

- La tienda en sí: catálogo público, carrito, pedidos de clientes, cuentas de clientes, pagos online, envíos. Todo eso será una spec posterior y sigue **fuera de alcance** en `docs/PROJECT.md` hasta que se apruebe (ver pregunta abierta 3).
- Diseño, textos, logo ni identidad visual de la landing: queda en blanco a propósito.
- Cambios en el login, los permisos ni el contenido del inicio interno.
- Una ruta aparte para el sistema interno (por ejemplo `/admin`): las rutas internas actuales (`/caja`, `/ventas`, etc.) no se tocan.

## 3. Historias de usuario

- Como **dueño**, quiero que la dirección principal del sitio quede libre para la tienda online, para no tener que rehacer rutas el día que la construyamos.
- Como **empleado o dueño**, quiero seguir entrando al sistema y llegar a mi inicio después de iniciar sesión, sin notar ningún cambio, para trabajar como siempre.
- Como **visitante**, quiero que `/` cargue sin pedirme usuario ni contraseña, para que el día de mañana la tienda sea pública.

## 4. Requisitos funcionales

- **RF-1.** `/` es una página **pública** (no exige sesión) que se muestra **en blanco**: sin menú lateral, sin cabecera del sistema y sin consultas a la base de datos.
- **RF-2.** `/` **no** usa el layout del sistema interno (`(app)`): el menú lateral, el chequeo de sesión y la cabecera no se aplican a la landing.
- **RF-3.** El inicio del sistema interno (spec 012) pasa a la ruta **`/inicio`**, con el mismo contenido, los mismos permisos y el mismo layout del sistema que hoy.
- **RF-4.** El ítem "Inicio" del menú lateral apunta a `/inicio` y se marca como activo cuando se está en esa ruta.
- **RF-5.** Después de iniciar sesión con éxito, el sistema lleva a `/inicio`. Si ya hay sesión y se entra a `/login`, también lleva a `/inicio`.
- **RF-6.** Las migas de pan tratan a `/inicio` como la raíz del sistema (donde hoy lo hace `/`).
- **RF-7.** Entrar a `/inicio` sin sesión lleva a `/login`, igual que cualquier otra ruta del sistema.
- **RF-8.** El nombre del sitio y el ícono no cambian. El manifiesto (PWA) arranca en `/inicio` (`start_url`), para que la app instalada siga abriendo el sistema.
- **RF-9.** Quien entra a `/` **con sesión activa** es redirigido a `/inicio`. Quien no tiene sesión ve la landing en blanco. Esta redirección es transitoria: se quita cuando se construya la tienda (sección 9).
- **RF-10.** La landing declara `noindex` (metadatos `robots`) para que los buscadores no la indexen mientras esté vacía.

## 5. Reglas de negocio

- **La landing no muestra nada del negocio**: ni productos, ni precios, ni stock, ni datos de ventas. Hasta que haya una spec de tienda aprobada, `/` queda vacía (constitución, regla 17: no se exponen costos ni márgenes; una tienda pública tendrá que decidir qué precios y qué stock se muestran).
- **El sistema interno no cambia de comportamiento**: solo cambia la dirección de su inicio. Ninguna pantalla, permiso ni cálculo se modifica.
- **Los permisos se siguen validando en el servidor** (constitución): mover el inicio de ruta no puede dejar el contenido sin protección. `/inicio` conserva el chequeo de sesión y de usuario activo del layout `(app)`.
- **La ruta raíz es de la tienda**: ninguna pantalla interna futura debe usar `/` como destino.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver la landing (`/`) | Cualquier visitante, sin sesión |
| Ver el inicio interno (`/inicio`) | Usuario con sesión activa (igual que el inicio de hoy, spec 012) |

## 7. Casos borde y errores

- **Enlaces o marcadores viejos a `/`** de usuarios que guardaron el sistema como favorito o como app instalada: con sesión activa son redirigidos a `/inicio` (RF-9), así que no notan el cambio; sin sesión ven la landing en blanco, en vez del login.
- **Sesión vencida en `/inicio`**: lleva a `/login`, como en cualquier otra pantalla.
- **Usuario desactivado o sin fila en `users`** con sesión de Supabase válida: se le cierra la sesión y va a `/login` (comportamiento actual del layout `(app)`, sin cambios).
- **`/inicio` mal escrito o ruta inexistente**: página 404 estándar, sin cambios.
- **Robots y buscadores**: la landing lleva `noindex` (RF-10). Cuando se construya la tienda hay que quitarlo.

## 8. Criterios de aceptación

- [x] Entrar a `http://localhost:3000/` sin sesión muestra una página en blanco, sin redirigir al login y sin menú lateral.
- [x] Entrar a `/` **con** sesión redirige a `/inicio`.
- [x] La landing incluye `<meta name="robots" content="noindex">`.
- [x] La app instalada (PWA) abre en `/inicio`.
- [x] Iniciar sesión lleva a `/inicio` y se ve el mismo inicio que antes (spec 012), con las mismas tarjetas y permisos.
- [x] El ítem "Inicio" del menú lateral lleva a `/inicio` y se resalta cuando se está ahí.
- [x] Entrar a `/inicio` sin sesión lleva a `/login`.
- [x] Entrar a `/login` con sesión activa lleva a `/inicio`.
- [x] Las migas de pan de las pantallas internas siguen mostrando "Inicio" como primer nivel y ese nivel lleva a `/inicio`.
- [x] Ningún enlace interno del sistema apunta ya a `/` como si fuera el inicio (se verifica buscando en el código).
- [x] La landing no hace consultas a la base de datos.
- [x] Las pruebas unitarias existentes (por ejemplo `breadcrumbs.test.ts`) siguen pasando, actualizadas a la ruta nueva.
- [ ] Cobertura E2E: pendiente para la pasada de endurecimiento (ver `AGENTS.md`).

## 9. Visión de la tienda online (futura, no se construye en esta spec)

Esto es lo que se sabe hoy; **no es un requisito** y se va a revisar en su propia spec:

- La tienda vive en `/` y es pública.
- Los clientes podrán **ver el catálogo** y **hacer pedidos**. Los pedidos entrarían al sistema interno como los pedidos por encargo (spec 009), para que el negocio los gestione en un solo lugar.
- Va a requerir decisiones que hoy no están tomadas: qué productos y precios se muestran, si se muestra stock, si el cliente tiene cuenta o pide como invitado, cómo se paga (hoy el cobro con tarjeta o QR y las integraciones con medios de pago están fuera de alcance), cómo se coordina la entrega y cómo se avisa al cliente.
- Cuando se decida construirla, hay que **cambiar `docs/PROJECT.md`**: sacar "Tienda online" de "Fuera de alcance" y agregarla a los módulos, y escribir su propia spec (016 o posterior) con su plan y sus tareas.

## 10. Decisiones y preguntas abiertas

**Decididas (2026-10-20):**

1. La ruta del inicio interno es **`/inicio`**.
2. Quien tenga sesión y entre a `/` es **redirigido a `/inicio`** (RF-9); la PWA arranca en `/inicio`.
3. La landing lleva **`noindex`** (RF-10).
4. La landing queda **completamente vacía**, sin logo ni texto.

**Abierta:**

- **¿Se actualiza ya `docs/PROJECT.md`?** Hoy "Tienda online" figura en "Fuera de alcance". Se propone dejar esa línea y agregar una nota que apunte a esta spec (la landing en blanco no es la tienda), y moverla recién cuando se apruebe la spec de la tienda.
