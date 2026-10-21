import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
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
import { AdjustStockForm } from "../adjust-stock-form";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";

const TYPE_LABELS: Record<string, string> = {
  INGRESO: "Ingreso",
  VENTA: "Venta",
  AJUSTE: "Ajuste",
  MERMA: "Merma",
};

const DEFAULT_PAGE_SIZE = 10;

export default async function InventarioProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pagina?: string; porPagina?: string }>;
}) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver el inventario.</p>;
  }

  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) notFound();

  const total = await prisma.stockMovement.count({ where: { productId } });

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage((await searchParams).pagina), totalPages);

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const puedeAjustar =
    hasPermission(currentUser, ModuloNegocio.INVENTARIO, "editar") &&
    hasSpecialPermission(currentUser, "ajustarStock");

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">Stock actual: {product.currentStock}</p>
      </div>

      {puedeAjustar ? (
        <AdjustStockForm productId={product.id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No tenés permiso para ajustar el stock de este producto.
        </p>
      )}

      <div className="flex flex-1 flex-col">
        <h2 className="mb-2 text-sm font-semibold">Historial de movimientos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(movement.createdAt)}
                </TableCell>
                <TableCell>{TYPE_LABELS[movement.type] ?? movement.type}</TableCell>
                <TableCell className={movement.quantity < 0 ? "text-destructive" : ""}>
                  {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                </TableCell>
                <TableCell>{movement.reason ?? "—"}</TableCell>
                <TableCell>{movement.user.name}</TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Todavía no hay movimientos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="mt-auto pt-4">
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            buildHref={(p) => (p === 1 ? `/inventario/${productId}` : `/inventario/${productId}?pagina=${p}`)}
          />
        </div>
      </div>
    </div>
  );
}
