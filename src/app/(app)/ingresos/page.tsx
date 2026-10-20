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

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INGRESO_MERCADERIA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver los ingresos.</p>;
  }

  const total = await prisma.stockEntry.count();

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage((await searchParams).pagina), totalPages);

  const entries = await prisma.stockEntry.findMany({
    include: { user: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ingresos de mercadería</h1>
        <Link href="/ingresos/nuevo" className={cn(buttonVariants())}>
          Nuevo ingreso
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Ítems</TableHead>
            <TableHead>Registrado por</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Tucuman",
                }).format(entry.createdAt)}
              </TableCell>
              <TableCell>{entry.supplierName ?? "—"}</TableCell>
              <TableCell>{entry._count.items}</TableCell>
              <TableCell>{entry.user.name}</TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/ingresos/${entry.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Todavía no hay ingresos registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => (p === 1 ? "/ingresos" : `/ingresos?pagina=${p}`)}
      />
    </div>
  );
}
