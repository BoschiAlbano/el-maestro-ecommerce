# Spec 003 — Configuración y auditoría

| | |
|---|---|
| **Estado** | Aprobada |
| **Depende de** | 001, 002 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Guardar los datos del negocio y los parámetros del sistema, y registrar las acciones sensibles.

## 2. Alcance

**Incluye:**

- Razón social y texto adicional del ticket
- Parámetros generales: stock mínimo por defecto para productos nuevos
- Registro de auditoría: infraestructura reusable (modelo + función para registrar una entrada) que usan esta y las próximas specs
- Conectado desde ya a las acciones de administración de usuarios y roles que existen hoy (spec 002): alta, edición, desactivación/reactivación de usuarios; alta, edición y borrado de roles
- Consulta del registro de auditoría con filtros por fecha, usuario y acción

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. Tampoco incluye la regla de redondeo de dinero (queda fija por la constitución, regla 6 — no es un parámetro configurable). Las acciones sensibles de negocio (anular venta, ajustar stock, reimprimir ticket, cambiar precio) se conectan a esta misma auditoría cuando se construyan sus specs (005 a 009) — acá queda la infraestructura lista para que las usen.

## 3. Historias de usuario

- Como dueño, quiero cargar la razón social y el texto adicional del ticket, para que salga bien impreso en cada venta.
- Como dueño, quiero definir el stock mínimo por defecto, para no escribirlo a mano en cada producto nuevo.
- Como dueño, quiero que cada alta, baja o cambio de rol de un usuario quede registrado automáticamente, para saber quién hizo qué cambio administrativo y cuándo.
- Como dueño, quiero ver el registro de auditoría con filtros por fecha, usuario y acción, para encontrar algo puntual rápido.
- Como dueño, quiero que nadie pueda editar ni borrar una entrada de auditoría, para que el registro sea confiable.

## 4. Requisitos funcionales

- El sistema permite editar la razón social y el texto adicional del ticket.
- El sistema permite definir el stock mínimo por defecto para productos nuevos.
- La pantalla de configuración tiene además una pestaña **"Sistema"**, solo para el Dueño, que permite reiniciar el sistema borrando todos los datos (spec 017). *(Agregado 2026-10-20.)*
- La pantalla de configuración se organiza en pestañas por tema — **Ticket** (razón social y texto adicional) y **Artículos** (stock mínimo por defecto) — y cada pestaña se guarda por separado. *(Agregado 2026-10-20.)*
- Cada alta, edición (incluido el cambio de nombre de usuario, spec 016), desactivación/reactivación de usuario y cada alta, edición o borrado de rol genera automáticamente una entrada de auditoría, con quién la hizo, qué hizo, cuándo, y el motivo si corresponde.
- El registro de auditoría se puede consultar filtrado por fecha, usuario y tipo de acción, y está paginado de a 20 (conserva los filtros al cambiar de página; antes mostraba solo las últimas 200 entradas). *(Agregado 2026-10-20.)*
- El menú lateral tiene una entrada "Auditoría" (grupo Administración, junto a "Configuración") que lleva a `/configuracion/auditoria`, visible para quien tenga permiso "ver" en Configuración. *(Agregado 2026-10-20: la pantalla existía pero no tenía acceso desde el menú.)*
- Ninguna pantalla permite editar ni borrar una entrada de auditoría ya creada.

## 5. Reglas de negocio

- La razón social y el texto del ticket son un dato único del negocio (no hay multi-sucursal en este alcance).
- El redondeo de dinero queda fijo según la constitución (regla 6); no es un parámetro configurable de esta spec.
- Toda acción sensible queda registrada junto con la acción en sí, no por separado: si el registro de auditoría no se puede guardar, la acción tampoco se guarda (constitución, regla 10, aplicada por analogía a cualquier acción con auditoría obligatoria).
- Una entrada de auditoría, una vez creada, es de solo lectura para siempre.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver/editar razón social, texto del ticket y parámetros generales | Según el permiso del rol en el módulo Configuración (matriz de la spec 002: "ver" y "editar") |
| Ver el registro de auditoría | Según el permiso del rol en el módulo Configuración ("ver") |
| Exportar el registro de auditoría | Según el permiso del rol en el módulo Configuración ("exportar") |
| Generar una entrada de auditoría | Lo hace el sistema automáticamente; no es una acción manual de ningún usuario |

El rol Dueño ya tiene estos permisos por default (spec 002). El dueño puede además otorgárselos a otros roles desde la pantalla de roles, igual que cualquier otro módulo de la matriz.

## 7. Casos borde y errores

- Se intenta editar o borrar una entrada de auditoría desde cualquier pantalla: no existe esa opción en ningún lado, ni para el Dueño.
- Falla el guardado del registro de auditoría al hacer una acción administrativa: la acción completa se revierte, no queda a mitad de camino.
- Se filtra el registro de auditoría por un rango sin resultados: se muestra una lista vacía con un mensaje claro, no un error.
- Un usuario sin el permiso "ver" en Configuración intenta entrar por URL directa: el servidor lo bloquea con un mensaje claro, no la interfaz.

## 8. Criterios de aceptación

- [ ] Se puede editar la razón social, el texto del ticket y el stock mínimo por defecto, y queda guardado.
- [ ] Crear, editar, desactivar/reactivar un usuario genera una entrada de auditoría con usuario, fecha/hora, acción y datos relevantes.
- [ ] Crear, editar o borrar un rol genera una entrada de auditoría.
- [ ] El registro de auditoría se puede filtrar por fecha, usuario y acción, y los resultados son correctos.
- [ ] No hay ninguna forma de editar o borrar una entrada de auditoría desde la interfaz.
- [ ] Un usuario sin permiso de "ver" en Configuración no puede ver ni la pantalla de parámetros ni la de auditoría, probado por URL directa.

## 9. Entidades previstas

A confirmar en el plan: `Setting` (razón social, texto del ticket, stock mínimo por defecto — fila única, no clave/valor genérico) y `AuditLog` (usuario, acción, fecha, motivo/detalle).

## 10. Decisiones (ya confirmadas con el cliente)

- La regla de redondeo **no** es un parámetro configurable: queda fija por la constitución.
- Se audita desde ya la administración de usuarios y roles (spec 002), aunque la constitución no las nombra explícitamente en su lista de acciones sensibles — mismo espíritu, y permite probar esta spec de punta a punta con datos reales hoy.
- Datos adicionales del ticket además de los acordados (ej. dirección o teléfono del negocio): no se agregan por ahora — el texto adicional del ticket (campo libre) ya cubre ese caso sin necesitar campos nuevos.
