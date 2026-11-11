# Investigación: tecnologías para Mercado Libre y factura electrónica

| | |
|---|---|
| **Fecha** | 2026-11-10 |
| **Para** | Planes técnicos de las specs 019 a 024 |
| **Estado** | Relevamiento. Ninguna biblioteca se instaló ni se probó. |

Complementa `2026-11-10-mercado-libre-y-arca.md`, que cubre qué impone cada plataforma. Acá queda **con qué** se construye. Las decisiones finales se toman en el `plan.md` de cada spec.

## Resumen

- **Mercado Libre: sin SDK.** El SDK oficial está abandonado. Se escribe un cliente propio y chico sobre `fetch`.
- **ARCA: una biblioteca, detrás de una interfaz propia.** La candidata es `@arcasdk/core`. Si no pasa la prueba, se reemplaza por una implementación directa.
- **Dependencias nuevas previstas: dos o tres.** `@arcasdk/core`, `qrcode` y posiblemente `sharp`. El resto ya está en el proyecto o viene con Node.

---

## 1. Lo que ya tiene el proyecto y se reutiliza

| Ya instalado | Para qué sirve acá |
|---|---|
| Next.js 16.4.1 (Route Handlers, Server Actions) | Dirección de retorno de Mercado Libre, recepción de avisos, tareas programadas. |
| `after` de `next/server` | Confirmar el aviso de Mercado Libre de inmediato y procesarlo después de responder. Verificado en la guía local de esta versión (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`): funciona en Route Handlers y corre hasta el tiempo máximo de la ruta. |
| Prisma 7 + Postgres (Supabase) | Tablas nuevas, cola de avisos, bloqueo para renovar la autorización, numeración y estados de comprobantes. |
| Supabase Storage | Fotos adicionales de las publicaciones. Mercado Libre acepta fotos por dirección pública. |
| `zod` 4 | Validar lo que devuelven Mercado Libre y ARCA antes de usarlo. |
| `decimal.js` | Importes de facturas, comisiones y netos. |
| `@react-pdf/renderer` 4.9 | PDF A4 de la factura. Ya se usa en la exportación de analíticas. |
| `exceljs` | Exportación de comprobantes para el contador. |
| `vitest` | Pruebas unitarias, con las respuestas externas simuladas. |
| Impresión por CSS del ticket de 58 mm | Versión de 58 mm de la factura, con el mismo mecanismo del ticket. |
| `node:crypto` (viene con Node) | Cifrado de la autorización guardada, verificación del retorno de Mercado Libre y PKCE. |

---

## 2. Mercado Libre

### 2.1 SDK oficial: descartado

| Opción | Estado | Veredicto |
|---|---|---|
| `mercadolibre/nodejs-sdk` (npm `mercadolibre-nodejs-sdk` 3.0.1) | Repositorio **archivado el 10/02/2022**. Su README dice que dejaron de mantener los SDK en abril de 2021 y que el proyecto "no es funcional". Última publicación en npm: mayo de 2022. | No usar. |
| `mercadolibre` 0.0.13 (de un tercero) | Sin cambios desde junio de 2022. | No usar. |
| `@ar-agents/mercadolibre`, `meli-node-sdk-unnoficial` | De terceros, sin relación con Mercado Libre. El segundo se presenta como proyecto educativo. | No usar. |
| `mercadopago` (SDK oficial de Mercado Pago) | Vigente, pero es para cobros. | No aplica: no integramos Mercado Pago. |

Mercado Libre recomienda usar directamente su documentación y su API.

### 2.2 Qué se construye: un cliente propio

Un módulo interno sobre `fetch` (incluido en Node), con las respuestas validadas con `zod`. Son pocas operaciones:

| Para | Operaciones de la API |
|---|---|
| Conexión (019) | Autorización inicial y renovación; datos de la cuenta; avisos perdidos. |
| Publicación (020) | Predictor de categoría; características de la categoría; alta, edición, pausa y cierre de publicaciones; descripción; fotos; costos por vender. |
| Stock (021) | Lectura y actualización de la cantidad disponible. |
| Órdenes (022) | Orden; paquete de compra; búsqueda de órdenes por fecha; envío, plazo de despacho y etiqueta en PDF. |
| Factura (024) | Datos fiscales del comprador; subida, consulta y borrado del PDF de la factura. |

Lo que tiene que resolver ese cliente:

- **Renovación con bloqueo.** La credencial de renovación es de un solo uso. Dos renovaciones simultáneas rompen la conexión. Se serializa con un bloqueo en la base.
- **Autorización cifrada en reposo.** AES-256-GCM con `node:crypto` y la clave en una variable de entorno. Alternativa: Supabase Vault. No hace falta una biblioteca.
- **Reintentos y límite de consultas.** Mercado Libre responde con un error específico cuando se supera el límite. Se resuelve con una espera creciente propia; `p-retry` es una opción si se prefiere no escribirla.
- **Operaciones repetibles.** Publicar y registrar una orden tienen que poder reintentarse sin duplicar.

### 2.3 Avisos

- Route Handler público que valida la forma del aviso, lo guarda y responde. El procesamiento va en `after`.
- La tabla de avisos funciona como cola: lo que `after` no llegue a procesar lo toma la pasada diaria o el botón manual.
- Filtro opcional por las direcciones de red que publica Mercado Libre.
- Límite a vigilar: responder en menos de 500 ms desde Vercel en São Paulo, incluido el arranque en frío. **Es el punto de mayor riesgo técnico de la spec 019 y se mide en la prueba técnica.**

### 2.4 Desarrollo y pruebas

- **Usuarios de prueba** de Mercado Libre sobre la plataforma real (no hay ambiente separado).
- **Dirección pública con https para desarrollo local:** un túnel (por ejemplo `cloudflared` o `ngrok`) o los despliegues de vista previa de Vercel.
- **Servidor MCP de Mercado Libre:** la documentación oficial lo lista. Puede servir para consultar la documentación mientras se desarrolla. No es parte del sistema. Sin evaluar.

---

## 3. Factura electrónica (ARCA)

ARCA expone servicios SOAP. Hay que resolver: firmar el pedido de acceso con el certificado, guardar el permiso temporal (12 horas), pedir la autorización del comprobante y consultar comprobantes ya emitidos.

### 3.1 Opciones

| Opción | Datos (npm, 2026-11-10) | A favor | En contra |
|---|---|---|---|
| **`@arcasdk/core`** | 2.0.2, septiembre 2026. Continuación de `afip.ts`. Unas 200 estrellas. | Conexión directa a ARCA, "sin intermediarios". TypeScript. Certificado y clave como texto (sirve para variables de entorno). Declara soporte para entornos sin disco. Modo de prueba y real. | Un solo mantenedor. Licencia ISC en npm y MIT en el repositorio. Cómo guarda el permiso temporal no está documentado en el README. |
| `afip.ts` | 3.2.2, diciembre 2025. | Es la versión anterior de la misma biblioteca. | Reemplazada por `@arcasdk/core`. |
| `facturajs` | 0.4.3, julio 2026. | Activa. Tipos generados desde la definición oficial del servicio. Trae una opción para la incompatibilidad de cifrado con los servidores de ARCA en versiones nuevas de Node. | Menos completa. Sin licencia declarada en npm. |
| `@arca-sdk/javascript` | 1.0.0, mayo 2026. | Permite inyectar el permiso temporal. | Muy nueva. |
| `@afipsdk/afip.js` | 1.3.0, noviembre 2026. | Popular y bien documentada. | Es el cliente de un servicio comercial. **Sin verificar hoy:** hasta donde sé, las versiones actuales pasan por los servidores de esa empresa, con cuenta y límites propios, y el certificado queda de su lado. |
| Implementación propia con `soap` + `node-forge` | `soap` 1.14.0 (octubre 2026), `node-forge` 1.4.3 (noviembre 2026). | Control total; son las mismas piezas que usa `@arcasdk/core`. | Más trabajo y más superficie para errores. |

### 3.2 Recomendación

Usar **`@arcasdk/core` detrás de una interfaz propia** ("emitir comprobante", "consultar último número", "consultar comprobante"), para poder cambiarla sin tocar el resto. Descartar `@afipsdk/afip.js` salvo que se confirme que no depende de un tercero: no conviene que el certificado fiscal del cliente pase por otra empresa.

Antes de aprobar el plan de la spec 023, probar en el ambiente de pruebas de ARCA, con el CUIT del desarrollador:

1. Que el **permiso temporal se pueda guardar en la base**. Vercel no tiene disco persistente, y pedir un permiso nuevo mientras el anterior sigue vigente da error.
2. Que el certificado y la clave se carguen desde variables de entorno.
3. Que conecte desde la versión de Node de Vercel, sin el error de cifrado que reportan otras bibliotecas.
4. Que permita informar la condición frente al IVA del comprador.
5. Que permita consultar un comprobante por número, para el control de duplicados.
6. Emitir una factura C y su nota de crédito.

Si falla alguno de los primeros tres puntos, se pasa a la implementación propia.

### 3.3 Comprobante: PDF y QR

| Necesidad | Con qué |
|---|---|
| PDF A4 | `@react-pdf/renderer`, ya instalado. Sin imágenes pesadas, para quedar muy por debajo del límite de 1 MB de Mercado Libre. |
| Versión de 58 mm | HTML y CSS, como el ticket actual. |
| Código QR | `qrcode` 1.5.4 (MIT). El contenido es una dirección de ARCA con los datos del comprobante codificados, según la especificación oficial. |
| Guardar el PDF | No hace falta: se regenera a partir de los datos guardados del comprobante. |

`@arcasdk/pdf` (0.2.1, septiembre 2026) genera el PDF de comprobantes, pero es muy nueva y ya tenemos con qué hacerlo.

---

## 4. Fotos de las publicaciones

- Mercado Libre acepta la foto por dirección pública o por subida directa. Las fotos ya viven en Supabase Storage, así que alcanza con pasar la dirección.
- Para validar tamaño mínimo y formato antes de publicar: `sharp` 0.35.5. Ya está en `node_modules` como dependencia de Next; habría que declararla como dependencia directa.

---

## 5. Hosting: límites del plan gratuito de Vercel

| Límite | Valor | Fuente |
|---|---|---|
| Frecuencia de tareas programadas | Mínimo una vez por día cada una; la hora no es exacta (puede correrse casi una hora). | Documentación de Vercel. |
| Cantidad de tareas programadas | 100 por proyecto, según la página de uso de tareas programadas. | **A verificar.** La spec 018 anotó "una por día como máximo". |
| Duración máxima de una función | 300 segundos según la mayoría de las fuentes; hay páginas que indican valores distintos. | **A verificar.** |
| Uso | El plan gratuito es para uso personal no comercial. | `docs/PROJECT.md`, sección 10. |

**Posibilidad a verificar:** si el plan gratuito admite varias tareas distintas, cada una diaria, se pueden programar a horas diferentes y lograr varias pasadas de recuperación por día sin costo. Si se confirma, mejora las specs 019, 021 y 022.

---

## 6. Variables de entorno nuevas (tentativas)

Nombres a definir en los planes. Todas van en `.env.local` y en Vercel, nunca en el repositorio.

| Para | Qué guarda |
|---|---|
| Mercado Libre | Identificador y clave secreta de la aplicación; dirección de retorno. |
| Cifrado | Clave para cifrar la autorización guardada. |
| ARCA | Certificado, clave privada y modo (prueba o real). |

El CUIT, el punto de venta y los demás datos fiscales no son secretos: van en Configuración.

---

## 7. Lo que no hace falta

- **Un servicio de colas** (como los de mensajería en la nube): la tabla de avisos alcanza para este volumen.
- **Mercado Pago:** no se integra.
- **Un servicio de facturación de terceros:** se decidió emitir directo contra ARCA (decisión 0005).
- **Una biblioteca para la autorización de Mercado Libre:** son dos pedidos HTTP.

---

## 8. Fuentes

- [SDK de Node de Mercado Libre, archivado](https://github.com/mercadolibre/nodejs-sdk)
- [`@arcasdk/core`](https://github.com/ralcorta/arcasdk)
- [`@afipsdk/afip.js`](https://github.com/AfipSDK/afip.js)
- [`facturajs`](https://github.com/emilioastarita/facturajs)
- [Límites de funciones en Vercel](https://vercel.com/docs/functions/limitations)
- [Tareas programadas en Vercel: uso y precios](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)
- [Plan gratuito de Vercel](https://vercel.com/docs/plans/hobby)
- Registro de npm, consultado el 2026-11-10 para versiones y fechas.
- Guía local de Next.js 16.4.1 en `node_modules/next/dist/docs/`.
