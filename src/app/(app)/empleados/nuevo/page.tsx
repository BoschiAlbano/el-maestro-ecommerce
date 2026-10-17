import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, isOwner } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "./employee-form";

export default async function NuevoEmpleadoPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para crear empleados.</p>;
  }

  const canCreateUser = isOwner(currentUser);

  const [roles, availableUsers] = await Promise.all([
    canCreateUser ? prisma.role.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.user.findMany({
      where: { employee: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo empleado</h1>
      <EmployeeForm canCreateUser={canCreateUser} roles={roles} availableUsers={availableUsers} />
    </div>
  );
}
