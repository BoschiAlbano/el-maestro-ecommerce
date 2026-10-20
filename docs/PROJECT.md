# Sistema de gestión para importadora (PWA)

| | |
|---|---|
| **Estado** | Alcance definido. Specs en borrador. |
| **Fecha de definición** | 2026-10-14 |
| **Origen** | Documento de alcance elaborado en Claude (14/10/2026) |
| **Tiempos y precio** | Pendientes (ver sección 12) |

> Este archivo es la fuente de verdad del proyecto. Cada spec de `specs/` lo desarrolla en detalle. Si algo cambia en el alcance, se cambia primero acá.

---

## 1. Resumen y objetivo

Aplicación web instalable (PWA) para que un negocio importador controle **stock, ventas, pedidos por encargo y caja** desde cualquier dispositivo, y pueda ver qué se vende y qué falta reponer. El cliente parte sin inventario cargado, por lo que la **carga inicial** forma parte del proyecto.

Toda la operación se maneja en **pesos argentinos (ARS)**.

## 2. Contexto y usuarios

El cliente importa mercadería de Ciudad del Este (Paraguay), tiene su local y depósito en San Miguel de Tucumán y vende por mostrador y por encargo (WhatsApp y redes sociales).

- Volumen inicial: unos **200 productos**, **un solo puesto de caja** y **dos empleados** (turno mañana y turno tarde).
- El dueño viaja a traer la mercadería. Necesita ver desde el celular **qué stock falta, qué se vende y qué pedidos tiene**.
- La conexión a internet del local es estable.

| Usuario | Uso principal | Dispositivo habitual |
|---|---|---|
| Dueño | Analíticas, stock, pedidos, precios, usuarios y permisos | Celular y PC |
| Empleado / cajero | Ventas, caja y pedidos, según los permisos asignados | PC de caja |

## 3. Stack y arquitectura

- **Frontend y backend:** Next.js (App Router) con TypeScript, Server Actions y Route Handlers.
- **UI:** Tailwind CSS + shadcn/ui. Diseño responsivo, pensado primero para celular.
- **Base de datos y autenticación:** Supabase (Postgres + Auth). Supabase Storage para fotos de productos.
- **ORM:** Prisma. Conexión por el pooler de Supabase (`DATABASE_URL`) y conexión directa (`DIRECT_URL`) para migraciones.
- **Hosting:** Vercel. Base de datos y hosting en la región de São Paulo.
- **PWA:** instalable, con caché del catálogo. Sin modo offline.
- **Impresión:** ticket de 58 mm con la impresión del navegador (CSS) y modo kiosco de Chrome en la PC de caja.
- **Autorización:** Prisma se conecta saltando RLS, así que **los permisos se validan siempre en el servidor** (sesión + permiso en cada Server Action y Route Handler). La interfaz solo oculta lo que no corresponde.

## 4. Módulos incluidos

Cada módulo tiene su spec en `specs/`.

