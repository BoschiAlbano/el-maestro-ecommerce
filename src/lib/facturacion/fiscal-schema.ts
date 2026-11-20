import { z } from "zod";
import { isValidCuit, onlyDigits } from "./documentos";

// Validación del formulario de datos fiscales del emisor (specs/023, RF-1,
// RF-6, RF-9 y RF-16). Pura: la usan la acción del servidor y las pruebas.

/** ARCA acepta fechas de comprobantes de productos hasta 5 días atrás (prueba técnica, A-10). */
export const MAX_DIAS_PARA_FACTURAR = 5;

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio.`)
    .max(max, `${label} es demasiado largo.`);

/**
 * Lee un monto como se escribe en Argentina: «17.595.182,74» (puntos de miles
 * y coma decimal), pero también «17595182,74» y «17595182.74». Devuelve `null`
 * si no es un número. Con una coma, los puntos son de miles; sin coma, un
 * punto seguido de exactamente tres dígitos («10.000», «10.000.000») también
 * es de miles, y cualquier otro punto es decimal.
 */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/\s/g, "");
  if (!text) return null;
  let normalized: string;
  if (text.includes(",")) normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, "");
  else normalized = text;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

/** Un monto opcional: vacío es «sin valor». */
const optionalAmount = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const number = parseAmount(value);
      if (number === null || number < 0) {
        ctx.addIssue({ code: "custom", message: `${label} tiene que ser un número mayor o igual a cero.` });
        return z.NEVER;
      }
      return number;
    });

const requiredAmount = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const number = parseAmount(value);
      if (number === null || number <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} tiene que ser un número mayor a cero.` });
        return z.NEVER;
      }
      return number;
    });

export const fiscalConfigSchema = z.object({
  razonSocial: requiredText("La razón social", 120),
  cuit: z
    .string()
    .trim()
    .refine(isValidCuit, "El CUIT no es válido. Revisá los 11 números.")
    .transform(onlyDigits),
  domicilioComercial: requiredText("El domicilio comercial", 200),
  iibb: requiredText("El número de Ingresos Brutos", 30),
  inicioActividades: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio de actividades no es válida.")
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "La fecha de inicio de actividades no es válida."),
  puntoDeVenta: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "El punto de venta tiene que ser un número de hasta 5 dígitos.")
    .transform(Number)
    .refine((value) => value >= 1, "El punto de venta tiene que ser mayor a cero."),
  topeAnual: optionalAmount("El tope anual"),
  montoIdentificacion: requiredAmount("El monto desde el que se identifica al comprador"),
  diasParaFacturar: z
    .string()
    .trim()
    .regex(/^\d+$/, "Los días para facturar tienen que ser un número entero.")
    .transform(Number)
    .refine(
      (value) => value <= MAX_DIAS_PARA_FACTURAR,
      `ARCA no acepta facturas de más de ${MAX_DIAS_PARA_FACTURAR} días de antigüedad.`,
    ),
});

export type FiscalConfigInput = z.output<typeof fiscalConfigSchema>;

/** Nombres de los campos que cambiaron, para la auditoría: sin los valores. */
export function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): string[] {
  return Object.keys(after).filter((key) => String(before?.[key] ?? "") !== String(after[key] ?? ""));
}
