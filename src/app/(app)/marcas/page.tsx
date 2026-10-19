import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogTabs } from "@/components/catalog-tabs";
import { BrandManager } from "./brand-manager";

export default async function MarcasPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "editar")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para administrar marcas.</p>;
  }

  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <CatalogTabs />
      <h1 className="text-lg font-semibold">Marcas</h1>
      <BrandManager brands={brands} />
    </div>
  );
}
