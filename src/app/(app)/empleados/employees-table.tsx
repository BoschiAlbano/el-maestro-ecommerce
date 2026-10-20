"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Eye, MoreHorizontal, UserX } from "lucide-react";
import { toast } from "sonner";
import { deactivateEmployee } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EmployeeRow = {
  id: string;
  name: string;
  phone: string | null;
  shiftLabel: string;
  terminated: boolean;
  /** Tiene permiso de anular en Empleados y todavía no está dado de baja. */
  canDeactivate: boolean;
};

/** Lista de empleados con un menú de acciones por fila: ver el detalle o dar de baja (specs/010). */
export function EmployeesTable({ employees, emptyMessage }: { employees: EmployeeRow[]; emptyMessage: string }) {
  const [pending, startTransition] = useTransition();

  function deactivate(employee: EmployeeRow) {
    startTransition(async () => {
      const result = await deactivateEmployee(employee.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Turno</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>{employee.name}</TableCell>
            <TableCell>{employee.phone ?? "—"}</TableCell>
            <TableCell>{employee.shiftLabel}</TableCell>
            <TableCell>
              <Badge variant={employee.terminated ? "destructive" : "default"}>
                {employee.terminated ? "Dado de baja" : "Activo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Acciones de ${employee.name}`} />}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem render={<Link href={`/empleados/${employee.id}`} />}>
                    <Eye />
                    Ver detalles
                  </DropdownMenuItem>
                  {employee.canDeactivate && (
                    <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => deactivate(employee)}>
                      <UserX />
                      Dar de baja
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
        {employees.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
