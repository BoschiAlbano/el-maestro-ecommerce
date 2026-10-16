import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DetalleIngresoPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INGRESO_MERCADERIA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los ingresos.</p>;
  }

  const { id } = await params;
  const entry = await prisma.stockEntry.findUnique({
    where: { id },
    include: { user: true, items: { include: { product: true } } },
  });
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Ingreso del {new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Argentina/Tucuman",
        }).format(entry.createdAt)}</h1>
        <p className="text-sm text-muted-foreground">
          Proveedor: {entry.supplierName ?? "—"} · Registrado por {entry.user.name}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Precio de compra</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entry.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.product.name}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>${item.purchasePrice.toFixed(0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