| Spec | Módulo | Qué incluye |
|---|---|---|
| 001 | Base del proyecto | Proyecto Next.js, Supabase, Prisma, PWA, layout responsivo y autenticación básica. |
| 002 | Usuarios, roles y permisos | Alta de usuarios. Roles creados por el dueño con una matriz de permisos por módulo y acción (ver, crear, editar, anular, exportar). Permisos especiales: ver costos y márgenes, anular ventas, ajustar stock, reimprimir tickets, cerrar caja y cambiar precios. El rol Dueño es fijo. |
| 003 | Configuración y auditoría | Razón social y texto del ticket, parámetros generales y registro de acciones sensibles (anulaciones, ajustes, reimpresiones y cambios de precio). |
| 004 | Catálogo de productos | Nombre, marca, rubro, código de barras (original o generado por el sistema), foto, precio de compra y de venta en ARS y stock mínimo. Filtros por marca y rubro, importación masiva desde Excel o CSV, etiquetas con código de barras e historial de cambios de precio. |
| 005 | Inventario | Stock por movimientos (ingresos, ventas, ajustes y mermas), ajustes con motivo, conteo físico, carga inicial y alertas de stock bajo en pantalla. |
| 006 | Ingreso de mercadería | Carga de cada compra con proveedor opcional, cantidades y precio de compra en ARS. Actualiza el stock y el precio de compra del producto. |
| 007 | Caja por turnos | Apertura con monto inicial, ingresos y egresos manuales con concepto, cierre con efectivo esperado contra contado y diferencia, y resumen imprimible. |
| 008 | Ventas de mostrador y ticket | Búsqueda por nombre o código, lector de código de barras USB, carrito, cobro en efectivo, transferencia o ambos, ticket de 58 mm, reimpresión con registro y anulación con motivo y permiso. Sin descuentos. |
| 009 | Pedidos por encargo | Lista de productos de un cliente (nombre, teléfono y canal), con o sin stock. Seña, entrega parcial, cancelación con devolución de seña y exportación de la lista. |
| 010 | Empleados | Ficha del empleado (nombre, teléfono, DNI, fecha de ingreso, turno) con usuario asociado obligatorio y baja con desactivación de usuario. Sin fichaje de entrada/salida. |
| 011 | Analíticas y exportación | Ventas por mes, día, empleado, producto, marca, rubro y canal. Ticket promedio, productos más vendidos y sin movimiento, margen, valorización del stock y diferencias de caja. Exportación a Excel y PDF. |
| 012 | Inicio del dueño y lista de viaje | Pantalla de inicio con el estado de la caja actual, el resumen de caja de hoy, pedidos pendientes y alertas de stock (sin repetir ventas del mes ni más vendidos, eso está en Analíticas). La lista de viaje reúne los productos bajo el mínimo y los faltantes de pedidos pendientes, con cantidad sugerida, y se copia como texto o se exporta a Excel. |
| 013 | Notificaciones | Campanita en el header, visible en todas las pantallas, con avisos de pedido nuevo y diferencia de caja (marcables como leídos) y stock bajo (en vivo, sin leído). Se actualiza sola cada 60 segundos. |

## 5. Reglas de negocio acordadas

- **Moneda.** Todo en pesos argentinos. El sistema no trabaja con dólares ni con tipo de cambio. Cada producto tiene un precio de compra y un precio de venta, cargados por usuarios con permiso.
- **Precios.** El dueño define el precio final a mano. No hay margen automático ni recálculo masivo. Los montos calculados se redondean al peso entero, hacia arriba desde 0,5.
- **Costo y margen.** Cada ingreso de mercadería actualiza el precio de compra del producto al último precio pagado (no un costo promedio ponderado — decidido en la spec 006), y cada venta guarda el costo vigente en ese momento. Así el margen de una venta no cambia después.
- **Cobros.** Solo efectivo y transferencia. Una sola lista de precios y sin descuentos.
- **Pedidos.** Un pedido es una lista de productos de un cliente, con o sin stock. **No reserva stock**: la mercadería que llega queda disponible para una venta nueva o para entregar un pedido. Cada producto muestra, solo como dato informativo, cuántas unidades están comprometidas en pedidos pendientes.
- **Entrega.** El usuario elige los ítems que entrega y los convierte en venta, con ticket y descuento de stock. Los ítems entregados salen de la lista de pendientes y quedan en el historial. El pedido se cierra cuando no queda nada pendiente.
- **Seña.** Se cobra con la caja abierta, en efectivo o transferencia, y suma a la caja del día en que se cobra. Al entregar se aplica como pago ya cobrado hasta el total de la venta, y el excedente queda como saldo a favor del pedido. No se vuelve a contar en el cierre del día de entrega.
- **Cancelación.** La seña se devuelve como egreso de caja con motivo y el pedido pasa a cancelado. Si la seña fue por transferencia, el egreso se anota por ese medio y no afecta el efectivo esperado.
- **Caja.** Cada turno abre y cierra su propia sesión. Solo puede haber una caja abierta a la vez y no se vende sin caja abierta. Un cierre no se edita: las correcciones van como movimientos con motivo.
- **Ticket.** Lleva razón social, número de ticket, fecha y hora, empleado que lo emitió, lista de productos con precios, totales y la leyenda **"DOCUMENTO NO VÁLIDO COMO FACTURA"**.
- **Permisos.** El dueño, y cualquier empleado al que se le asigne el permiso, puede anular ventas y ajustar stock. Cada acción sensible queda en el registro de auditoría.
- **Códigos de barras.** La mayoría de los productos trae código de origen. Para los que no, el sistema genera un código propio.
- **Notificaciones.** Solo en pantalla.

## 6. Fuera de alcance

