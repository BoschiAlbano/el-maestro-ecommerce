import Link from "next/link";
import { isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UsersTable } from "./users-table";

export default async function UsuariosPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es solo para el Dueño.
      </p>
    );
  }

  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Usuarios</h1>
        <Link href="/usuarios/nuevo" className={cn(buttonVariants())}>
          Nuevo usuario
        </Link>
      </div>

      <UsersTable
        currentUserId={currentUser.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          roleName: u.role.name,
          active: u.active,
        }))}
      />
    </div>
  );
}
