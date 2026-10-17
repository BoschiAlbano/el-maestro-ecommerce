import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>{employee.user.name}</TableCell>
              <TableCell>{employee.phone ?? "—"}</TableCell>
              <TableCell>{TURNO_LABELS[employee.shift]}</TableCell>
              <TableCell>
                <Badge variant={employee.terminatedAt ? "destructive" : "default"}>
                  {employee.terminatedAt ? "Dado de baja" : "Activo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/empleados/${employee.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                {estado === "ACTIVO" ? "No hay empleados activos." : "No hay empleados para este filtro."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
