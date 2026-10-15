import { isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { NewRoleForm } from "./new-role-form";

export default async function NuevoRolPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para el Dueño.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo rol</h1>
      <NewRoleForm />
    </div>
  );
}
