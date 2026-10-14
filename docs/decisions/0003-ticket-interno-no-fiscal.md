# 0003 — El ticket es un documento interno, no fiscal

- **Fecha:** 2026-10-14
- **Estado:** Aceptada

## Contexto

El cliente es monotributista y quiere controlar lo que vende y entregar un ticket al consumidor final. No quiere facturación electrónica por ahora.

## Decisión

El sistema no emite comprobantes fiscales. El ticket de 58 mm lleva la leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA". El modelo de datos puede sumar más adelante una tabla de facturas sin rehacer lo existente.

## Consecuencias

- El cliente debe confirmar con su contador si está obligado a facturar. Queda por escrito como responsabilidad del cliente.
- Facturación electrónica ARCA figura como fuera de alcance.
