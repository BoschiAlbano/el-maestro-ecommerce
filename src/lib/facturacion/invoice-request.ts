import { z } from "zod";

// Lo que viaja entre la pantalla de cobro y las acciones del servidor cuando se
// pide factura (specs/023). Sin dependencias del servidor: lo usan también los
// componentes del navegador.

export const invoiceRequestSchema = z.object({
  receiver: z.object({
    docType: z.enum(["NONE", "DNI", "CUIT"]),
    docNumber: z.string().max(20).optional().nullable(),
    name: z.string().max(120).optional().nullable(),
    ivaCondition: z.number().int().min(1).max(20),
  }),
});

export type InvoiceRequest = z.infer<typeof invoiceRequestSchema>;

/** Lo que la pantalla muestra de la factura de una venta recién hecha. */
export type SaleInvoiceInfo = {
  id: string;
  status: "authorized" | "pending" | "discarded";
  number?: number;
  /** Si quedó pendiente: por qué, en palabras del usuario. */
  reason?: string;
};
