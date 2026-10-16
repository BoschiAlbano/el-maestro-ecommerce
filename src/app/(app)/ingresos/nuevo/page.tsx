import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { StockEntryForm } from "../stock-entry-form";

export default async function NuevoIngresoPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INGRESO_MERCADERIA, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para registrar ingresos.</p>;
  }
  if (!hasSpecialPermission(currentUser, "cambiarPrecios")) {
    return (
      <p className="text-sm text-muted-foreground">
        Registrar un ingreso actualiza el precio de compra, y no tenés el permiso &quot;cambiar
        precios&quot;.
      </p>
    );
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo ingreso de mercadería</h1>
      <StockEntryForm products={products} />
    </div>
  );
}
