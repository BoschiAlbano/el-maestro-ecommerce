import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SALES_PERIOD_LABELS, parseSalesPeriod, salesPeriodRange, type SalesPeriod } from "@/lib/sales-history";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/stat-card";
import { cn } from "@/lib/utils";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import { SaleHistoryTabs, type SaleRow, type SaleView } from "./sale-history-tabs";

const DEFAULT_PAGE_SIZE = 10;

const VIEWS: SaleView[] = ["todas", "activas", "anuladas"];

const PERIOD_DESCRIPTIONS: Record<SalesPeriod, string> = {
  turno: "Las ventas del turno de caja que está abierto ahora.",
  hoy: "Las ventas de hoy, de todos los turnos.",
  "7dias": "Las ventas de hoy y de los 6 días anteriores.",
  todas: "Todas las ventas registradas.",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Tucuman",
  }).format(date);
}

export default async function HistorialVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; vista?: string; pagina?: string; porPagina?: string }>;
}) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.VENTAS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las ventas.</p>;
  }

  const puedeVender = hasPermission(currentUser, ModuloNegocio.VENTAS, "crear");

  const openShift = await prisma.cashShift.findFirst({ where: { closedAt: null }, select: { id: true } });
  const { periodo, vista, pagina } = await searchParams;
  const view = VIEWS.find((v) => v === vista) ?? "todas";
  const period = parseSalesPeriod(periodo, openShift !== null);

  const range = salesPeriodRange(period, new Date());
  const where: Prisma.SaleWhereInput =
    period === "turno" && openShift
      ? { shiftId: openShift.id }
      : range
        ? { createdAt: { gte: range.from, lt: range.to } }
        : {};

  // Los conteos de las pestañas son los del período completo, no los de la página.
  const [totalAll, totalVoided] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.count({ where: { ...where, voidedAt: { not: null } } }),
  ]);
  const counts: Record<SaleView, number> = {
    todas: totalAll,
    activas: totalAll - totalVoided,
    anuladas: totalVoided,
  };

  const total = counts[view];
  const listWhere: Prisma.SaleWhereInput =
    view === "activas" ? { ...where, voidedAt: null } : view === "anuladas" ? { ...where, voidedAt: { not: null } } : where;

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pagina), totalPages);

  const sales = await prisma.sale.findMany({
    where: listWhere,
    include: { user: true, shift: { select: { openedAt: true, closedAt: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const viewHref = (v: SaleView, p = 1) => {
    const params = new URLSearchParams({ periodo: period });
    if (v !== "todas") params.set("vista", v);
    if (p > 1) params.set("pagina", String(p));
    return `/ventas/historial?${params}`;
  };

  const rows: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    ticketNumber: sale.ticketNumber,
    when: formatDateTime(sale.createdAt),
    employee: sale.user.name,
    total: sale.total.toNumber(),
    voided: sale.voidedAt !== null,
    shift: { label: formatDateTime(sale.shift.openedAt), current: sale.shift.closedAt === null },
  }));

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Historial de ventas</h1>
        {puedeVender && (
          <Link href="/ventas" className={cn(buttonVariants())}>
            <ShoppingCart data-icon="inline-start" />
            Nueva venta
          </Link>
        )}
      </div>

      <nav aria-label="Período del historial" className="flex flex-wrap gap-2">
        {(Object.keys(SALES_PERIOD_LABELS) as SalesPeriod[]).map((option) => {
          const disabled = option === "turno" && !openShift;
          const active = option === period;
          if (disabled) {
            return (
              <span
                key={option}
                aria-disabled="true"
                title="No hay una caja abierta"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}
              >
                {SALES_PERIOD_LABELS[option]}
              </span>
            );
          }
          return (
            <Link
              key={option}
              href={`/ventas/historial?periodo=${option}`}
              aria-current={active ? "true" : undefined}
              className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }))}
            >
              {SALES_PERIOD_LABELS[option]}
            </Link>
          );
        })}
      </nav>

      <Panel
        title={SALES_PERIOD_LABELS[period]}
        description={PERIOD_DESCRIPTIONS[period]}
        className="flex-1"
        contentClassName="flex flex-1 flex-col"
      >
        <div className="flex flex-1 flex-col gap-4">
          <SaleHistoryTabs
            sales={rows}
            showShift={period !== "turno"}
            view={view}
            counts={counts}
            hrefs={{ todas: viewHref("todas"), activas: viewHref("activas"), anuladas: viewHref("anuladas") }}
          />
          <div className="mt-auto">
          <TablePagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={(p) => viewHref(view, p)} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
