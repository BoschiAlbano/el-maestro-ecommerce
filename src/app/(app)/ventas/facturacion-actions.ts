"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { invoiceRequestSchema, type InvoiceRequest, type SaleInvoiceInfo } from "@/lib/facturacion/invoice-request";
import {
  authorizeAfterSale,
  describeResult,
  issueInvoiceForExistingSale,
  loadInvoicingAvailability,
} from "@/lib/facturacion/invoices";
import { openArcaSession } from "@/lib/facturacion/arca-session";
import type { InvoiceView } from "@/lib/facturacion/invoice-document";
import { loadInvoiceView } from "@/lib/facturacion/invoice-view-data";

// Acciones de facturación que se piden desde las pantallas de ventas y
// comprobantes (specs/023, RF-15 a RF-17). Todas validan el permiso en el
// servidor (constitución, regla 3) y ninguna lanza por un problema de ARCA.

export type InvoiceActionState = { error?: string; invoice?: SaleInvoiceInfo };

function revalidateInvoicing(saleId?: string | null) {
  revalidatePath("/ventas/historial");
  if (saleId) revalidatePath(`/ventas/historial/${saleId}`);
  revalidatePath("/comprobantes");
}

/** Factura una venta que ya se hizo sin factura (RF-15, RF-16). */
export async function issueInvoiceForSale(saleId: string, request: InvoiceRequest): Promise<InvoiceActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const parsed = invoiceRequestSchema.safeParse(request);
  if (!parsed.success) return { error: "Los datos de la factura no son válidos." };

  const issued = await issueInvoiceForExistingSale({ saleId, receiver: parsed.data.receiver, userId: currentUser.id });
  revalidateInvoicing(saleId);
  if ("error" in issued) return { error: issued.error };
  return { invoice: { id: issued.invoiceId, ...describeResult(issued.result) } };
}

/** Vuelve a intentar un comprobante que quedó pendiente (RF-12). Es seguro repetirla. */
export async function retryInvoice(invoiceId: string): Promise<InvoiceActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, saleId: true } });
  if (!invoice) return { error: "El comprobante no existe." };
  if (invoice.status === "DISCARDED") return { error: "Este comprobante quedó sin efecto." };

  const info = await authorizeAfterSale(invoiceId);
  revalidateInvoicing(invoice.saleId);
  return { invoice: info };
}

/**
 * Calienta la conexión con ARCA cuando la cajera tilda "con factura": el primer
 * llamado tarda varios segundos en frío y así ya está listo al confirmar (plan,
 * riesgo 14). Solo informa si se puede facturar; no devuelve datos del emisor.
 */
export async function warmUpInvoicing(): Promise<{ available: boolean; reason?: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const availability = await loadInvoicingAvailability();
  if (!availability.available) return { available: false, reason: availability.missing[0] };

  try {
    const session = await openArcaSession();
    await session.ensureTicket();
  } catch {
    // El aviso real, si hay algo, aparece al confirmar. Acá solo se intentó adelantar trabajo.
  }
  return { available: true };
}

/** Lo que muestra la ventana de un comprobante. Con permiso para ver ventas (constitución, regla 3). */
export async function getInvoiceView(invoiceId: string): Promise<InvoiceView | null> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "ver");
  return loadInvoiceView(invoiceId);
}
