# Spec 002 — Usuarios, roles y permisos

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 001 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Que el dueño cree usuarios y roles, y controle qué puede ver y hacer cada uno en cada módulo.

## 2. Alcance

**Incluye:**

- Alta, edición y desactivación de usuarios
- Roles creados por el dueño, con algunos roles de ejemplo cargados de inicio
- Matriz de permisos por módulo y acción: ver, crear, editar, anular y exportar
- Permisos especiales: ver costos y márgenes, anular ventas, ajustar stock, reimprimir tickets, cerrar caja y cambiar precios
- El rol Dueño es fijo: no se puede borrar ni quedar sin permisos
- Verificación de permisos en el servidor y ocultamiento en la interfaz

**No incluye:** ver "Fuera de alcance" en `docs/PROJECT.md`.

## 3. Historias de usuario

- Por completar.

## 4. Requisitos funcionales

- Por completar.

## 5. Reglas de negocio

- Por completar a partir de `docs/PROJECT.md`, sección 5.

## 6. Permisos

| Acción | Quién puede |
|---|---|
| Por completar | |

## 7. Casos borde y errores

- Por completar.

## 8. Criterios de aceptación

- [ ] Por completar.

## 9. Entidades previstas

A confirmar en el plan: Role, Permission y RolePermission; User con su rol.

## 10. Preguntas abiertas

- Qué roles de ejemplo se cargan de inicio (por ejemplo Dueño, Encargado y Cajero).
- Si hacen falta excepciones de permisos por usuario además de los roles.
