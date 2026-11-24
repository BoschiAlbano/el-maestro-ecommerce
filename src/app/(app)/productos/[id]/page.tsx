import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABELS } from "@/lib/mercadolibre/listing-status";
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
import { MercadoLibrePanel } from "./mercadolibre-panel";

export default async function ProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
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
        mlLinkedListing: {
          select: { mlItemId: true, permalink: true, status: true, statusReason: true, linkedAt: true, publishedFromSystem: true },
        },
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
  const verMercadoLibre = hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  const listing = product.mlLinkedListing;
  const { tab } = await searchParams;

  const productId = product.id;
  const nextActive = !product.active;
  async function toggleActive() {
    "use server";
    await setProductActive(productId, nextActive);
  }

  const productTab = (
    <div className="flex flex-col gap-6">
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
            sku: product.sku,
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
                <TableCell>{entry.changedByUser?.name ?? "Mercado Libre"}</TableCell>
                {verCostos && <TableCell>${entry.purchasePrice.toFixed(0)}</TableCell>}
                <TableCell>${entry.salePrice.toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">{product.name}</h1>

      {verMercadoLibre ? (
        // Pestañas Producto y Mercado Libre (specs/025, RF-11). `?tab=mercadolibre` abre la segunda.
        <Tabs defaultValue={tab === "mercadolibre" ? "mercadolibre" : "producto"}>
          <TabsList>
            <TabsTrigger value="producto">Producto</TabsTrigger>
            <TabsTrigger value="mercadolibre">
              Mercado Libre
              {listing && (
                <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"} className="ml-1">
                  {STATUS_LABELS[listing.status]}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="producto" className="pt-2">
            {productTab}
          </TabsContent>
          <TabsContent value="mercadolibre" className="pt-2">
            <MercadoLibrePanel productId={product.id} currentUser={currentUser} listing={listing} />
          </TabsContent>
        </Tabs>
      ) : (
        productTab
      )}
    </div>
  );
}
