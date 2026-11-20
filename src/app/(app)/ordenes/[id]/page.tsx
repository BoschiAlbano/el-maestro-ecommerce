import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { deadlineState } from "@/lib/mercadolibre/orders/order-alerts";
import { NOT_YET_SHIPPED, ORDER_STATUS_LABELS } from "@/lib/mercadolibre/orders/order-status";
import { loadOrderDetail } from "@/lib/mercadolibre/orders/orders-view";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LabelButtons } from "./label-buttons";
import { RestockForm } from "./restock-form";

function money(value: { toString(): string } | string) {
  return `$${Number(value.toString()).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Tucuman" }).format(date);
}

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las órdenes de Mercado Libre.</p>;
  }

  const { id } = await params;
  const order = await loadOrderDetail(id);
  if (!order) notFound();

  const number = order.mlPackId ?? order.mlOrderIds[0];
  const deadline = deadlineState(order, new Date());
  const canPrint =
    hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar") &&
    !order.fraudRisk &&
    order.mlShipmentId !== null &&
    NOT_YET_SHIPPED.includes(order.status);
  const restockable = order.items.filter((i) => i.productId && i.quantity > i.restockedQuantity);
  const canRestock =
    (order.status === "CANCELLED" || order.status === "NOT_DELIVERED") &&
    restockable.length > 0 &&
    hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar") &&
    hasSpecialPermission(currentUser, "ajustarStock");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">Compra #{number}</h1>
            <Badge variant={order.status === "CANCELLED" || order.status === "NOT_DELIVERED" ? "secondary" : "default"}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(order.mlCreatedAt)} · {order.buyerNickname}
            {" · "}
            <a
              href={`https://www.mercadolibre.com.ar/ventas/${number}/detalle`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              Ver en Mercado Libre
              <ExternalLink className="size-3" />
            </a>
            {order.sale && (
              <>
                {" · "}
                <Link href={`/ventas/historial/${order.sale.id}`} className="underline">
                  Venta #{order.sale.ticketNumber}
                </Link>
              </>
            )}
          </p>
        </div>
        {canPrint && <LabelButtons orderId={order.id} />}
      </div>

      {order.fraudRisk && (
        <Warning>Mercado Libre marcó esta compra con riesgo de fraude: no la despaches. La etiqueta no se puede descargar.</Warning>
      )}
      {order.outOfStock && (
        <Warning>
          Esta compra dejó el stock en negativo: conseguí el producto o cancelá la compra en Mercado Libre a tiempo.
        </Warning>
      )}
      {order.needsReview && <Warning>{order.needsReview}</Warning>}
      {order.cancelReason && <Warning>{order.cancelReason}</Warning>}

      <section className="grid gap-4 md:grid-cols-3">
        <Info label="Despachar hasta">
          {order.dispatchDeadline ? (
            <span className={deadline === "overdue" ? "text-destructive" : deadline === "soon" ? "text-amber-700 dark:text-amber-300" : undefined}>
              {formatDateTime(order.dispatchDeadline)}
              {deadline === "overdue" && " · vencida"}
              {deadline === "soon" && " · vence pronto"}
            </span>
          ) : (
            "—"
          )}
        </Info>
        <Info label="Envío">
          {order.mlShipmentId ? `Mercado Envíos #${order.mlShipmentId}` : "Sin envío de Mercado Libre"}
          {order.receiverName && <p className="text-xs text-muted-foreground">Recibe: {order.receiverName}</p>}
          {order.destinationCity && <p className="text-xs text-muted-foreground">{order.destinationCity}</p>}
        </Info>
        <Info label="Etiqueta">
          {order.labelPrintedAt
            ? `Descargada el ${formatDateTime(order.labelPrintedAt)}${order.labelPrintedByUser ? ` por ${order.labelPrintedByUser.name}` : ""}`
            : "Todavía no se descargó"}
        </Info>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Productos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Cobró Mercado Libre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.product ? (
                    <Link href={`/productos/${item.product.id}`} className="hover:underline">
                      {item.product.name}
                    </Link>
                  ) : (
                    <span>
                      {item.title} <Badge variant="outline">Sin vincular</Badge>
                    </span>
                  )}
                  {item.restockedQuantity > 0 && (
                    <p className="text-xs text-muted-foreground">Reingresadas al stock: {item.restockedQuantity}</p>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{item.sku ?? "—"}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{money(item.unitPrice)}</TableCell>
                <TableCell className="text-right">{money(Number(item.saleFee.toString()) * item.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-right">{money(order.total)}</dd>
          <dt className="text-muted-foreground">Cobró Mercado Libre</dt>
          <dd className="text-right">−{money(order.mlFee)}</dd>
          <dt className="text-muted-foreground">Envío a tu cargo</dt>
          <dd className="text-right">−{money(order.sellerShippingCost)}</dd>
          <dt className="font-medium">Te queda</dt>
          <dd className="text-right font-medium">{money(order.net)}</dd>
        </dl>
      </section>

      {canRestock && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Reingresar al stock</h2>
          <p className="text-sm text-muted-foreground">
            Usalo cuando la mercadería vuelva en condiciones de venderse. Indicá cuántas unidades de cada producto volvieron.
          </p>
          <RestockForm
            orderId={order.id}
            items={restockable.map((i) => ({ id: i.id, name: i.product!.name, max: i.quantity - i.restockedQuantity }))}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Historial</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {order.events.map((event) => (
            <li key={event.id}>
              <span className="text-muted-foreground">{formatDateTime(event.at)}</span> · {ORDER_STATUS_LABELS[event.status]}
              {event.detail && <span className="text-muted-foreground"> · {event.detail}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
