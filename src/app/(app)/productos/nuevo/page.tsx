import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { ProductForm } from "../product-form";

export default async function NuevoProductoPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para crear productos.</p>;
  }
  if (!hasSpecialPermission(currentUser, "cambiarPrecios")) {
    return (
      <p className="text-sm text-muted-foreground">
        Crear un producto implica fijarle un precio, y no tenés el permiso &quot;cambiar precios&quot;.
      </p>
    );
  }

  const [brands, topLevelRubros] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rubros = buildRubroOptions(topLevelRubros);
  const canAdjustStock = hasSpecialPermission(currentUser, "ajustarStock");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo producto</h1>
      <ProductForm brands={brands} rubros={rubros} canChangePrice canAdjustStock={canAdjustStock} />
    </div>
  );
}