Nada de lo siguiente se construye en esta etapa. Cualquier cambio posterior se cotiza aparte.

- Facturación electrónica ARCA y cualquier comprobante fiscal. El ticket es un documento interno.
- Manejo de dólares, tipo de cambio, motor o calculadora de precios y conversor de USD a ARS (posible segunda fase).
- Cuentas corrientes, fiado, descuentos y múltiples listas de precios.
- Cobro con tarjeta o QR.
- Modo sin conexión (offline).
- Reserva automática de stock para pedidos.
- Varios depósitos o varios puestos de caja.
- Comisiones y liquidación de sueldos.
- Notificaciones por WhatsApp, email o push.
- Tienda online e integraciones con WhatsApp, redes sociales o medios de pago. (La ruta `/` queda reservada para la tienda con una landing en blanco, spec 015; eso no es la tienda: catálogo público, carrito y pedidos de clientes siguen fuera de alcance hasta que se apruebe su spec.)
- Impresión directa por comandos ESC/POS (se usa la impresión del navegador).

## 7. Requisitos no funcionales

- **PWA.** Instalable en celular y en PC, con caché del catálogo.
- **Diseño responsivo.** Todos los módulos funcionan en celular. El punto de venta se optimiza para la PC o tablet de caja; el inicio, las analíticas, el stock, los pedidos y la lista de viaje se piensan para pantalla chica.
- **Ticket.** Formato de 58 mm, unos 32 caracteres por línea. Se deja configurada la impresión sin diálogo en la PC de caja con un acceso directo de Chrome en modo kiosco.
- **Seguridad.** Supabase Auth, permisos validados en el servidor, verificación en dos pasos recomendada para el dueño y registro de auditoría.
- **Integridad de datos.** Cada venta guarda ítems, pagos, movimiento de stock y caja en una sola transacción: se guarda todo o nada.
- **Respaldos.** Copias automáticas de la base de datos (requiere plan de pago de Supabase) y exportación de ventas y stock a CSV.
- **Compatibilidad.** Chrome actualizado en la PC de caja; Chrome o Safari actualizados en celulares.

## 8. Supuestos y responsabilidades del cliente

- Dispone de una impresora térmica de 58 mm y de una PC de caja con Chrome. Informa marca y modelo de la impresora antes de la etapa de ticket.
- Aclara con su contador si debe emitir factura electrónica. El sistema no emite comprobantes fiscales.
- Entrega los datos del ticket: razón social y cualquier texto adicional.
- Define los roles y permisos de sus empleados y el stock mínimo de cada producto.
- Mantiene una conexión a internet estable en el local.
- Designa a una persona que valide cada entrega y dé la aprobación final.
- Carga o revisa los datos iniciales de los productos con la plantilla de Excel que se entrega.

## 9. Entregables y criterios de aceptación global

Entregables:

1. La aplicación funcionando en producción, en el dominio acordado.
2. La base de datos con su estructura y el usuario del dueño creado.
3. La plantilla de Excel para cargar productos y la importación con validación de errores.
4. La impresión del ticket configurada en la PC de caja.
5. Una guía de uso breve en PDF y la capacitación incluida.
6. El código fuente y los accesos, según lo que se acuerde sobre propiedad.

El proyecto se acepta cuando se cumple cada punto:

- [ ] Se abre caja, se vende en efectivo y por transferencia, se imprime el ticket de 58 mm con todos los datos acordados y se cierra caja con el efectivo esperado correcto.
- [ ] El stock refleja cada venta, ingreso, ajuste y anulación.
- [ ] Un pedido con seña se entrega en forma parcial y la seña no se duplica en la caja.
- [ ] Cada rol ve y hace solo lo que sus permisos permiten, probado con un rol de empleado.
- [ ] El dueño ve desde el celular las ventas, el stock bajo y los pedidos pendientes, y exporta analíticas, pedidos y lista de viaje.
- [ ] La importación de productos detecta y señala las filas inválidas antes de confirmar.

## 10. Infraestructura y costos recurrentes (a cargo del cliente)

Precios consultados el 14/10/2026, en USD y sin impuestos. Verificar antes de cotizar.

| Servicio | Plan recomendado | Costo | Motivo |
|---|---|---|---|
| Base de datos y autenticación | Supabase Pro | Desde 25 USD por mes | Copias diarias guardadas 7 días y sin pausa por inactividad. El plan gratuito pausa el proyecto tras una semana sin actividad. |
| Hosting | Vercel Pro | 20 USD por mes por usuario desarrollador | El plan Hobby se limita a uso personal no comercial. |
| Dominio propio | Opcional | A cotizar | |

