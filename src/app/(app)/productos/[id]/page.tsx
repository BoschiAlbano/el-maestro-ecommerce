import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductForm } from "../product-form";
import { setProductActive } from "../actions";

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver productos.</p>;
  }

  const { id } = await params;
  const [product, brands, topLevelRubros] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        priceHistory: { include: { changedByUser: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  const rubros = buildRubroOptions(topLevelRubros);

  const verCostos = hasSpecialPermission(currentUser, "verCostosMargenes");
  const puedeEditar = hasPermission(currentUser, ModuloNegocio.CATALOGO, "editar");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.CATALOGO, "anular");
  const canChangePrice = hasSpecialPermission(currentUser, "cambiarPrecios");

  const productId = product.id;
  const nextActive = !product.active;
  async function toggleActive() {
    "use server";
    await setProductActive(productId, nextActive);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">{product.name}</h1>

      {puedeEditar ? (
        <ProductForm
          brands={brands}
          rubros={rubros}
          canChangePrice={canChangePrice}
          product={{
            id: product.id,
            name: product.name,
            brandId: product.brandId,
            rubroId: product.rubroId,
            barcode: product.barcode,
            photoUrl: product.photoUrl,
            purchasePrice: product.purchasePrice.toString(),
            salePrice: product.salePrice.toString(),
            minStock: product.minStock,
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No tenés permiso para editar productos.</p>
      )}

      {puedeAnular && (
        <form action={toggleActive} className="max-w-sm">
          <Button type="submit" variant={product.active ? "destructive" : "default"}>
            {product.active ? "Desactivar producto" : "Reactivar producto"}
          </Button>
        </form>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Historial de precio</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              {verCostos && <TableHead>Compra</TableHead>}
              <TableHead>Venta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {product.priceHistory.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(entry.createdAt)}
                </TableCell>
                <TableCell>{entry.changedByUser.name}</TableCell>
                {verCostos && <TableCell>${entry.purchasePrice.toFixed(0)}</TableCell>}
                <TableCell>${entry.salePrice.toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
