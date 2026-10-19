import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Panel, StatCard } from "@/components/stat-card";
import { AddItemForm } from "./add-item-form";
import { DepositDialog } from "./deposit-dialog";
import { DeliverDialog } from "./deliver-dialog";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { QuantityStepper } from "./quantity-stepper";
import { RemoveItemButton } from "./remove-item-button";
import { TicketButton } from "../../ventas/ticket-button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

const METHOD_LABELS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Tucuman",
  }).format(date);
}

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver este pedido.</p>;
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: { include: { product: true } },
      sales: { where: { voidedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "crear");
  const puedeVender = hasPermission(currentUser, ModuloNegocio.VENTAS, "crear");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.PEDIDOS, "anular");

  const lines = order.items.map((item) => {
    const price = item.product.salePrice.toNumber();
    return {
      id: item.id,
      name: item.product.name,
      price,
      ordered: item.quantityOrdered,
      delivered: item.quantityDelivered,
      pending: item.quantityOrdered - item.quantityDelivered,
    };
  });
  const pendingItems = lines
    .filter((line) => line.pending > 0)
    .map((line) => ({
      orderItemId: line.id,
      productName: line.name,
      salePrice: line.price,
      pending: line.pending,
    }));

  const unitsOrdered = lines.reduce((sum, l) => sum + l.ordered, 0);
  const unitsDelivered = lines.reduce((sum, l) => sum + l.delivered, 0);
  const orderTotal = lines.reduce((sum, l) => sum + l.ordered * l.price, 0);
  const pendingValue = lines.reduce((sum, l) => sum + l.pending * l.price, 0);

  const depositAmount = order.depositAmount.toNumber();
  const depositApplied = order.depositApplied.toNumber();
  const remainingDeposit = depositAmount - depositApplied;
  const isPending = order.status === "PENDIENTE";
  const isCancelled = order.status === "CANCELADO";
  const toCollect = Math.max(0, pendingValue - Math.max(0, remainingDeposit));

  const canDeliver = isPending && puedeCrear && puedeVender && pendingItems.length > 0;
  const canPayDeposit = isPending && puedeCrear && depositAmount === 0;
  const canCancel = isPending && puedeAnular;
  const canEditItems = isPending && puedeCrear;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{order.customerName}</h1>
            <Badge variant={isPending ? "secondary" : isCancelled ? "destructive" : "default"}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.customerPhone ?? "Sin teléfono"} · {order.channel ?? "Sin canal"} · Creado por {order.user.name} el{" "}
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        {(canDeliver || canPayDeposit || canCancel) && (
          <div className="flex flex-wrap gap-2">
            {canDeliver && (
              <DeliverDialog orderId={order.id} pendingItems={pendingItems} remainingDeposit={remainingDeposit} />
            )}
            {canPayDeposit && <DepositDialog orderId={order.id} />}
            {canCancel && <CancelOrderDialog orderId={order.id} hasDepositToReturn={remainingDeposit > 0} />}
          </div>
        )}
      </div>

      {isCancelled && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="status">
          <p className="font-medium">Este pedido fue cancelado</p>
          {order.cancelReason && <p>Motivo: {order.cancelReason}</p>}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Entregado"
          value={`${unitsDelivered} de ${unitsOrdered}`}
          hint={
            isCancelled
              ? "Pedido cancelado"
              : unitsDelivered === unitsOrdered && unitsOrdered > 0
                ? "Pedido completo"
                : `${pendingItems.length} producto(s) pendiente(s)`
          }
        />
        <StatCard label="Total del pedido" value={formatMoney(orderTotal)} hint="A los precios actuales" />
        <StatCard
          label="Seña"
          value={depositAmount > 0 ? formatMoney(depositAmount) : "Sin seña"}
          hint={
            depositAmount > 0
              ? `${METHOD_LABELS[order.depositPaymentMethod ?? "EFECTIVO"]}${order.depositTransferReference ? ` ••${order.depositTransferReference}` : ""} · Saldo a favor ${formatMoney(remainingDeposit)}`
              : "Todavía no se cobró"
          }
        />
        <StatCard
          label="Falta cobrar"
          value={isCancelled ? "—" : formatMoney(toCollect)}
          hint={isCancelled ? "Pedido cancelado" : "Lo pendiente, menos el saldo de seña"}
        />
      </section>

      {canEditItems && (
        <Panel
          title="Buscar producto"
          description="Por nombre o código de barras. Con el lector, el producto se agrega solo."
          className="overflow-visible"
        >
          <AddItemForm orderId={order.id} />
        </Panel>
      )}

      <Panel
        title="Productos del pedido"
        description={canEditItems ? "Mientras el pedido está pendiente podés cambiar las cantidades o quitar productos." : undefined}
      >
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Entregado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Estado</TableHead>
                {canEditItems && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {canEditItems ? (
                      <QuantityStepper
                        key={`${line.id}-${line.ordered}`}
                        orderId={order.id}
                        orderItemId={line.id}
                        productName={line.name}
                        quantity={line.ordered}
                        delivered={line.delivered}
                      />
                    ) : (
                      line.ordered
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{line.delivered}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.pending}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(line.price)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(line.ordered * line.price)}
                  </TableCell>
                  <TableCell>
                    {line.pending === 0 ? (
                      <Badge variant="default">Entregado</Badge>
                    ) : line.delivered > 0 ? (
                      <Badge variant="outline">Parcial</Badge>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )}
                  </TableCell>
                  {canEditItems && (
                    <TableCell>
                      {line.delivered === 0 && (
                        <RemoveItemButton orderId={order.id} orderItemId={line.id} productName={line.name} />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEditItems ? 8 : 7} className="text-center text-sm text-muted-foreground">
                    Este pedido todavía no tiene productos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {lines.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-medium">
                    Total del pedido
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(orderTotal)}</TableCell>
                  <TableCell colSpan={canEditItems ? 2 : 1} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </Panel>

      {order.sales.length > 0 && (
        <Panel title="Entregas realizadas" description="Cada entrega genera una venta con su ticket">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Seña aplicada</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">#{sale.ticketNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(sale.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(sale.total.toNumber())}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sale.depositApplied ? formatMoney(sale.depositApplied.toNumber()) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <TicketButton saleId={sale.id} label="Ver ticket" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
