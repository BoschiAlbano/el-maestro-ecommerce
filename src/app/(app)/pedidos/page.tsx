import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export default async function PedidosPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los pedidos.</p>;
  }

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "crear");
  const puedeExportar = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "exportar");

  const orders = await prisma.order.findMany({
    include: { user: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Ítems</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Tucuman",
                }).format(order.createdAt)}
              </TableCell>
              <TableCell>{order._count.items}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    order.status === "PENDIENTE"
                      ? "secondary"
                      : order.status === "CERRADO"
                        ? "default"
                        : "destructive"
                  }
                >
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/pedidos/${order.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Todavía no hay pedidos registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
