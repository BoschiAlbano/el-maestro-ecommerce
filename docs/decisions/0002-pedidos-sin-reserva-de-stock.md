# 0002 — Pedidos sin reserva de stock

- **Fecha:** 2026-10-14
- **Estado:** Aceptada

## Contexto

Los pedidos por encargo pueden tener productos con o sin stock. Se evaluó reservar stock al confirmar el pedido o al llegar la mercadería.

## Decisión

Un pedido es una lista de productos. No reserva stock. La mercadería que llega queda disponible para una venta nueva o para entregar un pedido. Cada producto muestra, solo como dato informativo, las unidades comprometidas en pedidos pendientes.

## Consecuencias

- Una venta de mostrador puede consumir unidades pensadas para un pedido. El dato informativo ayuda a evitarlo, pero no lo bloquea.
- Se simplifican el modelo de stock y los flujos de entrega.
- La entrega es parcial: los ítems entregados salen de pendientes y quedan en el historial.
