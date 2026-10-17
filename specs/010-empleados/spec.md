# Spec 010 — Empleados

| | |
|---|---|
| **Estado** | Verificada |
| **Depende de** | 002 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Llevar el registro de los empleados: sus datos, su usuario del sistema y su turno, y poder darlos de baja cuando dejan de trabajar sin perder su historial.

## 2. Alcance

**Incluye:**

- Ficha del empleado: nombre, teléfono, DNI, fecha de ingreso y turno (mañana o tarde)
- Usuario del sistema asociado, obligatorio (uno existente sin ficha, o uno nuevo creado en el mismo paso, spec 002)
- Edición de los datos de la ficha
- Baja de un empleado: fecha de baja y desactivación de su usuario, sin borrar su historial
- Listado de empleados, activos por defecto, con filtro para ver también los dados de baja

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`. Puntualmente, no incluye fichaje de entrada y salida (decisión 2026-10-17: queda afuera de esta spec; se evalúa como spec aparte si hace falta más adelante) ni comisiones o liquidación de sueldos.

## 3. Historias de usuario

- Como dueño, quiero dar de alta la ficha de un empleado nuevo junto con su usuario, para no repetir el alta en dos lugares distintos.
- Como dueño, quiero completar la ficha de un usuario que ya existe en el sistema, para los casos en que el usuario se creó antes de tener los datos del empleado.
- Como dueño, quiero editar los datos de la ficha de un empleado, para corregir o actualizar su teléfono, turno, etc.
- Como dueño, quiero dar de baja a un empleado que deja de trabajar, para que no pueda seguir iniciando sesión, sin perder el registro de lo que hizo mientras trabajaba.
- Como dueño, quiero ver la lista de empleados activos por defecto, para no mezclarlos con los que ya no trabajan más.

## 4. Requisitos funcionales

- **RF-1.** El sistema permite crear la ficha de un empleado (nombre, teléfono, DNI, fecha de ingreso, turno) vinculada a un usuario del sistema: elegir uno existente que no tenga ficha todavía, o crear uno nuevo (nombre, email, rol, contraseña — spec 002) en el mismo paso.
- **RF-2.** Un usuario no puede tener más de una ficha de empleado.
- **RF-3.** El sistema permite editar los datos propios de la ficha (teléfono, DNI, fecha de ingreso, turno). Los datos de la cuenta de usuario (nombre, email, rol, contraseña) se editan donde ya se editan hoy (spec 002), no desde esta pantalla.
- **RF-4.** El sistema permite dar de baja a un empleado: registra la fecha de baja y desactiva su usuario (no puede volver a iniciar sesión), sin eliminar la ficha ni su historial de ventas, caja, etc.
- **RF-5.** El sistema permite ver la lista de empleados (nombre, teléfono, turno, estado) y el detalle de uno en particular. La lista muestra solo los activos por defecto, con un filtro arriba para ver también los dados de baja o todos (mismo criterio que el filtro de pedidos, spec 009).

## 5. Reglas de negocio

- Todo empleado tiene exactamente un usuario asociado; no existe una ficha sin usuario ni un usuario con dos fichas. **Al revés no**: un usuario no necesita tener una ficha de empleado. El Dueño ya tiene su usuario desde el alta inicial (spec 001/002) y no necesita una ficha para seguir operando el sistema; puede agregarse una si en algún momento quiere llevar su propio turno igual que cualquier empleado, pero nunca es obligatorio.
- El DNI es único entre empleados: no se puede repetir, ni con uno activo ni con uno dado de baja.
- Dar de baja a un empleado desactiva su usuario en el mismo paso (no son dos acciones separadas) — un empleado que ya no trabaja no debería poder seguir iniciando sesión. **Esto es una excepción puntual** a la regla general de la spec 002 (activar/desactivar cualquier usuario es exclusivo del Dueño): acá alcanza con el permiso "anular" de la matriz de Empleados — decisión explícita del cliente (2026-10-17), no un descuido.
- Dar de baja no borra nada: la ficha y el historial de lo que el empleado hizo (ventas, caja, pedidos, etc.) se conservan igual que al desactivar cualquier usuario (spec 002, sección 4).
- No hay reactivación en esta spec: si un ex empleado vuelve a trabajar, se trata como un caso nuevo (fuera de alcance por ahora, se evalúa si aparece el caso real).

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Ver empleados y su ficha | Permiso "ver" en Empleados |
| Crear la ficha de un empleado | Permiso "crear" en Empleados |
| Editar la ficha de un empleado | Permiso "editar" en Empleados |
| Dar de baja a un empleado | Permiso "anular" en Empleados |

## 7. Casos borde y errores

- Se intenta crear una ficha para un usuario que ya tiene una: se rechaza, hay que editar la existente.
- Se intenta crear o editar una ficha con un DNI que ya está en uso: se rechaza.
- Se intenta dar de baja a un empleado que ya está dado de baja: se rechaza.
- Se intenta editar la ficha de un empleado dado de baja: se permite (puede hacer falta corregir un dato histórico), pero no se puede revertir la baja desde acá.

## 8. Criterios de aceptación

- [x] Se puede crear la ficha de un empleado vinculada a un usuario nuevo, en el mismo paso.
- [x] Se puede crear la ficha de un empleado vinculada a un usuario ya existente que no tenía ficha.
- [x] No se puede crear una segunda ficha para el mismo usuario, ni repetir un DNI.
- [x] Se puede editar los datos de la ficha.
- [x] Se puede dar de baja a un empleado: queda con fecha de baja, su usuario no puede volver a iniciar sesión, y su historial se conserva.
- [x] La lista de empleados muestra los activos por defecto, con un filtro para ver también los dados de baja o todos.

## 9. Entidades previstas

A confirmar en el plan: `Employee` (userId único, DNI, teléfono, fecha de ingreso, turno, fecha de baja opcional), vinculado 1 a 1 con `User` (spec 002).

## 10. Decisiones (ya confirmadas con el cliente)

- **Sin fichaje de entrada y salida** en esta spec (2026-10-17).
- **Todo empleado tiene una cuenta de usuario asociada, de forma obligatoria** (2026-10-17) — no hay fichas de empleados sin usuario del sistema.
