import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaleActions } from "./sale-actions";

const METHOD_LABELS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" };

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Venta #{sale.ticketNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(sale.createdAt)} · Atendió {sale.user.name}
          </p>
        </div>
        <Badge variant={sale.voidedAt ? "destructive" : "default"}>
          {sale.voidedAt ? "Anulada" : "Activa"}
        </Badge>
      </div>

      {sale.voidedAt && (
        <p className="text-sm text-destructive">
          Anulada por {sale.voidedByUser?.name} el {formatDateTime(sale.voidedAt)} — motivo: {sale.voidReason}
        </p>
      )}

      <SaleActions saleId={sale.id} canReprint={canReprint} canVoid={canVoid} alreadyVoided={Boolean(sale.voidedAt)} />

      <div>
        <h2 className="mb-2 text-sm font-semibold">Ítems</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product.name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>${item.unitSalePrice.toFixed(0)}</TableCell>
                <TableCell>${(item.quantity * item.unitSalePrice.toNumber()).toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-sm font-semibold">Total: ${sale.total.toFixed(0)}</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Pagos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.cashMovements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{movement.type === "INGRESO" ? "Cobro" : "Devolución"}</TableCell>
                <TableCell>${movement.amount.toFixed(0)}</TableCell>
                <TableCell>
                  {METHOD_LABELS[movement.paymentMethod]}
                  {movement.transferReference ? ` (••${movement.transferReference})` : ""}
                </TableCell>
                <TableCell>{movement.user.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sale.reprints.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Reimpresiones</h2>
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
        </div>
      )}
    </div>
  );
}
