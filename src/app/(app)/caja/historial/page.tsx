import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TablePagination, parsePage } from "@/components/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default async function HistorialCajaPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la caja.</p>;
  }

  const where = { closedAt: { not: null } };
  const total = await prisma.cashShift.count({ where });

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage((await searchParams).pagina), totalPages);

  const shifts = await prisma.cashShift.findMany({
    where,
    include: { openedByUser: true, closedByUser: true },
    orderBy: { closedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Historial de caja</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Apertura</TableHead>
            <TableHead>Cierre</TableHead>
            <TableHead>Abierta por</TableHead>
            <TableHead>Cerrada por</TableHead>
            <TableHead>Diferencia</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift.id}>
              <TableCell>
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Tucuman",
                }).format(shift.openedAt)}
              </TableCell>
              <TableCell>
                {shift.closedAt &&
                  new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(shift.closedAt)}
              </TableCell>
              <TableCell>{shift.openedByUser.name}</TableCell>
              <TableCell>{shift.closedByUser?.name ?? "—"}</TableCell>
              <TableCell className={shift.difference?.toNumber() ? "text-destructive" : ""}>
                {shift.difference ? `$${shift.difference.toFixed(0)}` : "$0"}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/caja/historial/${shift.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {shifts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Todavía no hay turnos cerrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => (p === 1 ? "/caja/historial" : `/caja/historial?pagina=${p}`)}
      />
    </div>
  );
}
