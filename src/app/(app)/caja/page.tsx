import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeExpectedCash } from "@/lib/cash-shift";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OpenShiftForm } from "./open-shift-form";
import { CashMovementForm } from "./cash-movement-form";
import { CloseShiftWizard } from "./close-shift-wizard";

const TYPE_LABELS: Record<string, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };
const METHOD_LABELS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" };

export default async function CajaPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la caja.</p>;
  }

  const puedeAbrir = hasPermission(currentUser, ModuloNegocio.CAJA, "crear");
  const puedeCerrar =
    hasPermission(currentUser, ModuloNegocio.CAJA, "editar") &&
    hasSpecialPermission(currentUser, "cerrarCaja");

  const shift = await prisma.cashShift.findFirst({
    where: { closedAt: null },
    include: { movements: { include: { user: true }, orderBy: { createdAt: "desc" } }, openedByUser: true },
  });

  if (!shift) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Caja</h1>
          <Link href="/caja/historial" className={cn(buttonVariants({ variant: "outline" }))}>
            Historial
          </Link>
        </div>
        {puedeAbrir ? (
          <OpenShiftForm />
        ) : (
          <p className="text-sm text-muted-foreground">No hay una caja abierta.</p>
        )}
      </div>
    );
  }

  const expected = computeExpectedCash(
    shift.openingAmount.toNumber(),
    shift.movements.map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Caja</h1>
          <p className="text-sm text-muted-foreground">
            Abierta por {shift.openedByUser.name} con ${shift.openingAmount.toFixed(0)} inicial ·
            Efectivo esperado: ${expected.toFixed(0)}
          </p>
        </div>
        <Link href="/caja/historial" className={cn(buttonVariants({ variant: "outline" }))}>
          Historial
        </Link>
      </div>

      {puedeAbrir && <CashMovementForm />}

      {puedeCerrar && <CloseShiftWizard />}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Movimientos del turno</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shift.movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(movement.createdAt)}
                </TableCell>
                <TableCell>{TYPE_LABELS[movement.type]}</TableCell>
                <TableCell>${movement.amount.toFixed(0)}</TableCell>
                <TableCell>{movement.concept}</TableCell>
                <TableCell>
                  {METHOD_LABELS[movement.paymentMethod]}
                  {movement.transferReference ? ` (••${movement.transferReference})` : ""}
                </TableCell>
                <TableCell>{movement.user.name}</TableCell>
              </TableRow>
            ))}
            {shift.movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Todavía no hay movimientos en este turno.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
