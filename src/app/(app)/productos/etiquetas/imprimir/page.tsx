import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { LabelSheet } from "../label-sheet";

export default async function ImprimirEtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "exportar")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para imprimir etiquetas.</p>;
  }

  const { ids } = await searchParams;
  const idList = ids ? ids.split(",").filter(Boolean) : [];
  if (idList.length === 0) {
    return <p className="text-sm text-muted-foreground">No se eligió ningún producto.</p>;
  }

  const products = await prisma.product.findMany({
    where: { id: { in: idList } },
    select: { id: true, name: true, barcode: true, salePrice: true },
  });

  return (
    <LabelSheet
      products={products.map((p) => ({ ...p, salePrice: p.salePrice.toString() }))}
    />
  );
}
