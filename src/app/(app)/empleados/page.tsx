import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeesTable } from "./employees-table";

const TURNO_LABELS: Record<string, string> = { MANANA: "Mañana", TARDE: "Tarde" };

const ESTADOS: { value: string; label: string }[] = [
  { value: "ACTIVO", label: "Activos" },
  { value: "BAJA", label: "Dados de baja" },
  { value: "__all__", label: "Todos" },
];

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los empleados.</p>;
  }

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "crear");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "anular");

  // Por defecto solo los activos: mezclarlos con los dados de baja dificulta
  // ver quién trabaja hoy (mismo criterio que el filtro de pedidos, spec 009).
  const { estado = "ACTIVO" } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (estado === "ACTIVO") where.terminatedAt = null;
  if (estado === "BAJA") where.terminatedAt = { not: null };

  const employees = await prisma.employee.findMany({
    where,
    include: { user: true },
    orderBy: { user: { name: "asc" } },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Empleados</h1>
        {puedeCrear && (
          <Link href="/empleados/nuevo" className={cn(buttonVariants())}>
            Nuevo empleado
          </Link>
        )}
      </div>

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            name="estado"
            defaultValue={estado}
            items={Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]))}
          >
            <SelectTrigger id="estado" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <EmployeesTable
        employees={employees.map((e) => ({
          id: e.id,
          name: e.user.name,
          phone: e.phone,
          shiftLabel: TURNO_LABELS[e.shift],
          terminated: Boolean(e.terminatedAt),
          canDeactivate: puedeAnular && !e.terminatedAt,
        }))}
        emptyMessage={estado === "ACTIVO" ? "No hay empleados activos." : "No hay empleados para este filtro."}
      />
    </div>
  );
}
