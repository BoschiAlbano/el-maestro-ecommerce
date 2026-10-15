import { notFound } from "next/navigation";
import { getCurrentUser, isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { EditUserForm } from "./edit-user-form";
import { setUserActive } from "../actions";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const { id } = await params;
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!user) notFound();

  const userId = user.id;
  const isSelf = userId === currentUser.id;
  const nextActive = !user.active;

  async function toggleActive() {
    "use server";
    await setUserActive(userId, nextActive);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Editar usuario</h1>
      <EditUserForm user={user} roles={roles} />

      <div className="max-w-sm border-t pt-4">
        <form action={toggleActive}>
          <Button type="submit" variant={user.active ? "destructive" : "default"} disabled={isSelf}>
            {user.active ? "Desactivar usuario" : "Reactivar usuario"}
          </Button>
        </form>
        {isSelf && (
          <p className="mt-2 text-sm text-muted-foreground">
            No podés desactivarte a vos mismo.
          </p>
        )}
      </div>
    </div>
  );
}
