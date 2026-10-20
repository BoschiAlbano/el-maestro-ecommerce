import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ResetCounts } from "@/lib/system-reset";

/**
 * Tablas de negocio que el reinicio vacía (specs/017, plan sección 3). Los
 * nombres son fijos, no vienen de ninguna entrada del usuario. Todo lo que
 * referencia a estas tablas también está en la lista, así que `CASCADE` no
 * arrastra nada más. Quedan afuera `users`, `roles`, `role_permissions` y
 * `settings`, que se tratan aparte.
 */
const BUSINESS_TABLES = [
  "audit_logs",
  "notifications",
  "ticket_reprints",
  "sale_items",
  "sales",
  "order_items",
  "orders",
  "cash_movements",
  "cash_shifts",
  "stock_entry_items",
  "stock_entries",
  "stock_movements",
  "product_price_history",
  "products",
  "brands",
  "rubros",
  "employees",
] as const;

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

  await tx.user.deleteMany({ where: { id: { not: ownerUserId } } });
  await tx.rolePermission.deleteMany({ where: { role: { isOwnerRole: false } } });
  await tx.role.deleteMany({ where: { isOwnerRole: false } });
}
