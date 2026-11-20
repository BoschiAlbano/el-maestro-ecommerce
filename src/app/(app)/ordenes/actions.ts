"use server";

import { revalidatePath } from "next/cache";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mlErrorMessage } from "@/lib/mercadolibre/listings";
import { requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { fetchRecentOrders, restockOrder as restock } from "@/lib/mercadolibre/orders/orders";

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
