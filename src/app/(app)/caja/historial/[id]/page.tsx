import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { summarizeShift } from "@/lib/cash-shift";
import { CashBreakdown } from "@/components/cash-breakdown";
import { Panel, StatCard } from "@/components/stat-card";
import { PrintButton } from "./print-button";

const TYPE_LABELS: Record<string, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };
const METHOD_LABELS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Tucuman",
  }).format(date);
}

export default async function DetalleCajaPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la caja.</p>;
  }

  const { id } = await params;
  const shift = await prisma.cashShift.findUnique({
    where: { id },
    include: {
      openedByUser: true,
      closedByUser: true,
      movements: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!shift || !shift.closedAt) notFound();

  const expected = shift.countedCash!.toNumber() - (shift.difference?.toNumber() ?? 0);
  const summary = summarizeShift(
    shift.openingAmount.toNumber(),
    shift.movements.map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Turno del {formatDateTime(shift.openedAt)}</h1>
          <p className="text-sm text-muted-foreground">
            Abierta por {shift.openedByUser.name} · Cerrada por {shift.closedByUser?.name} el{" "}
            {formatDateTime(shift.closedAt)}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Monto inicial</p>
          <p>${shift.openingAmount.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Esperado</p>
          <p>${expected.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Contado</p>
          <p>${shift.countedCash!.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Diferencia</p>
          <p className={shift.difference?.toNumber() ? "text-destructive" : ""}>
            ${shift.difference?.toFixed(0) ?? "0"}
          </p>
        </div>
      </div>
      {shift.differenceReason && (
        <p className="text-sm">
          <span className="text-muted-foreground">Motivo de la diferencia:</span>{" "}
          {shift.differenceReason}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          tone="emphasis"
          label="Efectivo esperado"
          value={formatMoney(summary.expectedCash)}
          hint="Inicial + neto en efectivo"
        />
        <StatCard label="Entradas" value={formatMoney(summary.ingresos)} hint="Total que entró en el turno" />
        <StatCard
          tone={summary.egresos > 0 ? "negative" : undefined}
          label="Salidas"
          value={formatMoney(summary.egresos)}
          hint="Total que salió en el turno"
        />
        <StatCard
          label="Total del turno"
          value={formatMoney(summary.ingresos - summary.egresos)}
          hint="Entradas menos salidas"
        />
      </section>

      <Panel
        title="Entradas y salidas"
        description={`Por medio de pago. El efectivo esperado es el inicial (${formatMoney(shift.openingAmount.toNumber())}) más el neto en efectivo; las transferencias no lo cambian.`}
      >
        <CashBreakdown summary={summary} />
      </Panel>

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
              <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
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
                Este turno no tuvo movimientos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
