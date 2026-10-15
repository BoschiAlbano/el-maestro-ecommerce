import { getCurrentUser, isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { NewUserForm } from "./new-user-form";

export default async function NuevoUsuarioPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo usuario</h1>
      <NewUserForm roles={roles} />
    </div>
  );
}
