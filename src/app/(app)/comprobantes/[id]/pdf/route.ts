import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { KIND_TITLE, formatInvoiceNumber } from "@/lib/facturacion/invoice-document";
import { loadInvoiceView } from "@/lib/facturacion/invoice-view-data";
import { InvoicePdfDocument } from "./document";

export const dynamic = "force-dynamic";

/** La factura en A4 (specs/023, RF-19). Con permiso para ver ventas; solo un comprobante autorizado tiene PDF. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.VENTAS, "ver");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const { id } = await params;
  const view = await loadInvoiceView(id);
  if (!view) return new Response("El comprobante no existe.", { status: 404 });
  if (view.status !== "AUTHORIZED" || view.number === null) {
    return new Response("Este comprobante todavía no está emitido.", { status: 409 });
  }

  const buffer = await renderToBuffer(InvoicePdfDocument({ view }));
  const name = `${KIND_TITLE[view.kind].toLowerCase().replace(/ /g, "-").replace("é", "e")}-${formatInvoiceNumber(view.pointOfSale, view.number)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
