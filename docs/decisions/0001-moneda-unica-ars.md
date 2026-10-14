# 0001 — Moneda única: pesos argentinos

- **Fecha:** 2026-10-14
- **Estado:** Aceptada

## Contexto

El cliente compra en dólares, pero define precios y lleva su operación en pesos. Se evaluó un motor de precios con dólar blue y margen porcentual.

## Decisión

El sistema trabaja solo en ARS. Cada producto tiene precio de compra y precio de venta en pesos, cargados a mano. No hay tipo de cambio, margen automático ni recálculo masivo.

## Consecuencias

- Se simplifica el modelo de datos y la interfaz.
- El margen se calcula con el precio de compra cargado, que se actualiza en cada ingreso de mercadería.
- Un conversor de dólares y una calculadora de precios quedan como posible segunda fase.
