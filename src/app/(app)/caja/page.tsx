import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizeShift } from "@/lib/cash-shift";
import { Badge } from "@/components/ui/badge";
import { PageActions } from "@/components/page-actions";
import { Panel } from "@/components/stat-card";
import { CashSummaryCards } from "@/components/cash-cards";
import { collectedBySales, summarizeSales } from "@/lib/cash-day";
import { OpenShiftForm } from "./open-shift-form";
import { MovementDialog } from "./movement-dialog";
import { CloseShiftDialog } from "./close-shift-dialog";
import { CajaMobileMenu } from "./mobile-menu";
import { MovementsTabs, type MovementRow } from "./movements-tabs";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "America/Argentina/Tucuman" }).format(date);
}

function HistoryLink() {
  return (
    <PageActions
      secondary={[
        { label: "Caja del día", icon: "calendar", href: "/caja/dia" },
        { label: "Historial", icon: "history", href: "/caja/historial" },
      ]}
    />
  );
}

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
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Caja</h1>
            <Badge variant="outline">Cerrada</Badge>
          </div>
          <HistoryLink />
        </div>

        <Panel
          title="No hay una caja abierta"
          description={
            puedeAbrir
              ? "Abrí un turno para poder registrar movimientos y cobrar ventas."
              : "Pedile a alguien con permiso que abra el turno."
          }
          className="max-w-md"
        >
          {puedeAbrir ? (
            <OpenShiftForm />
          ) : (
            <p className="text-sm text-muted-foreground">No tenés permiso para abrir la caja.</p>
          )}
        </Panel>
      </div>
    );
  }

  // Acciones sobre los movimientos que vienen de una venta (specs/007, RF-11).
  const canViewSales = hasPermission(currentUser, ModuloNegocio.VENTAS, "ver");
  const canReprint = canViewSales && hasSpecialPermission(currentUser, "reimprimirTickets");

  const openingAmount = shift.openingAmount.toNumber();
  const summary = summarizeShift(
    openingAmount,
    shift.movements.map((m) => ({ type: m.type, amount: m.amount.toNumber(), paymentMethod: m.paymentMethod })),
  );

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

  const movements: MovementRow[] = shift.movements.map((m) => ({
    id: m.id,
    when: formatDate(m.createdAt, { dateStyle: "short", timeStyle: "short" }),
    type: m.type,
    amount: m.amount.toNumber(),
    concept: m.concept,
    paymentMethod: m.paymentMethod,
    transferReference: m.transferReference,
    userName: m.user.name,
    saleId: m.saleId,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Caja</h1>
            <Badge>Abierta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Abierta por {shift.openedByUser.name} el {formatDate(shift.openedAt, { dateStyle: "short", timeStyle: "short" })}{" "}
            con {formatMoney(openingAmount)} de efectivo inicial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeAbrir && (
            <div className="hidden gap-2 sm:flex">
              <MovementDialog type="INGRESO" />
              <MovementDialog type="EGRESO" />
            </div>
          )}
          {puedeCerrar && <CloseShiftDialog />}
          <div className="hidden sm:block">
            <HistoryLink />
          </div>
          <CajaMobileMenu canRegister={puedeAbrir} />
        </div>
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
        cashLabel="Efectivo en caja"
        cashValue={summary.expectedCash}
        cashNote={`Inicial ${formatMoney(openingAmount)} + neto en efectivo`}
      />

      <Panel title="Movimientos del turno" description="Todo lo que entró y salió desde que se abrió la caja">
        <MovementsTabs movements={movements} canViewSales={canViewSales} canReprint={canReprint} />
      </Panel>
    </div>
  );
}
