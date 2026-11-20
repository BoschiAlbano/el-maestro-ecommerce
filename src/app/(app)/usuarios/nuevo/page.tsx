import { isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { NewUserForm } from "./new-user-form";
import { SYSTEM_ROLE_ID } from "@/lib/mercadolibre/orders/system-user";

export default async function NuevoUsuarioPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const roles = await prisma.role.findMany({ where: { id: { not: SYSTEM_ROLE_ID } }, orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo usuario</h1>
      <NewUserForm roles={roles} />
    </div>
  );
}
