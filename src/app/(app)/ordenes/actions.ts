"use server";

import { revalidatePath } from "next/cache";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mlErrorMessage } from "@/lib/mercadolibre/listings";
import { requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { fetchRecentOrders, restockOrder as restock } from "@/lib/mercadolibre/orders/orders";
import {
  loadInvoiceDraft,
  prepareShipment,
  retryOrderInvoice,
  type InvoiceDraft,
  type PrepareResult,
} from "@/lib/mercadolibre/orders/order-invoice";

// Acciones de la pantalla de órdenes (specs/022, sección 6). Todas validan el
// permiso en el servidor.

export type OrderActionState = { error?: string; success?: string };

/** «Buscar órdenes nuevas» (RF-14). */
export async function fetchOrdersNow(): Promise<OrderActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  const connection = await requireMlConnection();
  if (!connection.ok) return { error: connection.error };

  try {
    const summary = await fetchRecentOrders({ force: true });
    revalidatePath("/ordenes");
    if (summary.skipped === "no_start_date") {
      return { error: "Falta la fecha de inicio en Configuración > Mercado Libre: hasta entonces no se registra ninguna compra." };
    }
    return {
      success:
        summary.registered === 0
          ? "No había compras nuevas."
          : `Se ${summary.registered === 1 ? "registró 1 compra nueva" : `registraron ${summary.registered} compras nuevas`}.`,
    };
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }
}

/** «Reingresar al stock» (RF-20). */
export async function restockOrder(orderId: string, quantities: Record<string, number>): Promise<OrderActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  requireSpecialPermission(currentUser, "ajustarStock");

  const result = await restock(orderId, quantities, currentUser.id);
  if (result.error) return { error: result.error };
  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/inventario");
  return { success: `Se reingresaron ${result.restocked} ${result.restocked === 1 ? "unidad" : "unidades"} al stock.` };
}

/** Fecha desde la que se registran las compras (RF-9b). */
export async function saveOrdersStartDate(dateKey: string | null): Promise<OrderActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  let date: Date | null = null;
  if (dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { error: "La fecha no es válida." };
    // Medianoche de Tucumán (UTC−3), guardada en UTC (constitución, regla 9).
    date = new Date(`${dateKey}T03:00:00.000Z`);
  }
  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { mlOrdersStartDate: date },
    create: { id: "singleton", mlOrdersStartDate: date },
  });
  revalidatePath("/configuracion");
  return {
    success: date
      ? "Listo: se registran las compras de Mercado Libre desde esa fecha."
      : "Sin fecha: no se registra ninguna compra de Mercado Libre.",
  };
}

// ---------------------------------------------------------------------------
// Factura de la orden (specs/024, plan sección 3.2 y 4)
// ---------------------------------------------------------------------------

/** Al abrir «Preparar envío»: la factura que ya tiene, o la propuesta con los datos de Mercado Libre. */
export async function loadInvoiceDraftAction(orderId: string): Promise<InvoiceDraft> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  return loadInvoiceDraft(orderId);
}

export type ReceiverFormInput = {
  docType: "NONE" | "DNI" | "CUIT";
  docNumber: string;
  name: string;
  ivaCondition: number;
  address: string;
};

/** «Confirmar y emitir» en «Preparar envío» (RF-1 a RF-13). */
export async function prepareShipmentAction(orderId: string, receiver: ReceiverFormInput): Promise<PrepareResult> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");

  if (!["NONE", "DNI", "CUIT"].includes(receiver.docType) || !Number.isInteger(receiver.ivaCondition)) {
    return { error: "Los datos del comprador no son válidos." };
  }
  const identified = receiver.docType !== "NONE";
  const result = await prepareShipment({
    orderId,
    userId: currentUser.id,
    receiver: {
      docType: receiver.docType,
      docNumber: identified ? String(receiver.docNumber ?? "").slice(0, 20) : null,
      name: identified ? String(receiver.name ?? "").slice(0, 120) : null,
      ivaCondition: receiver.ivaCondition,
      address: String(receiver.address ?? "").trim().slice(0, 200) || null,
    },
  });
  revalidateOrder(orderId);
  return result;
}

/** «Reintentar» la factura pendiente de ARCA o la subida a Mercado Libre (RF-12, RF-14). */
export async function retryOrderInvoiceAction(orderId: string): Promise<PrepareResult> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const result = await retryOrderInvoice(orderId);
  revalidateOrder(orderId);
  return result;
}

function revalidateOrder(orderId: string) {
  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  revalidatePath("/comprobantes");
}
