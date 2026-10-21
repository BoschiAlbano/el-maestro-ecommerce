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
import { CashSummaryCards } from "@/components/cash-cards";
import { collectedBySales, summarizeSales } from "@/lib/cash-day";
import { Panel } from "@/components/stat-card";
import { SectionTabs } from "@/components/section-tabs";
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
  const shiftSales = summarizeSales(
    (await prisma.sale.findMany({ where: { shiftId: shift.id }, select: { total: true, voidedAt: true, depositApplied: true } })).map((sale) => ({
      total: sale.total.toNumber(),
      voided: sale.voidedAt !== null,
      depositApplied: sale.depositApplied?.toNumber() ?? 0,
    })),
  );
  const collected = collectedBySales(
    shift.movements.map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod, saleId: m.saleId })),
  );
  const summary = summarizeShift(
    shift.openingAmount.toNumber(),
    shift.movements.map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Turno del {formatDateTime(shift.openedAt)}</h1>
          <p className="text-sm text-muted-foreground">
            Abierta por {shift.openedByUser.name} · Cerrada por {shift.closedByUser?.name} el{" "}
            {formatDateTime(shift.closedAt)}
          </p>
        </div>
        <PrintButton />
      </div>

      <CashSummaryCards
        summary={summary}
        sales={{
          count: shiftSales.count,
          total: shiftSales.total,
          voidedCount: shiftSales.voidedCount,
          depositApplied: shiftSales.depositApplied,
          collected,
        }}
        period="turno"
        cashLabel="Efectivo esperado"
        cashValue={summary.expectedCash}
        cashNote={`Inicial ${formatMoney(shift.openingAmount.toNumber())} + neto en efectivo`}
      />

      <SectionTabs
        tabs={[
          {
            value: "cierre",
            label: "Cierre de caja",
            content: (
              <>
      <Panel title="Cierre de caja" description="Lo que había que tener, lo que se contó y la diferencia">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Monto inicial</p>
              <p>{formatMoney(shift.openingAmount.toNumber())}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Esperado</p>
              <p>{formatMoney(expected)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contado</p>
              <p>{formatMoney(shift.countedCash!.toNumber())}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Diferencia</p>
              <p className={shift.difference?.toNumber() ? "text-destructive" : ""}>
                {formatMoney(shift.difference?.toNumber() ?? 0)}
              </p>
            </div>
          </div>
          {shift.differenceReason && (
            <p className="text-sm">
              <span className="text-muted-foreground">Motivo de la diferencia:</span>{" "}
              {shift.differenceReason}
            </p>
          )}
        </div>
      </Panel>

              </>
            ),
          },
          {
            value: "movimientos",
            label: `Movimientos (${shift.movements.length})`,
            content: (
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
              <TableCell>{formatMoney(movement.amount.toNumber())}</TableCell>
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
            ),
          },
        ]}
      />
    </div>
  );
}
