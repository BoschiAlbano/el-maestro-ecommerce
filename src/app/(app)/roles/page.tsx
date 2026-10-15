import Link from "next/link";
import { getCurrentUser, isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteRoleButton } from "./delete-role-button";

export default async function RolesPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isOwner(currentUser)) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para el Dueño.</p>;
  }

  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Roles</h1>
        <Link href="/roles/nuevo" className={cn(buttonVariants())}>
          Nuevo rol
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuarios</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="flex items-center gap-2">
                {role.name}
                {role.isOwnerRole && <Badge variant="secondary">fijo</Badge>}
              </TableCell>
              <TableCell>{role._count.users}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Link
                  href={`/roles/${role.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  {role.isOwnerRole ? "Ver" : "Editar"}
                </Link>
                {!role.isOwnerRole && (
                  <DeleteRoleButton roleId={role.id} disabled={role._count.users > 0} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
