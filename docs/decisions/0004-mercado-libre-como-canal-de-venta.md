# 0004 — Mercado Libre como canal de venta integrado

- **Fecha:** 2026-11-10
- **Estado:** Aceptada

## Contexto

Con el sistema ya en uso, el cliente pidió vender por Mercado Libre desde el mismo sistema: publicar sus productos, mantener el stock sincronizado y recibir las órdenes. El alcance original dejaba las integraciones fuera. El negocio todavía no vende en Mercado Libre.

## Decisión

Se amplía el alcance con las specs 019 a 022:

- El dueño elige **producto por producto** qué se publica.
- *(Cambio 2026-11-11.)* El cliente empieza a vender en Mercado Libre por su cuenta antes de que el sistema esté terminado. El sistema **vincula las publicaciones existentes** con sus productos, además de crear publicaciones nuevas. Las compras anteriores a la puesta en marcha no se traen.
- El **stock del sistema es la fuente de verdad**; Mercado Libre recibe la cantidad, nunca la define.
- Cada compra en Mercado Libre entra como una **venta de un canal propio**, que no pasa por la caja del local.
- Las ventas de Mercado Libre se ven en las **analíticas** junto con las del local, con un filtro por origen.
- La aplicación ante Mercado Libre se registra con la **cuenta del cliente**, y solo el rol Dueño conecta o desconecta la cuenta.
- Se sigue en el **plan gratuito de Vercel**.

## Consecuencias

- Es un cambio de alcance: se cotiza aparte.
- La regla 11 de la constitución (no se vende sin caja abierta) exceptúa las ventas de Mercado Libre. El cliente lo aprobó el 2026-11-10 y ya está aplicado.
- El producto necesita datos que hoy no tiene: categoría, características, más fotos, descripción, medidas del paquete y un precio propio para Mercado Libre.
- Con una sola tarea programada por día, los avisos perdidos de Mercado Libre se recuperan una vez por día. Las specs 021 y 022 lo compensan con controles que corren cuando alguien usa el sistema.
- La sincronización reduce la sobreventa pero no la elimina.
- Quedan fuera: preguntas y mensajes de compradores, reclamos y devoluciones, promociones, publicidad, depósito de Mercado Libre y otros marketplaces.
- Antes de aprobar los planes hace falta una prueba técnica con usuarios de prueba, que requiere una cuenta de Mercado Libre con los datos validados.
