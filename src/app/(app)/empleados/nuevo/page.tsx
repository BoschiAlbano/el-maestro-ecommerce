import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, isOwner } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "./employee-form";
import { SYSTEM_ROLE_ID, SYSTEM_USER_ID } from "@/lib/mercadolibre/orders/system-user";

export default async function NuevoEmpleadoPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para crear empleados.</p>;
  }

  const canCreateUser = isOwner(currentUser);

  const [roles, availableUsers] = await Promise.all([
    canCreateUser ? prisma.role.findMany({ where: { id: { not: SYSTEM_ROLE_ID } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.user.findMany({
      where: { employee: null, id: { not: SYSTEM_USER_ID } },
      select: { id: true, name: true, username: true },
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
