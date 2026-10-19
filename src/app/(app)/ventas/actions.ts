"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerStockMovement } from "@/lib/stock";
import { registerCashMovement } from "@/lib/cash";
import { computeSaleTotal, validatePayments } from "@/lib/sale";

export type SearchedProduct = { id: string; name: string; barcode: string; salePrice: number; stock: number };
export type ConfirmSaleState = { error?: string; saleId?: string };
export type ReprintState = { error?: string };
export type VoidSaleState = { error?: string };

export async function searchProducts(query: string): Promise<SearchedProduct[]> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

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

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("La cantidad tiene que ser mayor a cero."),
});

const paymentSchema = z
  .object({
    method: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    amount: z.number().positive("El monto tiene que ser mayor a cero."),
    transferReference: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Tienen que ser 4 dígitos.")
      .optional(),
  })
  .refine((data) => data.method !== "TRANSFERENCIA" || data.transferReference, {
    message: "Para transferencia, los últimos 4 dígitos del comprobante son obligatorios.",
    path: ["transferReference"],
  });

export async function confirmSale(
  cartItems: { productId: string; quantity: number }[],
  payments: { method: "EFECTIVO" | "TRANSFERENCIA"; amount: number; transferReference?: string }[],
): Promise<ConfirmSaleState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const parsedItems = z.array(cartItemSchema).min(1, "El carrito está vacío.").safeParse(cartItems);
  if (!parsedItems.success) return { error: parsedItems.error.issues[0]?.message ?? "Carrito inválido." };

  const parsedPayments = z
    .array(paymentSchema)
    .min(1, "Agregá al menos una forma de pago.")
    .safeParse(payments);
  if (!parsedPayments.success) {
    return { error: parsedPayments.error.issues[0]?.message ?? "Pagos inválidos." };
  }

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
  if (!shift) return { error: "No hay una caja abierta." };

  const productIds = [...new Set(parsedItems.data.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) return { error: "Uno de los productos no existe." };
  const productById = new Map(products.map((p) => [p.id, p]));

  const total = computeSaleTotal(
    parsedItems.data.map((item) => ({
      quantity: item.quantity,
      unitSalePrice: productById.get(item.productId)!.salePrice.toNumber(),
    })),
  );

  if (!validatePayments(total, parsedPayments.data)) {
    return { error: "Los pagos no suman el total de la venta." };
  }

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: { shiftId: shift.id, userId: currentUser.id, total },
    });

    for (const item of parsedItems.data) {
      const product = productById.get(item.productId)!;
      await tx.saleItem.create({
        data: {
          saleId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitSalePrice: product.salePrice,
          unitCost: product.purchasePrice,
        },
      });
      await registerStockMovement(tx, {
        productId: item.productId,
        type: "VENTA",
        quantity: -item.quantity,
        userId: currentUser.id,
        saleId: created.id,
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

    return created;
  });

  revalidatePath("/ventas/historial");
  revalidatePath("/inventario");
  revalidatePath("/caja");
  return { saleId: sale.id };
}

export async function reprintTicket(saleId: string): Promise<ReprintState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "ver");
  requireSpecialPermission(currentUser, "reimprimirTickets");

  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) return { error: "La venta no existe." };

  await prisma.ticketReprint.create({ data: { saleId, userId: currentUser.id } });
  revalidatePath(`/ventas/historial/${saleId}`);
  return {};
}

export async function voidSale(saleId: string, reason: string): Promise<VoidSaleState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "anular");
  requireSpecialPermission(currentUser, "anularVentas");

  if (!reason.trim()) return { error: "El motivo es obligatorio." };

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, cashMovements: { where: { type: "INGRESO" } } },
  });
  if (!sale) return { error: "La venta no existe." };
  if (sale.voidedAt) return { error: "Esta venta ya estaba anulada." };

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
  if (!shift) return { error: "No hay una caja abierta para registrar la devolución." };

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        voidedAt: new Date(),
        voidedByUserId: currentUser.id,
        voidReason: reason.trim(),
      },
    });

    for (const item of sale.items) {
      await registerStockMovement(tx, {
        productId: item.productId,
        type: "VENTA",
        quantity: item.quantity,
        userId: currentUser.id,
        saleId: sale.id,
      });
    }

    for (const payment of sale.cashMovements) {
      await registerCashMovement(tx, {
        shiftId: shift.id,
        type: "EGRESO",
        amount: payment.amount.toNumber(),
        concept: `Anulación venta #${sale.ticketNumber}`,
        paymentMethod: payment.paymentMethod,
        transferReference: payment.transferReference ?? undefined,
        userId: currentUser.id,
        saleId: sale.id,
      });
    }
  });

  revalidatePath("/ventas/historial");
  revalidatePath(`/ventas/historial/${saleId}`);
  revalidatePath("/inventario");
  revalidatePath("/caja");
  return {};
}

export type TicketData = {
  razonSocial: string | null;
  extraText: string | null;
  ticketNumber: number;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  employee: string;
  voided: boolean;
  items: { id: string; quantity: number; name: string; subtotal: number }[];
  total: number;
  /** Solo en la entrega de un pedido con seña aplicada (specs/009, RF-5). */
  deposit: { applied: number; remaining: number } | null;
};

/** Datos del ticket de una venta para mostrarlo en la ventana modal (specs/008, RF-5 y RF-14). */
export async function getTicketData(saleId: string): Promise<TicketData | null> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.VENTAS, "ver");

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { user: true, items: { include: { product: true } }, order: true },
  });
  if (!sale) return null;

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const applied = sale.depositApplied?.toNumber() ?? 0;
  return {
    razonSocial: settings.razonSocial || null,
    extraText: settings.textoTicketAdicional || null,
    ticketNumber: sale.ticketNumber,
    when: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Tucuman",
    }).format(sale.createdAt),
    employee: sale.user.name,
    voided: sale.voidedAt !== null,
    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      name: item.product.name,
      subtotal: item.quantity * item.unitSalePrice.toNumber(),
    })),
    total: sale.total.toNumber(),
    deposit:
      sale.order && applied > 0
        ? { applied, remaining: sale.order.depositAmount.toNumber() - sale.order.depositApplied.toNumber() }
        : null,
  };
}
