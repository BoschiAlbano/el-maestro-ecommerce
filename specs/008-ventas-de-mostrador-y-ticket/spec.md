# Spec 008 — Ventas de mostrador y ticket

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 005, 007 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Vender rápido en el mostrador, descontar stock, registrar el cobro en la caja e imprimir el ticket.

## 2. Alcance

**Incluye:**

- Búsqueda por nombre o código y lectura con lector de código de barras USB
- Carrito y cobro en efectivo, transferencia o ambos; sin descuentos
- Descuento de stock y registro en caja en una sola transacción
- Ticket de 58 mm con razón social, número, fecha y hora, empleado, productos con precios, totales y la leyenda DOCUMENTO NO VÁLIDO COMO FACTURA
- Reimpresión con permiso y registro en la auditoría
- Anulación con motivo y permiso, que devuelve el stock
- Canal de la venta (mostrador, WhatsApp, Instagram u otro) y cliente opcional (nombre y teléfono)

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

A confirmar en el plan: Sale, SaleItem y Payment.

## 10. Preguntas abiertas

- Si el ticket de entrega de un pedido muestra la seña aplicada y el saldo.
