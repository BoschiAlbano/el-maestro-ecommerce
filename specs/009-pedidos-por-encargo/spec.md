# Spec 009 — Pedidos por encargo

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 005, 007, 008 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Gestionar lo que los clientes encargan por WhatsApp y redes, tengan o no stock el producto.

## 2. Alcance

**Incluye:**

- Pedido con cliente (nombre y teléfono), canal, productos y notas
- Productos con o sin stock; el pedido no reserva stock
- Dato informativo de unidades comprometidas por producto
- Seña en efectivo o transferencia, cobrada con la caja abierta
- Entrega parcial: se eligen ítems y se convierten en venta; los entregados salen de pendientes y quedan en el historial
- Cierre automático del pedido cuando no queda nada pendiente
- Cancelación con devolución de la seña como egreso con motivo
- Exportación de la lista de pedidos

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

A confirmar en el plan: Order, OrderItem y OrderDeposit (seña), con vínculo a Sale.

## 10. Preguntas abiertas

- Si se entrega un comprobante al cobrar la seña.
- Estados del pedido (por ejemplo pendiente, parcialmente entregado, entregado y cancelado).
- Qué se hace con el saldo a favor si el pedido se cierra con excedente de seña.
