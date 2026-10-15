import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { RubroManager } from "./rubro-manager";

export default async function RubrosPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "editar")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para administrar rubros.</p>;
  }

  const topLevel = await prisma.rubro.findMany({
    where: { parentId: null },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Rubros</h1>
      <RubroManager rubros={topLevel} />
    </div>
  );
}
