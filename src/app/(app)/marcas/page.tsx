import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogTabs } from "@/components/catalog-tabs";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import { BrandManager } from "./brand-manager";

const DEFAULT_PAGE_SIZE = 20;

export default async function MarcasPage({ searchParams }: { searchParams: Promise<{ pagina?: string; porPagina?: string }> }) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "editar")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para administrar marcas.</p>;
  }

  const { pagina } = await searchParams;
  const total = await prisma.brand.count();
  const page = Math.min(parsePage(pagina), Math.max(1, Math.ceil(total / PAGE_SIZE)));

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <CatalogTabs />
      <h1 className="text-lg font-semibold">Marcas</h1>
      <BrandManager brands={brands} />

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => (p > 1 ? `/marcas?pagina=${p}` : "/marcas")}
      />
    </div>
  );
}
