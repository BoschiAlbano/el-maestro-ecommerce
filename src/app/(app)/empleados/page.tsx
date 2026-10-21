import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { FilterForm } from "@/components/filter-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import { EmployeesTable } from "./employees-table";

const DEFAULT_PAGE_SIZE = 20;

const TURNO_LABELS: Record<string, string> = { MANANA: "Mañana", TARDE: "Tarde" };

const ESTADOS: { value: string; label: string }[] = [
  { value: "ACTIVO", label: "Activos" },
  { value: "BAJA", label: "Dados de baja" },
  { value: "__all__", label: "Todos" },
];

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pagina?: string; porPagina?: string }>;
}) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los empleados.</p>;
  }

  const puedeCrear = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "crear");
  const puedeAnular = hasPermission(currentUser, ModuloNegocio.EMPLEADOS, "anular");

  // Por defecto solo los activos: mezclarlos con los dados de baja dificulta
  // ver quién trabaja hoy (mismo criterio que el filtro de pedidos, spec 009).
  const { estado = "ACTIVO", pagina } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (estado === "ACTIVO") where.terminatedAt = null;
  if (estado === "BAJA") where.terminatedAt = { not: null };

  const total = await prisma.employee.count({ where });
  const page = Math.min(parsePage(pagina), Math.max(1, Math.ceil(total / PAGE_SIZE)));

  const employees = await prisma.employee.findMany({
    where,
    include: { user: true },
    orderBy: { user: { name: "asc" } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Empleados</h1>
        {puedeCrear && (
          <Link href="/empleados/nuevo" className={cn(buttonVariants())}>
            Nuevo empleado
          </Link>
        )}
      </div>

      <FilterForm
        activeCount={0}
        search={
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            name="estado"
            defaultValue={estado}
            items={Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]))}
          >
            <SelectTrigger id="estado" className="w-full sm:w-40">
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
        }
      />

      <div className="flex-1">
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

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => {
          const query = new URLSearchParams({ estado });
          if (p > 1) query.set("pagina", String(p));
          return `/empleados?${query}`;
        }}
      />
    </div>
  );
}
