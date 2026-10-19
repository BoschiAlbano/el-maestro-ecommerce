"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerStockMovement } from "@/lib/stock";
import { registerCashMovement } from "@/lib/cash";
import { computeSaleTotal, validatePayments } from "@/lib/sale";
import { computeDepositApplication, validateOrderItemQuantity } from "@/lib/order";
import { notifyPedidoNuevo } from "@/lib/notifications";

export type ActionState = { error?: string };
export type SearchedProduct = { id: string; name: string; barcode: string; salePrice: number; stock: number };

export async function searchProducts(query: string): Promise<SearchedProduct[]> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  const trimmed = query.trim();
  if (!trimmed) return [];

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [{ name: { contains: trimmed, mode: "insensitive" } }, { barcode: { contains: trimmed } }],
    },
    select: { id: true, name: true, barcode: true, salePrice: true, currentStock: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    salePrice: p.salePrice.toNumber(),
    stock: p.currentStock,
  }));
}

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("La cantidad tiene que ser mayor a cero."),
});

export async function createOrder(
  customerName: string,
  customerPhone: string | undefined,
  channel: string | undefined,
  items: { productId: string; quantity: number }[],
): Promise<ActionState & { orderId?: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  if (!customerName.trim()) return { error: "El nombre del cliente es obligatorio." };

  const parsedItems = z.array(itemSchema).min(1, "Agregá al menos un producto.").safeParse(items);
  if (!parsedItems.success) return { error: parsedItems.error.issues[0]?.message ?? "Ítems inválidos." };

  const productIds = [...new Set(parsedItems.data.map((i) => i.productId))];
  const count = await prisma.product.count({ where: { id: { in: productIds } } });
  if (count !== productIds.length) return { error: "Uno de los productos no existe." };

  const order = await prisma.order.create({
    data: {
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || undefined,
      channel: channel?.trim() || undefined,
      userId: currentUser.id,
      items: { create: parsedItems.data.map((i) => ({ productId: i.productId, quantityOrdered: i.quantity })) },
    },
  });

  await notifyPedidoNuevo(order.id, order.customerName);

  revalidatePath("/pedidos");
  redirect(`/pedidos/${order.id}`);
}

async function getPendingOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "El pedido no existe." as const };
  if (order.status !== "PENDIENTE") return { error: "Este pedido ya no está pendiente." as const };
  return { order };
}

export async function addOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  const result = await getPendingOrder(orderId);
  if ("error" in result) return { error: result.error };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Cantidad inválida." };

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "El producto no existe." };

  // Si el producto ya está en el pedido, se suma a su línea en lugar de crear otra (specs/009, RF-2).
  const existing = await prisma.orderItem.findFirst({ where: { orderId, productId } });
  if (existing) {
    await prisma.orderItem.update({
      where: { id: existing.id },
      data: { quantityOrdered: { increment: quantity } },
    });
  } else {
    await prisma.orderItem.create({ data: { orderId, productId, quantityOrdered: quantity } });
  }
  revalidatePath(`/pedidos/${orderId}`);
  return {};
}

export async function updateOrderItemQuantity(
  orderId: string,
  orderItemId: string,
  quantity: number,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  const result = await getPendingOrder(orderId);
  if ("error" in result) return { error: result.error };

  const item = await prisma.orderItem.findFirst({ where: { id: orderItemId, orderId } });
  if (!item) return { error: "El producto no pertenece a este pedido." };

  const error = validateOrderItemQuantity(quantity, item.quantityDelivered);
  if (error) return { error };

  await prisma.orderItem.update({ where: { id: item.id }, data: { quantityOrdered: quantity } });
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  return {};
}

export async function removeOrderItem(orderId: string, orderItemId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  const result = await getPendingOrder(orderId);
  if ("error" in result) return { error: result.error };

  const item = await prisma.orderItem.findFirst({ where: { id: orderItemId, orderId } });
  if (!item) return { error: "El producto no pertenece a este pedido." };
  // Un producto con entregas no se puede quitar (specs/009, RF-2): su cantidad solo puede bajar hasta lo entregado.
  if (item.quantityDelivered > 0) return { error: "Este producto ya tiene entregas: no se puede quitar del pedido." };

  await prisma.orderItem.delete({ where: { id: item.id } });
  revalidatePath(`/pedidos/${orderId}`);
  return {};
}

