# Guía rápida — Facturación electrónica

> Para quien atiende el mostrador y para el Dueño. Es la versión corta; el detalle está en `specs/023-facturacion-electronica-arca/spec.md`.

## Cobrar con factura (mostrador)

1. Armá la venta como siempre y apretá **Cobrar**.
2. En la ventana de cobro, tildá **Emitir factura**. Viene apagado: lo decidís vos en cada venta. Si la opción no aparece, la facturación no está lista (avisale al Dueño).
3. Elegí a quién:
   - **Consumidor Final**: no hace falta ningún dato. Solo si el total llega al monto que fijó el Dueño, el sistema pide identificar al comprador.
   - **Identificar al comprador**: DNI o CUIT, nombre o razón social y su condición frente al IVA.
4. Confirmá la venta. Se abre la **factura**: **Imprimir** (térmica de 58 mm) o **PDF** (para mandar por mail o WhatsApp).

## Si ARCA no responde

La **venta nunca se frena**: queda hecha y cobrada. La factura queda **pendiente** con el motivo, y podés:

- apretar **Reintentar** en la misma ventana,
- o más tarde, entrar a **Ventas → Historial → la venta → Facturación → Reintentar**.

Mientras tanto, el ticket sirve como constancia de la venta. El Dueño ve un aviso en la campanita mientras haya comprobantes pendientes.

## Facturar una venta que ya se hizo

**Ventas → Historial →** la venta **→ Facturación → Facturar esta venta**. Se puede hasta los días que fijó el Dueño (máximo 5: ARCA no acepta más) y siempre sale con la **fecha de hoy**.

## Anular una venta facturada

Anulá la venta como siempre. Si tenía factura emitida, el sistema emite solo la **nota de crédito** que la deja sin efecto. Si la factura todavía estaba pendiente, se averigua en ARCA si había llegado a emitirse: si sí, se anula con la nota; si no, se descarta y no queda nada fiscal.

## Pedidos

Al **Entregar** un pedido, el cobro también ofrece **Emitir factura**: sale por el total de lo que se entrega, sin descontar la seña. Aunque la seña cubra todo y no haya nada que cobrar, la ventana se abre igual para poder facturar.

## El Dueño

| Qué | Dónde |
|---|---|
| Datos del emisor, certificados, pasar de pruebas a real, probar la conexión | **Configuración → Facturación** |
| Lista de comprobantes, totales, acumulado contra el tope del monotributo, Excel para el contador | **Comprobantes** |
| Avisos de certificado por vencer, comprobantes pendientes y 80 % del tope | Campanita |

- **Modo de pruebas**: las facturas llevan la leyenda *COMPROBANTE DE PRUEBA, SIN VALIDEZ FISCAL* y no cuentan para el tope. Es el modo con el que se prueba todo.
- **Modo real**: solo se puede activar en el sitio publicado. Desde ahí cada factura es real e informa a ARCA.
- **El tope del monotributo** solo avisa al 80 %: nunca impide facturar.
- **Reiniciar el sistema** con facturas reales emitidas se puede, pero **no las anula en ARCA**: antes, descargá el Excel desde Comprobantes.
