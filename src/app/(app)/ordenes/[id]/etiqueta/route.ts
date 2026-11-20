import "server-only";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { mlErrorMessage } from "@/lib/mercadolibre/listings";
import { cropLabelTo10x15 } from "@/lib/mercadolibre/orders/label";
import { getLabelPdf } from "@/lib/mercadolibre/orders/orders-api";
import { NOT_YET_SHIPPED } from "@/lib/mercadolibre/orders/order-status";

export const dynamic = "force-dynamic";

/**
 * La etiqueta de envío de una orden (specs/022, RF-16 y RF-18). Por defecto en
 * 10 × 15 cm para la impresora de etiquetas; con `?formato=a4`, la hoja de
 * Mercado Libre tal cual.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.mercadoLibreOrder.findUnique({ where: { id } });
  if (!order) return new Response("La orden no existe.", { status: 404 });
  if (order.fraudRisk) {
    return new Response("Mercado Libre marcó esta compra con riesgo de fraude: no la despaches.", { status: 409 });
  }
  if (!order.mlShipmentId) return new Response("Esta compra no usa Mercado Envíos: no tiene etiqueta.", { status: 409 });
  if (!NOT_YET_SHIPPED.includes(order.status)) {
    return new Response("La compra ya no está para preparar: no se puede imprimir la etiqueta.", { status: 409 });
  }

  let pdf: Uint8Array | null;
  try {
    pdf = await getLabelPdf(order.mlShipmentId);
  } catch (error) {
    return new Response(mlErrorMessage(error), { status: 502 });
  }
  if (!pdf) return new Response("Mercado Libre todavía no tiene lista la etiqueta. Probá de nuevo en unos minutos.", { status: 409 });

  const a4 = new URL(request.url).searchParams.get("formato") === "a4";
  let body = pdf;
  if (!a4) {
    try {
      body = await cropLabelTo10x15(pdf);
    } catch {
      return new Response("No se pudo armar la etiqueta de 10 × 15. Probá con la hoja A4.", { status: 500 });
    }
  }

  await prisma.$transaction([
    prisma.mercadoLibreOrder.update({
      where: { id: order.id },
      data: { labelPrintedAt: new Date(), labelPrintedByUserId: currentUser!.id },
    }),
    prisma.mercadoLibreOrderEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        detail: `Etiqueta ${a4 ? "en hoja A4" : "de 10 × 15"} descargada por ${currentUser!.name}.`,
      },
    }),
  ]);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiqueta-${order.mlShipmentId}${a4 ? "-a4" : ""}.pdf"`,
    },
  });
}
