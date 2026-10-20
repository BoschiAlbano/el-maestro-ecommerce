import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditEmployeeForm } from "./edit-employee-form";
import { DeactivateEmployeeButton } from "./deactivate-employee-button";

export default async function EmpleadoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver este empleado.</p>;
  }

  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee) notFound();

  const puedeEditar = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "editar");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "anular");
  const estaDeBaja = Boolean(employee.terminatedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{employee.user.name}</h1>
          <p className="text-sm text-muted-foreground">{employee.user.email}</p>
        </div>
        <Badge variant={estaDeBaja ? "destructive" : "default"}>
          {estaDeBaja ? "Dado de baja" : "Activo"}
        </Badge>
      </div>

      <div className="grid max-w-5xl items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del empleado</CardTitle>
            <CardDescription>DNI, teléfono, fecha de ingreso y turno.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditEmployeeForm
              employeeId={employee.id}
              dni={employee.dni}
              phone={employee.phone ?? ""}
              hireDate={employee.hireDate.toISOString().slice(0, 10)}
              shift={employee.shift}
              disabled={!puedeEditar}
            />
          </CardContent>
        </Card>

        {(estaDeBaja || puedeAnular) && (
          <Card>
            <CardHeader>
              <CardTitle>Estado del empleado</CardTitle>
              <CardDescription>
                {estaDeBaja
                  ? "Este empleado está dado de baja y no puede iniciar sesión."
                  : "Dar de baja impide que vuelva a iniciar sesión, pero conserva su historial."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estaDeBaja ? (
                <p className="text-sm text-muted-foreground">
                  Fecha de baja:{" "}
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(employee.terminatedAt!)}
                </p>
              ) : (
                <DeactivateEmployeeButton employeeId={employee.id} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
