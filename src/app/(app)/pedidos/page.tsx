import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrdersTable, type OrderRow } from "./orders-table";

const ESTADOS: { value: string; label: string }[] = [
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "CERRADO", label: "Cerrados" },
  { value: "CANCELADO", label: "Cancelados" },
  { value: "__all__", label: "Todos" },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los pedidos.</p>;
  }

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "crear");
  const puedeExportar = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "exportar");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "anular");

  // Por defecto solo los pendientes: son los que el dueño tiene que
  // comprar/entregar — mezclarlos con cerrados y cancelados hace difícil
  // encontrarlos.
  const { estado = "PENDIENTE" } = await searchParams;

  const where: Prisma.OrderWhereInput = {};
  if (estado !== "__all__") where.status = estado as Prisma.OrderWhereInput["status"];

  const orders = await prisma.order.findMany({
    where,
    include: { user: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows: OrderRow[] = orders.map((order) => ({
    id: order.id,
    customerName: order.customerName,
    when: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Tucuman",
    }).format(order.createdAt),
    items: order._count.items,
    status: order.status,
    canCancel: puedeAnular && order.status === "PENDIENTE",
    hasDepositToReturn: order.depositAmount.toNumber() - order.depositApplied.toNumber() > 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pedidos</h1>
        <div className="flex gap-2">
          {puedeExportar && (
            <Link href="/pedidos/exportar" className={cn(buttonVariants({ variant: "outline" }))}>
              Exportar
            </Link>
          )}
          {puedeCrear && (
            <Link href="/pedidos/nuevo" className={cn(buttonVariants())}>
              Nuevo pedido
            </Link>
          )}
        </div>
      </div>

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            name="estado"
            defaultValue={estado}
            items={Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]))}
          >
            <SelectTrigger id="estado" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <OrdersTable
        orders={rows}
        emptyMessage={estado === "PENDIENTE" ? "No hay pedidos pendientes." : "No hay pedidos para este filtro."}
      />
    </div>
  );
}
