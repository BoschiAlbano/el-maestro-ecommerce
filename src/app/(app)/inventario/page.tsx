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

export default async function InventarioPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver el inventario.</p>;
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, currentStock: true, minStock: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stock</h1>
        <Link href="/inventario/conteo" className={cn(buttonVariants())}>
          Conteo físico
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Historial</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const bajoStock = product.currentStock <= product.minStock;
            const negativo = product.currentStock < 0;
            return (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.currentStock}</TableCell>
                <TableCell>{product.minStock}</TableCell>
                <TableCell>
                  {negativo ? (
                    <Badge variant="destructive">Stock negativo — revisar</Badge>
                  ) : bajoStock ? (
                    <Badge variant="secondary">Bajo stock</Badge>
                  ) : (
                    <Badge variant="default">OK</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/inventario/${product.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    Ver
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No hay productos activos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
