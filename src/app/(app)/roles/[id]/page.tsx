import { notFound } from "next/navigation";
import { getCurrentUser, isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PermissionMatrix } from "@/components/permission-matrix";
import { ModuloNegocio } from "@/generated/prisma/client";
import type { Accion } from "@/lib/permissions";
import { EditRoleForm } from "./edit-role-form";

export default async function RolPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para el Dueño.</p>;
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) notFound();

  if (role.isOwnerRole) {
    const defaultPermissions = Object.fromEntries(
      role.permissions.map((p) => [p.module, p]),
    ) as Partial<Record<ModuloNegocio, Record<Accion, boolean>>>;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{role.name}</h1>
          <Badge variant="secondary">fijo</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          El rol Dueño no se puede editar ni borrar: siempre tiene todos los permisos.
        </p>
        <PermissionMatrix defaultPermissions={defaultPermissions} defaultSpecial={role} disabled />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Editar rol</h1>
      <EditRoleForm role={role} />
    </div>
  );
}
