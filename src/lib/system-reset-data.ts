import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TABLES, type ResetCounts } from "@/lib/system-reset";


/** Cantidades de lo que se va a borrar, para el resumen previo (RF-3). */
export async function loadResetCounts(ownerUserId: string): Promise<ResetCounts> {
  const [
    products,
    brands,
    rubros,
    sales,
    orders,
    stockEntries,
    cashShifts,
    employees,
    otherUsers,
    otherRoles,
    auditLogs,
    openShifts,
    pendingOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.brand.count(),
    prisma.rubro.count(),
    prisma.sale.count(),
    prisma.order.count(),
    prisma.stockEntry.count(),
    prisma.cashShift.count(),
    prisma.employee.count(),
    prisma.user.count({ where: { id: { not: ownerUserId } } }),
    prisma.role.count({ where: { isOwnerRole: false } }),
    prisma.auditLog.count(),
    prisma.cashShift.count({ where: { closedAt: null } }),
    prisma.order.count({ where: { status: "PENDIENTE" } }),
  ]);

  return {
    products,
    brands,
    rubros,
    sales,
    orders,
    stockEntries,
    cashShifts,
    employees,
    otherUsers,
    otherRoles,
    auditLogs,
    openShift: openShifts > 0,
    pendingOrders,
  };
}

/**
 * Vacía los datos de negocio dentro de la transacción `tx` y deja solo al
 * Dueño `ownerUserId` con su rol (RF-6, RF-7, RF-9). `RESTART IDENTITY`
 * reinicia el contador de tickets (RF-10). No toca `settings`.
 */
export async function wipeBusinessData(tx: Prisma.TransactionClient, ownerUserId: string) {
  await tx.$executeRawUnsafe(`TRUNCATE TABLE ${BUSINESS_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

  // La cuenta de Mercado Libre se conserva (es configuración, specs/019), pero
  // referencia al usuario que la conectó: si fue otro Dueño, pasa a quien
  // reinicia, o borrar a ese usuario fallaría y el reinicio entero volvería atrás.
  await tx.mercadoLibreConnection.updateMany({
    where: { connectedByUserId: { not: ownerUserId } },
    data: { connectedByUserId: ownerUserId },
  });

  await tx.user.deleteMany({ where: { id: { not: ownerUserId } } });
  await tx.rolePermission.deleteMany({ where: { role: { isOwnerRole: false } } });
  await tx.role.deleteMany({ where: { isOwnerRole: false } });
}
