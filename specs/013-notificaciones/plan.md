# Plan 013 — Notificaciones

> Cómo se construye lo que dice `spec.md`.

## 1. Modelo de datos

- **`NotificationType`** (enum): `PEDIDO_NUEVO`, `DIFERENCIA_CAJA`. Sin `STOCK_BAJO`: ese aviso no se persiste (spec.md, sección 10) — se calcula en vivo con `loadTravelList` (spec 012).
- **`Notification`**: `id`, `type`, `message` (texto ya armado, en español, listo para mostrar), `targetType` + `targetId` (a qué se refiere — `"Order"`/id o `"CashShift"`/id, mismo criterio no-FK que `AuditLog`, spec 003: si se borra lo referenciado, el aviso tiene que poder seguir mostrándose), `createdAt`, `readAt` (`DateTime?`, `null` = sin leer). Sin `userId`: la lectura es global, no por usuario (spec.md, sección 5).

## 2. Escritura — dos líneas nuevas en flujos que ya existen

- `src/lib/notifications.ts`: `notifyPedidoNuevo(orderId, customerName)` y `notifyDiferenciaCaja(shiftId, difference)` — arman el `message` en español y llaman `prisma.notification.create`. No necesitan `tx`: no se agrega a la transacción existente de cada flujo (ninguno de los dos orígenes usa `$transaction` hoy — `createOrder`, spec 009, y `confirmClose`, spec 007, hacen un único `prisma.X.create/update`); es una segunda escritura secuencial, consistente con el criterio de que un aviso perdido por una falla puntual no es grave (no es dinero ni stock, a diferencia de lo que si exige transacción en la constitución, regla 10).
- `src/app/(app)/pedidos/actions.ts`, `createOrder`: después de `prisma.order.create`, llama `notifyPedidoNuevo(order.id, order.customerName)`.
- `src/app/(app)/caja/actions.ts`, `confirmClose`: después del `prisma.cashShift.update`, si `difference !== 0`, llama `notifyDiferenciaCaja(shift.id, difference)`.

## 3. Lectura — `src/lib/notifications-data.ts` (`server-only`)

- `loadNotificationsSummary(currentUser)` → `{ items: {id, type, message, createdAt}[], stockBajo: boolean, unreadCount: number }`.
  - `items`: `Notification` con `readAt: null`, filtrado por tipo según permiso (`PEDIDO_NUEVO` solo si "ver" en Pedidos, `DIFERENCIA_CAJA` solo si "ver" en Caja) — mismo criterio por módulo que el resto del sistema.
  - `stockBajo`: `(await loadTravelList(currentUser))` (spec 012, vía `home-data.ts`) `.length > 0` — `false` si no tiene permiso "ver" en Inventario (ya lo resuelve `loadTravelList`).
  - `unreadCount = items.length + (stockBajo ? 1 : 0)` (spec.md, sección 5 — stock bajo suma como un solo ítem, no uno por producto).
- `markNotificationRead(id, currentUser)`: busca el aviso, exige el permiso de su `type` (`PEDIDO_NUEVO` → "ver" en Pedidos, `DIFERENCIA_CAJA` → "ver" en Caja), `update` a `readAt: new Date()` si todavía estaba sin leer (si ya estaba leído, no hace nada — operación segura de repetir, spec.md sección 7).

## 4. Server Actions

`src/components/nav/notifications-actions.ts` (`"use server"`, vive junto al componente que lo consume, no en una carpeta de feature — es transversal):

- `getNotificationsSummary()`: `getCurrentUser()` + `loadNotificationsSummary`. Sin usuario, devuelve el resumen vacío (`{ items: [], stockBajo: false, unreadCount: 0 }`) en vez de tirar error — el header se renderiza igual mientras la sesión se resuelve.
- `markNotificationReadAction(id: string)`: `getCurrentUser()` + `markNotificationRead`.

## 5. Componentes

