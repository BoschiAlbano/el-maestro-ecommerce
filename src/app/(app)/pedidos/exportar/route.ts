import "server-only";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.PEDIDOS, "exportar");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Cliente",
    "Teléfono",
    "Canal",
    "Fecha",
    "Estado",
    "Ítems pedidos",
    "Seña cobrada",
    "Saldo de seña",
  ];

  const rows = orders.map((order) => [
    order.customerName,
    order.customerPhone ?? "",
    order.channel ?? "",
    new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Tucuman",
    }).format(order.createdAt),
    STATUS_LABELS[order.status],
    String(order.items.reduce((sum, item) => sum + item.quantityOrdered, 0)),
    order.depositAmount.toFixed(2),
    order.depositAmount.minus(order.depositApplied).toFixed(2),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pedidos.csv"',
    },
  });
}
