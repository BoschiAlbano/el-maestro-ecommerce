import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Panel, StatCard } from "@/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaleActions } from "./sale-actions";

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

export default async function DetalleVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.VENTAS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las ventas.</p>;
  }

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      user: true,
      voidedByUser: true,
      items: { include: { product: true } },
      cashMovements: { include: { user: true }, orderBy: { createdAt: "asc" } },
      reprints: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) notFound();

  const canReprint =
    hasPermission(currentUser, ModuloNegocio.VENTAS, "ver") &&
    hasSpecialPermission(currentUser, "reimprimirTickets");
  const canVoid =
    hasPermission(currentUser, ModuloNegocio.VENTAS, "anular") &&
    hasSpecialPermission(currentUser, "anularVentas");

  const units = sale.items.reduce((sum, item) => sum + item.quantity, 0);
  const collected = (method: string) =>
    sale.cashMovements
      .filter((m) => m.type === "INGRESO" && m.paymentMethod === method)
      .reduce((sum, m) => sum + m.amount.toNumber(), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Venta #{sale.ticketNumber}</h1>
            <Badge variant={sale.voidedAt ? "destructive" : "secondary"}>{sale.voidedAt ? "Anulada" : "Activa"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(sale.createdAt)} · Atendió {sale.user.name}
          </p>
        </div>
        <SaleActions
          saleId={sale.id}
          canReprint={canReprint}
          canVoid={canVoid}
          alreadyVoided={Boolean(sale.voidedAt)}
        />
      </div>

      {sale.voidedAt && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="status">
          <p className="font-medium">Esta venta fue anulada</p>
          <p>
            Por {sale.voidedByUser?.name} el {formatDateTime(sale.voidedAt)}. Motivo: {sale.voidReason}
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={formatMoney(sale.total.toNumber())} hint={sale.voidedAt ? "Venta anulada" : "Total de la venta"} />
        <StatCard label="Unidades" value={units.toLocaleString("es-AR")} hint={`${sale.items.length} producto(s) distintos`} />
        <StatCard label="Cobrado en efectivo" value={formatMoney(collected("EFECTIVO"))} hint="Entró a la caja" />
        <StatCard label="Cobrado por transferencia" value={formatMoney(collected("TRANSFERENCIA"))} hint="Registrado aparte" />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Panel title="Productos" className="lg:col-span-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.unitSalePrice.toNumber())}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(item.quantity * item.unitSalePrice.toNumber())}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(sale.total.toNumber())}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Panel>

        <Panel title="Pagos" description="Lo que se cobró y, si se anuló, lo que se devolvió" className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.cashMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    <Badge variant={movement.type === "INGRESO" ? "secondary" : "destructive"}>
                      {movement.type === "INGRESO" ? "Cobro" : "Devolución"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {METHOD_LABELS[movement.paymentMethod]}
                    {movement.transferReference ? ` (••${movement.transferReference})` : ""}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${movement.type === "EGRESO" ? "text-destructive" : ""}`}
                  >
                    {movement.type === "INGRESO" ? "+" : "−"}
                    {formatMoney(movement.amount.toNumber())}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </section>

      {sale.reprints.length > 0 && (
        <Panel title="Reimpresiones del ticket" description="Cada vez que se volvió a imprimir queda registrado">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.reprints.map((reprint) => (
                <TableRow key={reprint.id}>
                  <TableCell>{formatDateTime(reprint.createdAt)}</TableCell>
                  <TableCell>{reprint.user.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
