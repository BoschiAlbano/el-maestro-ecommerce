import Link from "next/link";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFiscalConfig } from "@/lib/facturacion/fiscal-data";
import { dateOnly } from "@/lib/facturacion/fechas";
import { KIND_TITLE, formatInvoiceNumber, formatIsoDate } from "@/lib/facturacion/invoice-document";
import { filtersToQuery, invoiceWhere, netTotal, parseInvoiceFilters } from "@/lib/facturacion/invoice-list";
import { loadAccumulatedSummary } from "@/lib/facturacion/invoices";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, StatCard } from "@/components/stat-card";
import { FilterForm } from "@/components/filter-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 20;

const STATUS_ITEMS = { all: "Todos", AUTHORIZED: "Emitidos", PENDING: "Pendientes" };
const KIND_ITEMS = { all: "Todos", FACTURA_C: "Facturas", NOTA_CREDITO_C: "Notas de crédito" };
const ENVIRONMENT_ITEMS = { HOMOLOGACION: "De prueba", PRODUCCION: "Reales", todos: "Todos" };
const ORIGIN_ITEMS = { all: "Todos", LOCAL: "Local", MERCADO_LIBRE: "Mercado Libre" };

const formatMoney = (n: number) => `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  // Los comprobantes y el acumulado contra el tope son del Dueño (specs/023, RF-24).
  if (!currentUser || !isOwner(currentUser)) {
    return <p className="text-sm text-muted-foreground">Solo el Dueño puede ver los comprobantes.</p>;
  }

  const params = await searchParams;
  const pageSize = parsePageSize(typeof params.porPagina === "string" ? params.porPagina : undefined, DEFAULT_PAGE_SIZE);
  const filters = parseInvoiceFilters(params);
  const config = await getFiscalConfig();
  const where = invoiceWhere(filters, config.environment);
  const environment = filters.environment ?? config.environment;

  const [total, pendingCount, sums] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.count({ where: { status: "PENDING", environment: config.environment } }),
    prisma.invoice.groupBy({ by: ["kind"], where: { ...where, status: "AUTHORIZED" }, _sum: { total: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(parsePage(typeof params.pagina === "string" ? params.pagina : undefined), totalPages);

  const invoices = await prisma.invoice.findMany({
    where,
    include: { relatedInvoice: { select: { pointOfSale: true, number: true } } },
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const billed = sums.find((s) => s.kind === "FACTURA_C")?._sum.total?.toNumber() ?? 0;
  const credited = sums.find((s) => s.kind === "NOTA_CREDITO_C")?._sum.total?.toNumber() ?? 0;
  const net = netTotal([
    { kind: "FACTURA_C", total: billed },
    { kind: "NOTA_CREDITO_C", total: credited },
  ]);

  const accumulated = await loadAccumulatedSummary(config.topeAnual);
  const query = filtersToQuery(filters);
  const exportHref = `/comprobantes/exportar${query.size > 0 ? `?${query}` : ""}`;
  const activeFilters = [filters.status !== "all", filters.kind !== "all", filters.origin !== "all", filters.environment !== null].filter(
    Boolean,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Comprobantes</h1>
          <Badge variant={config.environment === "PRODUCCION" ? "default" : "outline"}>
            {config.environment === "PRODUCCION" ? "Modo real" : "Modo de pruebas"}
          </Badge>
        </div>
        <a href={exportHref} className={cn(buttonVariants({ variant: "outline" }))}>
          <Download data-icon="inline-start" />
          Exportar a Excel
        </a>
      </div>

      {pendingCount > 0 && (
        <p role="status" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Hay {pendingCount} {pendingCount === 1 ? "comprobante pendiente" : "comprobantes pendientes"} de emitir.{" "}
          <Link href="/comprobantes?estado=PENDING" className="underline">
            Verlos
          </Link>
          . Se reintentan desde el detalle de cada venta.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Facturado" value={formatMoney(billed)} hint="Facturas emitidas con estos filtros" />
        <StatCard label="Notas de crédito" value={formatMoney(credited)} hint="Anulaciones emitidas" tone={credited > 0 ? "negative" : undefined} />
        <StatCard label="Neto" value={formatMoney(net)} hint="Facturas menos notas de crédito" tone="emphasis" />
        <StatCard
          label="Últimos 12 meses (reales)"
          value={formatMoney(accumulated.accumulated)}
          hint={
            accumulated.cap
              ? `${accumulated.percent} % del tope de ${formatMoney(accumulated.cap)}`
              : "Cargá el tope en Configuración > Facturación para ver el porcentaje"
          }
        />
      </section>
      {environment !== "PRODUCCION" && (
        <p className="text-xs text-muted-foreground">
          Los comprobantes de prueba no tienen validez fiscal y no cuentan para el tope del monotributo.
        </p>
      )}

      <FilterForm
        toggleBelow
        activeCount={activeFilters}
        search={
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" name="desde" type="date" defaultValue={filters.from ?? ""} className="w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" name="hasta" type="date" defaultValue={filters.to ?? ""} className="w-full" />
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select name="estado" defaultValue={filters.status} items={STATUS_ITEMS}>
            <SelectTrigger id="estado" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue={filters.kind} items={KIND_ITEMS}>
            <SelectTrigger id="tipo" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="origen">Origen</Label>
          <Select name="origen" defaultValue={filters.origin} items={ORIGIN_ITEMS}>
            <SelectTrigger id="origen" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORIGIN_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ambiente">Ambiente</Label>
          <Select name="ambiente" defaultValue={environment === "all" ? "todos" : environment} items={ENVIRONMENT_ITEMS}>
            <SelectTrigger id="ambiente" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENVIRONMENT_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterForm>

      <Panel title="Comprobantes" description={`${total} ${total === 1 ? "comprobante" : "comprobantes"} con estos filtros`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="whitespace-nowrap">
                  {invoice.issueDate ? formatIsoDate(dateOnly(invoice.issueDate)) : "—"}
                </TableCell>
                <TableCell>
                  {KIND_TITLE[invoice.kind]}
                  {invoice.environment === "HOMOLOGACION" && (
                    <Badge variant="outline" className="ml-2">
                      Prueba
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {invoice.number !== null ? formatInvoiceNumber(invoice.pointOfSale, invoice.number) : "—"}
                </TableCell>
                <TableCell>{invoice.origin === "MERCADO_LIBRE" ? "Mercado Libre" : "Local"}</TableCell>
                <TableCell>{invoice.receiverName ?? "Consumidor Final"}</TableCell>
                <TableCell className={cn("text-right tabular-nums", invoice.kind === "NOTA_CREDITO_C" && "text-destructive")}>
                  {invoice.kind === "NOTA_CREDITO_C" ? "−" : ""}
                  {formatMoney(invoice.total.toNumber())}
                </TableCell>
                <TableCell>
                  <Badge variant={invoice.status === "PENDING" ? "destructive" : "secondary"}>
                    {invoice.status === "PENDING" ? "Pendiente" : "Emitido"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="flex justify-end gap-3 text-sm">
                    <Link href={`/ventas/historial/${invoice.saleId}`} className="underline">
                      Venta
                    </Link>
                    {invoice.status === "AUTHORIZED" && (
                      <a href={`/comprobantes/${invoice.id}/pdf`} target="_blank" rel="noreferrer" className="underline">
                        PDF
                      </a>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No hay comprobantes para estos filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        buildHref={(p) => {
          const next = filtersToQuery(filters);
          if (p > 1) next.set("pagina", String(p));
          const qs = next.toString();
          return qs ? `/comprobantes?${qs}` : "/comprobantes";
        }}
      />
    </div>
  );
}
