// Datos fiscales del comprador de Mercado Libre, traducidos al comprador de la
// factura (specs/024, RF-4 y RF-5; prueba técnica). Respuesta de
// `GET /orders/billing-info/MLA/{id}` con `x-version: 2`. Pura.
import { z } from "zod";
import { IVA_CONDITIONS, IVA_CONSUMIDOR_FINAL, ivaConditionFromMercadoLibre } from "@/lib/facturacion/iva-conditions";

export const billingInfoSchema = z.object({
  buyer: z.object({
    billing_info: z.object({
      name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      identification: z
        .object({ type: z.string().nullable().optional(), number: z.string().nullable().optional() })
        .nullable()
        .optional(),
      taxes: z
        .object({
          taxpayer_type: z
            .object({ id: z.string().nullable().optional(), description: z.string().nullable().optional() })
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
      address: z
        .object({
          street_name: z.string().nullable().optional(),
          street_number: z.string().nullable().optional(),
          city_name: z.string().nullable().optional(),
          state: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
          zip_code: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
  }),
});

export type BillingInfo = z.infer<typeof billingInfoSchema>;

/** El comprador como lo informa Mercado Libre, en los términos de la factura. */
export type BuyerFiscalData = {
  docType: "NONE" | "DNI" | "CUIT";
  docNumber: string | null;
  name: string | null;
  ivaCondition: number;
  address: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * La condición frente al IVA: el código del tipo de contribuyente es el mismo
 * de ARCA (`05` es Consumidor Final, prueba técnica). Si no es uno de los que
 * usa el sistema, se toma la descripción; sin nada, Consumidor Final (RF-5).
 */
function ivaConditionOf(taxpayer: { id?: string | null; description?: string | null } | null | undefined): number {
  const code = Number.parseInt(clean(taxpayer?.id), 10);
  if (IVA_CONDITIONS.some((c) => c.id === code)) return code;
  if (taxpayer?.description) return ivaConditionFromMercadoLibre(taxpayer.description);
  return IVA_CONSUMIDOR_FINAL;
}

export function readBillingInfo(info: BillingInfo): BuyerFiscalData {
  const billing = info.buyer.billing_info;
  const type = clean(billing.identification?.type).toUpperCase();
  const number = clean(billing.identification?.number).replace(/\D/g, "");
  const docType = number && (type === "DNI" || type === "CUIT" || type === "CUIL") ? (type === "DNI" ? "DNI" : "CUIT") : "NONE";
  const name = [clean(billing.name), clean(billing.last_name)].filter(Boolean).join(" ") || null;

  const address = billing.address;
  const street = [clean(address?.street_name), clean(address?.street_number)].filter(Boolean).join(" ");
  const place = [clean(address?.city_name), clean(address?.state?.name)].filter(Boolean).join(", ");
  const zip = clean(address?.zip_code);
  const fullAddress = [street, place, zip ? `CP ${zip}` : ""].filter(Boolean).join(" · ") || null;

  return {
    docType,
    docNumber: docType === "NONE" ? null : number,
    name,
    ivaCondition: docType === "NONE" ? IVA_CONSUMIDOR_FINAL : ivaConditionOf(billing.taxes?.taxpayer_type),
    address: fullAddress,
  };
}
