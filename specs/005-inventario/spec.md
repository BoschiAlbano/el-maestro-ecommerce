# Spec 005 — Inventario

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 004 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Saber cuánto hay de cada producto y por qué cambió, con trazabilidad completa.

## 2. Alcance

**Incluye:**

- Stock por movimientos: ingreso inicial, ingreso por compra, venta, anulación de venta, ajuste y merma
- Ajustes y mermas con motivo y permiso
- Conteo físico: contar, comparar contra el sistema y aplicar la diferencia
- Carga inicial del stock
- Alertas de stock bajo en pantalla según el mínimo de cada producto
- Dato informativo de unidades comprometidas en pedidos pendientes (no reserva stock)
- Historial de movimientos de cada producto

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

A confirmar en el plan: StockMovement, StockBalance, StockCount y StockCountItem.

## 10. Preguntas abiertas

- Si el margen se calcula con el último precio de compra o con un costo promedio. Afecta qué costo se guarda en cada movimiento.
