import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { LabelSelector } from "./label-selector";

export default async function EtiquetasPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "exportar")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para imprimir etiquetas.</p>;
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, barcode: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Etiquetas</h1>
      <LabelSelector products={products} />
    </div>
  );
}
