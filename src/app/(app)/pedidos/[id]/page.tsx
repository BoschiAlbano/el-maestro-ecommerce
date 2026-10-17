import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { AddItemForm } from "./add-item-form";
import { DepositForm } from "./deposit-form";
import { DeliverForm } from "./deliver-form";
import { CancelOrderForm } from "./cancel-order-form";
import { RemoveItemButton } from "./remove-item-button";
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

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver este pedido.</p>;
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      sales: { where: { voidedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "crear");
  const puedeVender = hasPermission(currentUser, ModuloNegocio.VENTAS, "crear");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "anular");

  const pendingItems = order.items
    .map((item) => ({
      orderItemId: item.id,
      productName: item.product.name,
      salePrice: item.product.salePrice.toNumber(),
      pending: item.quantityOrdered - item.quantityDelivered,
    }))
    .filter((item) => item.pending > 0);

  const depositAmount = order.depositAmount.toNumber();
  const depositApplied = order.depositApplied.toNumber();
  const remainingDeposit = depositAmount - depositApplied;
  const isPending = order.status === "PENDIENTE";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{order.customerName}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customerPhone ?? "Sin teléfono"} · {order.channel ?? "Sin canal"}
          </p>
        </div>
        <Badge
          variant={
            order.status === "PENDIENTE" ? "secondary" : order.status === "CERRADO" ? "default" : "destructive"
          }
        >
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Seña</h2>
        {depositAmount > 0 ? (
          <p className="text-sm">
            Cobrada: ${depositAmount.toFixed(2)} ({order.depositPaymentMethod === "TRANSFERENCIA" ? "Transferencia" : "Efectivo"}
            {order.depositTransferReference ? ` ****${order.depositTransferReference}` : ""}) — Saldo a favor:{" "}
            ${remainingDeposit.toFixed(2)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Este pedido no tiene seña.</p>
        )}
        {isPending && puedeCrear && depositAmount === 0 && <DepositForm orderId={order.id} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Ítems del pedido</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Entregado</TableHead>
              {isPending && puedeCrear && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product.name}</TableCell>
                <TableCell>{item.quantityOrdered}</TableCell>
                <TableCell>{item.quantityDelivered}</TableCell>
                {isPending && puedeCrear && (
                  <TableCell>
                    {item.quantityDelivered === 0 && (
                      <RemoveItemButton orderId={order.id} orderItemId={item.id} />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {isPending && puedeCrear && <AddItemForm orderId={order.id} />}
      </section>

      {isPending && puedeCrear && puedeVender && pendingItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Entregar</h2>
          <DeliverForm orderId={order.id} pendingItems={pendingItems} remainingDeposit={remainingDeposit} />
        </section>
      )}

      {isPending && puedeAnular && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Cancelar pedido</h2>
          <CancelOrderForm orderId={order.id} />
        </section>
      )}

      {order.status === "CANCELADO" && order.cancelReason && (
        <p className="text-sm text-muted-foreground">Motivo de cancelación: {order.cancelReason}</p>
      )}

      {order.sales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Entregas realizadas</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Seña aplicada</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>#{sale.ticketNumber}</TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Argentina/Tucuman",
                    }).format(sale.createdAt)}
                  </TableCell>
                  <TableCell>${sale.total.toFixed(0)}</TableCell>
                  <TableCell>{sale.depositApplied ? `$${sale.depositApplied.toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <a href={`/ventas/${sale.id}/ticket`} className="text-sm text-primary underline">
                      Ver ticket
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
