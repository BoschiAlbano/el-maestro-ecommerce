import Link from "next/link";
import { History } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toTucumanDateKey } from "@/lib/analytics";
import { collectedBySales, dayRange, parseDayKey, shiftContinuity, summarizeDay, summarizeSales } from "@/lib/cash-day";
import { computeExpectedCash, summarizeShift } from "@/lib/cash-shift";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/stat-card";
import { CashSummaryCards } from "@/components/cash-cards";
import { SectionTabs } from "@/components/section-tabs";
import { TablePagination, parsePage } from "@/components/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DayPicker } from "./day-picker";
import { PrintButton } from "./print-button";

const PAGE_SIZE = 10;

type MovementRow = Prisma.CashMovementGetPayload<{ include: { user: true; shift: { include: { openedByUser: true } } } }>;

const METHOD_LABELS = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" } as const;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "America/Argentina/Tucuman" }).format(date);
}

/** Tabla de movimientos de caja; se usa paginada en pantalla y completa al imprimir. */
function MovementsTable({ rows, canViewSales }: { rows: MovementRow[]; canViewSales: boolean }) {
  return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {canViewSales && <TableHead className="text-right">Venta</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(movement.createdAt, { timeStyle: "short" })}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {movement.shift.openedByUser.name}
                </TableCell>
                <TableCell>
                  <Badge variant={movement.type === "INGRESO" ? "secondary" : "destructive"}>
                    {movement.type === "INGRESO" ? "Ingreso" : "Egreso"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-64 truncate" title={movement.concept}>
                  {movement.concept}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {METHOD_LABELS[movement.paymentMethod]}
                  {movement.transferReference ? ` (••${movement.transferReference})` : ""}
                </TableCell>
                <TableCell>{movement.user.name}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    movement.type === "EGRESO" && "text-destructive",
                  )}
                >
                  {movement.type === "INGRESO" ? "+" : "−"}
                  {formatMoney(movement.amount.toNumber())}
                </TableCell>
                {canViewSales && (
                  <TableCell className="text-right">
                    {movement.saleId && (
                      <Link
                        href={`/ventas/historial/${movement.saleId}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Ver
                      </Link>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canViewSales ? 8 : 7} className="text-center text-sm text-muted-foreground">
                  No hubo movimientos de caja este día.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
  );
}

export default async function CajaDelDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; pagina?: string; vista?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la caja.</p>;
  }
  const canViewSales = hasPermission(currentUser, ModuloNegocio.VENTAS, "ver");

  const params = await searchParams;
  const todayKey = toTucumanDateKey(new Date());
  const dateKey = parseDayKey(params.fecha, todayKey);
  const range = dayRange(dateKey);

  const [dayMovements, daySales] = await Promise.all([
    prisma.cashMovement.findMany({
      where: { createdAt: range },
      include: { user: true, shift: { include: { openedByUser: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sale.findMany({ where: { createdAt: range }, select: { total: true, voidedAt: true, depositApplied: true } }),
  ]);

  // Turnos del día: los que tuvieron movimientos ese día y los que se abrieron ese día
  // (aunque todavía no tengan movimientos). Con todos sus movimientos, para el esperado.
  const shifts = await prisma.cashShift.findMany({
    where: { OR: [{ openedAt: range }, { id: { in: [...new Set(dayMovements.map((m) => m.shiftId))] } }] },
    include: { openedByUser: true, closedByUser: true, movements: true },
    orderBy: { openedAt: "asc" },
  });

  const movementsForSums = dayMovements.map((m) => ({
    type: m.type,
    amount: m.amount.toNumber(),
    paymentMethod: m.paymentMethod,
    saleId: m.saleId,
  }));
  const day = summarizeDay(movementsForSums);
  const sales = summarizeSales(
    daySales.map((s) => ({ total: s.total.toNumber(), voided: s.voidedAt !== null, depositApplied: s.depositApplied?.toNumber() ?? 0 })),
  );
  const collected = collectedBySales(movementsForSums);

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(dayMovements.length / PAGE_SIZE));
  const page = Math.min(parsePage(params.pagina), totalPages);
  const pageMovements = dayMovements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dayLabel = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
  const isToday = dateKey === todayKey;
  const hasActivity = dayMovements.length > 0 || daySales.length > 0 || shifts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Caja del día</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {dayLabel}
            {isToday ? " (hoy)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <DayPicker dateKey={dateKey} todayKey={todayKey} />
          <PrintButton />
          <Link href="/caja/historial" className={cn(buttonVariants({ variant: "outline" }))}>
            <History data-icon="inline-start" />
            Historial
          </Link>
        </div>
      </div>

      {!hasActivity ? (
        <Panel title="Sin actividad" description="No hubo movimientos de caja este día.">
          <p className="text-sm text-muted-foreground">
            No hubo movimientos de caja ni ventas el {dayLabel}. Probá con otro día.
          </p>
        </Panel>
      ) : (
        <>
          <CashSummaryCards
            summary={day}
            sales={{ count: sales.count, total: sales.total, voidedCount: sales.voidedCount, depositApplied: sales.depositApplied, collected }}
            period="día"
            cashLabel="Efectivo del día"
            cashValue={day.efectivo.neto}
            cashNote="Sin contar los montos iniciales"
          />

          <SectionTabs
            defaultValue={params.vista}
            tabs={[
              {
                value: "movimientos",
                label: `Movimientos (${dayMovements.length})`,
                content: (

          <Panel title="Movimientos del día" description="De todos los turnos, del más reciente al más antiguo">
            <div className="flex flex-col gap-4">
              <div className="print:hidden">
                <MovementsTable rows={pageMovements} canViewSales={canViewSales} />
              </div>
              <div className="hidden print:block">
                <MovementsTable rows={dayMovements} canViewSales={canViewSales} />
              </div>
              <div className="print:hidden">
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={dayMovements.length}
                buildHref={(p) => `/caja/dia?fecha=${dateKey}&vista=movimientos${p > 1 ? `&pagina=${p}` : ""}`}
              />
              </div>
            </div>
          </Panel>
                ),
              },
              {
                value: "turnos",
                label: `Turnos (${shifts.length})`,
                content: (

          <Panel title="Turnos del día" description="Cuánto aportó cada turno y cómo cerró">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Inicial</TableHead>
                  <TableHead className="text-right">Ingresos ef.</TableHead>
                  <TableHead className="text-right">Egresos ef.</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => {
                  const dayOfShift = summarizeShift(
                    0,
                    dayMovements
                      .filter((m) => m.shiftId === shift.id)
                      .map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod })),
                  );
                  const expected = computeExpectedCash(
                    shift.openingAmount.toNumber(),
                    shift.movements.map((m) => ({
                      type: m.type,
                      amount: m.amount.toNumber(),
                      paymentMethod: m.paymentMethod,
                    })),
                  );
                  const closed = shift.closedAt !== null;
                  const difference = shift.difference?.toNumber() ?? 0;
                  const continuity = shiftContinuity(shift, range);
                  const continues =
                    continuity === "previous" ? "Viene del día anterior" : continuity === "next" ? "Sigue el día siguiente" : null;

                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <div className="font-medium">{shift.openedByUser.name}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(shift.openedAt, { dateStyle: "short", timeStyle: "short" })}
                          {shift.closedAt
                            ? ` → ${formatDate(shift.closedAt, { dateStyle: "short", timeStyle: "short" })}`
                            : " → en curso"}
                        </div>
                        {continues && <div className="text-xs text-muted-foreground">{continues}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={closed ? "secondary" : "default"}>{closed ? "Cerrada" : "Abierta"}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(shift.openingAmount.toNumber())}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(dayOfShift.efectivo.ingresos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(dayOfShift.efectivo.egresos)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(expected)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {shift.countedCash ? formatMoney(shift.countedCash.toNumber()) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn("text-right tabular-nums", closed && difference !== 0 && "text-destructive")}
                      >
                        {closed ? formatMoney(difference) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={closed ? `/caja/historial/${shift.id}` : "/caja"}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          Ver
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      No hubo turnos de caja este día.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Panel>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