export async function payDeposit(
  orderId: string,
  amount: number,
  method: "EFECTIVO" | "TRANSFERENCIA",
  transferReference?: string,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");

  const result = await getPendingOrder(orderId);
  if ("error" in result) return { error: result.error };
  const { order } = result;

  if (order.depositAmount.toNumber() > 0) return { error: "Este pedido ya tiene una seña cobrada." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "El monto tiene que ser mayor a cero." };
  if (method === "TRANSFERENCIA" && !/^\d{4}$/.test(transferReference ?? "")) {
    return { error: "Para transferencia, los últimos 4 dígitos del comprobante son obligatorios." };
  }

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
  if (!shift) return { error: "No hay una caja abierta." };

  await prisma.$transaction(async (tx) => {
    await registerCashMovement(tx, {
      shiftId: shift.id,
      type: "INGRESO",
      amount,
      concept: `Seña pedido de ${order.customerName}`,
      paymentMethod: method,
      transferReference: method === "TRANSFERENCIA" ? transferReference : undefined,
      userId: currentUser.id,
      orderId: order.id,
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        depositAmount: amount,
        depositPaymentMethod: method,
        depositTransferReference: method === "TRANSFERENCIA" ? transferReference : undefined,
        depositPaidAt: new Date(),
      },
    });
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/caja");
  return {};
}

export async function deliverOrderItems(
  orderId: string,
  deliveries: { orderItemId: string; quantity: number }[],
  extraPayments: { method: "EFECTIVO" | "TRANSFERENCIA"; amount: number; transferReference?: string }[],
): Promise<ActionState & { saleId?: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "crear");
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: "El pedido no existe." };
  if (order.status !== "PENDIENTE") return { error: "Este pedido ya no está pendiente." };

  if (deliveries.length === 0) return { error: "Elegí al menos un ítem para entregar." };

  const itemById = new Map(order.items.map((i) => [i.id, i]));
  for (const delivery of deliveries) {
    const item = itemById.get(delivery.orderItemId);
    if (!item) return { error: "Uno de los ítems no pertenece a este pedido." };
    const pending = item.quantityOrdered - item.quantityDelivered;
    if (!Number.isInteger(delivery.quantity) || delivery.quantity <= 0 || delivery.quantity > pending) {
      return { error: "Hay una cantidad inválida: no puede ser más de lo pendiente." };
    }
  }

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
  if (!shift) return { error: "No hay una caja abierta." };

  const products = await prisma.product.findMany({
    where: { id: { in: deliveries.map((d) => itemById.get(d.orderItemId)!.productId) } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const saleTotal = computeSaleTotal(
    deliveries.map((d) => {
      const item = itemById.get(d.orderItemId)!;
      const product = productById.get(item.productId)!;
      return { quantity: d.quantity, unitSalePrice: product.salePrice.toNumber() };
    }),
  );

  const remainingDeposit = order.depositAmount.toNumber() - order.depositApplied.toNumber();
  const { depositApplied, amountToCollect } = computeDepositApplication(remainingDeposit, saleTotal);

  const parsedPayments = z
    .array(
      z.object({
        method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
        amount: z.number().positive(),
        transferReference: z
          .string()
          .trim()
          .regex(/^\d{4}$/)
          .optional(),
      }),
    )
    .safeParse(extraPayments);
  if (!parsedPayments.success) return { error: "Pagos inválidos." };

  if (amountToCollect > 0 && !validatePayments(amountToCollect, parsedPayments.data)) {
    return { error: "Lo que falta cobrar no coincide con los pagos ingresados." };
  }
  if (amountToCollect === 0 && parsedPayments.data.length > 0) {
    return { error: "La seña ya cubre todo esta entrega: no hace falta cobrar nada más." };
  }

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        shiftId: shift.id,
        userId: currentUser.id,
        total: saleTotal,
        orderId: order.id,
        depositApplied,
      },
    });

    for (const delivery of deliveries) {
      const item = itemById.get(delivery.orderItemId)!;
      const product = productById.get(item.productId)!;
      await tx.saleItem.create({
        data: {
          saleId: created.id,
          productId: item.productId,
          quantity: delivery.quantity,
          unitSalePrice: product.salePrice,
          unitCost: product.purchasePrice,
        },
      });
      await registerStockMovement(tx, {
        productId: item.productId,
        type: "VENTA",
        quantity: -delivery.quantity,
        userId: currentUser.id,
        saleId: created.id,
      });
      await tx.orderItem.update({
        where: { id: item.id },
        data: { quantityDelivered: { increment: delivery.quantity } },
      });
    }

    for (const payment of parsedPayments.data) {
      await registerCashMovement(tx, {
        shiftId: shift.id,
        type: "INGRESO",
        amount: payment.amount,
        concept: `Venta #${created.ticketNumber}`,
        paymentMethod: payment.method,
        transferReference: payment.method === "TRANSFERENCIA" ? payment.transferReference : undefined,
        userId: currentUser.id,
        saleId: created.id,
      });
    }

    const updatedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
    const stillPending = updatedItems.some((i) => i.quantityDelivered < i.quantityOrdered);

    await tx.order.update({
      where: { id: order.id },
      data: {
        depositApplied: { increment: depositApplied },
        status: stillPending ? undefined : "CERRADO",
        closedAt: stillPending ? undefined : new Date(),
      },
    });

    return created;
  });

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  revalidatePath("/caja");
  return { saleId: sale.id };
}

export async function cancelOrder(orderId: string, reason: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.PEDIDOS, "anular");

  if (!reason.trim()) return { error: "El motivo es obligatorio." };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "El pedido no existe." };
  if (order.status !== "PENDIENTE") return { error: "Este pedido ya no está pendiente." };

  const remainingDeposit = order.depositAmount.toNumber() - order.depositApplied.toNumber();

  if (remainingDeposit > 0) {
    const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
    if (!shift) return { error: "Queda seña sin devolver: hace falta una caja abierta para hacerlo." };

    await prisma.$transaction(async (tx) => {
      // `remainingDeposit > 0` implica que se cobró una seña de verdad
      // (`payDeposit` siempre guarda el medio junto con el monto).
      await registerCashMovement(tx, {
        shiftId: shift.id,
        type: "EGRESO",
        amount: remainingDeposit,
        concept: `Cancelación pedido de ${order.customerName} — devolución de seña`,
        paymentMethod: order.depositPaymentMethod!,
        transferReference: order.depositTransferReference ?? undefined,
        userId: currentUser.id,
        orderId: order.id,
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELADO",
          // Se devolvió recién por egreso: no queda ningún saldo pendiente.
          depositApplied: order.depositAmount,
          cancelledAt: new Date(),
          cancelledByUserId: currentUser.id,
          cancelReason: reason.trim(),
        },
      });
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELADO",
        cancelledAt: new Date(),
        cancelledByUserId: currentUser.id,
        cancelReason: reason.trim(),
      },
    });
  }

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/caja");
  return {};
}
