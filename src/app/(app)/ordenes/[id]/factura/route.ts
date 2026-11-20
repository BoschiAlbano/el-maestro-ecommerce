import "server-only";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { invoicePdfFileName } from "@/lib/facturacion/invoice-document";
import { renderInvoicePdf } from "@/lib/facturacion/invoice-pdf";
import { loadInvoiceView } from "@/lib/facturacion/invoice-view-data";

export const dynamic = "force-dynamic";

/**
 * La factura de una orden de Mercado Libre para imprimir (specs/024, RF-17).
 * Por defecto en 10 × 15 cm, como la etiqueta; con `?formato=a4`, la hoja de
 * la spec 023.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.mercadoLibreOrder.findUnique({
    where: { id },
    select: {
      sale: {
        select: {
          invoices: {
            where: { kind: "FACTURA_C", status: { not: "DISCARDED" } },
            select: { id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!order) return new Response("La orden no existe.", { status: 404 });
  const invoiceId = order.sale?.invoices[0]?.id;
  if (!invoiceId) return new Response("La orden todavía no tiene factura.", { status: 409 });

  const view = await loadInvoiceView(invoiceId);
  if (!view || view.status !== "AUTHORIZED" || view.number === null) {
    return new Response("La factura todavía no está autorizada por ARCA.", { status: 409 });
  }

  const a4 = new URL(request.url).searchParams.get("formato") === "a4";
  const pdf = await renderInvoicePdf(view, a4 ? "a4" : "10x15");
  const name = invoicePdfFileName(view).replace(/\.pdf$/, a4 ? "-a4.pdf" : ".pdf");

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