Fuentes: <https://supabase.com/pricing>, <https://vercel.com/pricing>, <https://vercel.com/docs/plans/hobby>.

## 11. Hoja de ruta de specs

Orden sugerido según dependencias. El estado se actualiza a medida que avanza cada spec.

| Spec | Módulo | Depende de | Estado |
|---|---|---|---|
| 001 | Base del proyecto | — | Verificada |
| 002 | Usuarios, roles y permisos | 001 | Verificada |
| 003 | Configuración y auditoría | 001, 002 | Verificada |
| 004 | Catálogo de productos | 002, 003 | Verificada |
| 005 | Inventario | 004 | Verificada |
| 006 | Ingreso de mercadería | 004, 005 | Verificada |
| 007 | Caja por turnos | 002, 003 | Verificada |
| 008 | Ventas de mostrador y ticket | 005, 007 | Verificada |
| 009 | Pedidos por encargo | 005, 007, 008 | Verificada |
| 010 | Empleados | 002 | Verificada |
| 011 | Analíticas y exportación | 008, 009 | Verificada |
| 012 | Inicio del dueño y lista de viaje | 005, 009, 011 | Verificada |
| 013 | Notificaciones | 005, 007, 009 | Verificada |
| 014 | Caja del día | 007, 008, 009 | En desarrollo |
| 015 | Tienda online: ruta raíz y landing en blanco | 001, 002, 012 | Verificada |
| 016 | Ingreso por usuario y contraseña | 001, 002, 003 | Verificada |
| 017 | Reinicio del sistema | 002, 003 | En desarrollo |

Estados posibles: Borrador → Aprobada → En desarrollo → Verificada.

## 12. Puntos pendientes

**Condiciones comerciales** (definen tiempos y precio):

- Tiempos de entrega: cronograma por etapas, a partir de la estimación de horas por módulo.
- Precio y forma de pago: precio total, anticipo y pagos por etapa.
- Soporte y garantía: días de garantía por errores y si habrá mantenimiento mensual.
- Capacitación: cantidad de sesiones u horas incluidas.
- Carga inicial de productos: quién carga los 200 productos con la plantilla de Excel.
- Propiedad: a nombre de quién quedan el código, el dominio y las cuentas de Supabase y Vercel.
- Cambios de alcance: cómo se cotiza y se aprueba lo que se pida después de firmado.
- Hardware: marca y modelo de la impresora y si se incluye lector de código de barras USB.
- Aclaración fiscal: confirmación del contador del cliente sobre la factura electrónica.

**Mejoras de UX/UI pendientes (a futuro, no bloquean el MVP):**

- Pantalla de detalle de pedido (`/pedidos/[id]`, spec 009): el cliente la probó y funciona, pero le resultó complicada de entender — hay que simplificarla (por ejemplo, separar mejor los pasos de cobrar seña / entregar / cancelar, o guiarlos como un asistente) en una pasada de UX posterior.
- Pantalla de analíticas (`/analiticas`, spec 011): funciona y está verificada, pero quedó con muchos filtros y tablas en una sola pantalla larga — el cliente ya avisó que se va a revisar el diseño UX/UI más adelante (por ejemplo, separar en pestañas o tarjetas, gráficos en vez de tablas para la evolución diaria).

## 13. Glosario

- **Rubro:** clasificación principal de un producto (por ejemplo, electrónica u hogar). Puede tener subrubros.
- **Movimiento de stock:** cada cambio de stock queda registrado (ingreso, venta, ajuste, merma, anulación). El saldo se calcula a partir de ellos.
- **Sesión de caja:** período entre la apertura y el cierre de la caja de un turno.
- **Pedido:** lista de productos que un cliente encarga. No es una venta hasta que se entrega.
- **Seña:** pago anticipado de un pedido, registrado en la caja abierta del día en que se cobra.
- **Entrega parcial:** conversión en venta de solo algunos ítems de un pedido.
- **Lista de viaje:** productos a comprar en el próximo viaje: los que están bajo el stock mínimo y los que faltan para pedidos pendientes.
- **Ticket:** comprobante interno impreso de 58 mm. No es factura.
