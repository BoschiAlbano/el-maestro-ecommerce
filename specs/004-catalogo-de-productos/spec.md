# Spec 004 — Catálogo de productos

| | |
|---|---|
| **Estado** | Borrador |
| **Depende de** | 002, 003 |
| **Referencia** | `docs/PROJECT.md`, secciones 4 y 5 |

## 1. Objetivo

Tener el catálogo completo de productos, con marca y rubro, precios en ARS y códigos de barras, listo para vender.

## 2. Alcance

**Incluye:**

- Producto con nombre, marca, rubro, foto, precio de compra, precio de venta y stock mínimo
- Marcas y rubros administrables (el rubro admite subrubros)
- Código de barras: se registra el original o el sistema genera uno propio
- Búsqueda y filtros por nombre, código, marca y rubro
- Importación masiva desde Excel o CSV, con plantilla descargable y detección de filas inválidas
- Etiquetas imprimibles con código de barras
- Historial de cambios de precio
- Activación y desactivación de productos

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

A confirmar en el plan: Brand, Rubro, Product y ProductPriceHistory.

## 10. Preguntas abiertas

- Formato de las etiquetas (tamaño y datos que muestran).
- Cómo se generan los códigos propios para que no choquen con los de origen.