- **`src/components/ui/popover.tsx`** (nuevo, wrapper de `@base-ui/react/popover` — ya es una dependencia del proyecto, spec 002/004 lo usan para `Select`; mismo criterio de wrapping que `select.tsx`): `Popover`, `PopoverTrigger`, `PopoverContent`.
- **`src/components/nav/notifications-bell.tsx`** (cliente): ícono de campana (`lucide-react`, `Bell`) con una medallita (`Badge`, ya existe) mostrando `unreadCount` si es mayor a 0. Al abrir el `Popover`, lista los `items` (con un botón "Marcar como leído" cada uno) y, si `stockBajo`, una línea fija con link a `/lista-de-viaje`. Hace `getNotificationsSummary()` al montar y cada 60 segundos (`setInterval`, limpiado en el `useEffect`) — sin Supabase Realtime (spec.md, sección 10).
- **`src/components/nav/app-shell.tsx`**: se agrega `<NotificationsBell />` en el `<header>`, antes de `headerEnd` — queda visible en todas las pantallas (RF-5), sin tocar el resto de la estructura del header ni mover el `SideNav`/`BottomNav` (ya confirmado con el cliente: el menú sigue a la izquierda, sin un retoque visual más a fondo por ahora).

## 6. Permisos

Sin módulo nuevo — reusa Pedidos y Caja para los avisos puntuales, Inventario para el de stock bajo (ya resuelto por `loadTravelList`). Sin la campanita visible en absoluto para quien no tenga ninguno de los tres (el resumen da `unreadCount: 0` y `items: []`).

## 7. Pruebas

- **Unitarias**: esta spec es sobre todo escritura simple (dos `create`) y lectura filtrada por permiso — sin cálculos puros nuevos que testear (el de stock bajo ya está testeado en `travel-list.test.ts`, spec 012). Se revisa a mano en el navegador, mismo criterio que specs 002/003/010.
- **E2E**: diferido a la pasada de endurecimiento previa al cierre del MVP (`AGENTS.md`, sección "Pruebas").

## 8. Riesgos y decisiones

- **El stock bajo no se persiste como `Notification`** — evita la complejidad de detectar el momento exacto en que un producto "cruza" el mínimo (habría que revisar el comprometido en cada movimiento de stock del sistema, spec.md sección 10) y reusa tal cual el cálculo ya probado de la lista de viaje.
- **Lectura global, no por usuario** — evita una tabla de unión (`NotificationRead` por usuario) para un equipo chico que comparte una sola caja; si en el futuro hace falta lectura por usuario, es un cambio de spec aparte.
- **Revisión periódica (60s), no tiempo real** — decisión ya tomada en `spec.md`, sección 10.
- **La campanita se agrega al header existente sin rediseñarlo** — el cliente pidió explícitamente no ir más a fondo con el retoque visual por ahora.

## 9. Cambio 2026-11-20: pestañas y diseño (spec, sección 11)

*(Aprobado el 2026-11-20.)*

### 9.1 Datos

**Sin migración.** La pestaña, el ícono y si es urgente se deducen del tipo de aviso; no se guardan.

### 9.2 Lógica pura — `src/lib/notification-tabs.ts` (nuevo, sin I/O, con pruebas)

- `NotificationTab = "sistema" | "mercadolibre"`.
- `NOTIFICATION_TAB: Record<NotificationType, NotificationTab>`: `Record` completo, como `NOTIFICATION_ACCESS`. Un tipo nuevo sin pestaña no compila (spec, sección 11, casos borde).
- `NOTIFICATION_ICON: Record<NotificationType, NotificationIcon>`: una clave de ícono (`pedido`, `caja`, `stock`, `factura`, `venta`, `cancelacion`, `fraude`, `envio`, `publicacion`, `conexion`). El componente la traduce a un ícono de `lucide-react`; la lógica pura no depende de la interfaz.
- `URGENT_TYPES`: `ML_FRAUDE`, `ML_VENTA_SIN_STOCK` y `ML_RECONEXION` (RF-12).
- `relativeTime(date, now)`: «hace un momento», «hace 5 min», «hace 3 h», «ayer 18:40» o «12/11 18:40», en hora de Tucumán (RF-12).
- `tabCounts(...)`: cuántos sin leer tiene cada pestaña y el total (RF-8).

