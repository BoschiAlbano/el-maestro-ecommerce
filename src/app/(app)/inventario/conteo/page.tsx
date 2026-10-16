import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CountWizard } from "./count-wizard";

export default async function ConteoFisicoPage() {
  const currentUser = await getCurrentUser();

  if (
    !currentUser ||
    !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "editar") ||
    !hasSpecialPermission(currentUser, "ajustarStock")
  ) {
    return (
      <p className="text-sm text-muted-foreground">No tenés permiso para hacer un conteo físico.</p>
    );
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, currentStock: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Conteo físico</h1>
      <CountWizard products={products} />
    </div>
  );
}
