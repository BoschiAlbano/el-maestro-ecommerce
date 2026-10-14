# Spec 007 — Caja por turnos

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 002, 003 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Controlar el efectivo de cada turno, desde la apertura hasta el cierre con su diferencia.

## 2. Alcance

**Incluye:**

- Apertura con monto inicial
- Una sola caja abierta a la vez; no se vende sin caja abierta
- Ingresos y egresos manuales con concepto obligatorio
- Señas de pedidos y devoluciones de seña como movimientos de caja
- Cierre con efectivo esperado, efectivo contado y diferencia, y total de transferencias como dato informativo
- Resumen de cierre imprimible en formato de 58 mm
- Cierre inmutable: las correcciones van como movimientos con motivo
- Historial de cajas con diferencias por empleado

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

A confirmar en el plan: CashSession y CashMovement.

## 10. Preguntas abiertas

- Si la apertura sugiere como monto inicial el efectivo contado al cierre del turno anterior.