### 9.3 Avisos calculados

`LiveAlert` (`src/lib/facturacion/alerts.ts`) suma tres campos obligatorios: `tab`, `icon` y `urgent`. Cada constructor los completa:

- `buildInvoicingAlerts`: pestaña Sistema, ícono `factura`.
- `buildPendingSyncAlert`: Mercado Libre, `publicacion`.
- `buildOrderAlerts`: Mercado Libre. El despacho vencido y el riesgo de fraude son urgentes; los íconos son `envio` y `fraude`.

Al ser obligatorios, un aviso calculado nuevo sin pestaña tampoco compila.

### 9.4 Resumen — `notifications-data.ts`

- Cada `NotificationItem` suma `tab`, `icon` y `urgent`. El resumen suma `showTabs`: `true` si el usuario tiene «ver» en Mercado Libre (RF-10).
- **Reconexión** (permisos de la sección 11): `NOTIFICATION_ACCESS` admite «cualquiera de estos módulos», y `ML_RECONEXION` queda con Configuración **o** Mercado Libre. Si el usuario no tiene «editar» en Configuración, que es lo que pide reconectar, el aviso llega sin enlace y con «Avisale al Dueño para reconectarla.» al final.
- `markAllNotificationsRead(currentUser, tab)`, con `tab` igual a `todos`, `sistema` o `mercadolibre` (RF-11):
  - un `updateMany` de los avisos sin leer de los tipos que el usuario ve (RF-7) y que son de esa pestaña;
  - si la pestaña incluye Sistema y el aviso de stock bajo está activo, `dismissStockAlert` (RF-4b);
  - los avisos calculados no se tocan.

  Es seguro de repetir: dos personas a la vez no rompen nada.
- Server Action `markAllNotificationsReadAction(tab)` en `notifications-actions.ts`.

### 9.5 Componente — `notifications-bell.tsx`

- Ventana más ancha (`w-[min(26rem,calc(100vw-2rem))]`) con la lista desplazable (`max-h` y `overflow-y-auto`) (RF-13).
- Encabezado: «Avisos» y «Marcar todas como leídas», que actúa sobre la pestaña abierta y se apaga si no hay nada que marcar.
- Con `showTabs`, `Tabs` (`src/components/ui/tabs.tsx`, ya existe) con Todos, Sistema y Mercado Libre, cada una con su contador (RF-8). Abre en Todos. Sin `showTabs`, la lista sola (RF-10).
- Fila del aviso (RF-12):
  - ícono en un círculo, mensaje y hora debajo;
  - toda la fila es un enlace cuando el aviso lleva a algún lado;
  - «marcar como leído» es un botón chico con ícono (`Check`) y texto para lectores de pantalla;
  - los urgentes, con fondo y texto rojos suaves, en claro y en oscuro.
- Orden: primero los calculados, con la marca «Ahora»; después el de stock bajo; después los avisos con hora, del más nuevo al más viejo.
- Una pestaña vacía muestra su mensaje: «No hay avisos», «No hay avisos del sistema», «No hay avisos de Mercado Libre» (RF-13).

### 9.6 Pruebas

- **Unitarias:** `notification-tabs.test.ts` (pestaña de cada tipo, urgentes, `relativeTime` en los bordes de minuto, hora y día, y `tabCounts`); `notification-types.test.ts` (la reconexión con Mercado Libre o con Configuración); `order-alerts.test.ts` y las de los avisos de facturación (los campos nuevos).
- **Manual:** el cliente revisa la campanita con avisos de las dos pestañas, «Marcar todas como leídas» en cada una, un usuario sin permiso de Mercado Libre, y la vista en el celular.
- **E2E:** pendiente para la pasada de endurecimiento.

### 9.7 Decisiones

- **La pestaña se deduce del tipo, no se guarda:** no hace falta migrar los avisos viejos, y un tipo nuevo obliga a decidirla.
- **«Marcar todas» no toca los avisos calculados:** marcarlos no tendría efecto, porque se vuelven a calcular en la próxima vuelta. Lo dice la spec (RF-11).
