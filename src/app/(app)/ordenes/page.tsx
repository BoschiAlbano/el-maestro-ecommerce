import Link from "next/link";
import { after } from "next/server";
import { TriangleAlert } from "lucide-react";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { INVOICE_STATE_LABELS, type OrderInvoiceState } from "@/lib/mercadolibre/orders/invoice-state";
import { deadlineState } from "@/lib/mercadolibre/orders/order-alerts";
import { ORDER_STATUS_LABELS } from "@/lib/mercadolibre/orders/order-status";
import { fetchRecentOrdersSafely } from "@/lib/mercadolibre/orders/orders";
import { INVOICE_FILTERS, loadOrders, ORDER_FILTERS, parseInvoiceFilter, parseOrderFilter } from "@/lib/mercadolibre/orders/orders-view";
import { tucumanMidnightUtc, addDaysToDateKey } from "@/lib/analytics";
import { FilterForm } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoRefresh } from "../publicaciones/auto-refresh";
import { FetchOrdersButton } from "./fetch-orders-button";

function money(value: string) {
  return `$${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

/** La marca de la factura en la lista (specs/024, RF-21): lo que hay que mirar, resaltado. */
const INVOICE_BADGE: Record<OrderInvoiceState, "default" | "secondary" | "outline" | "destructive"> = {
  none: "outline",
  pending: "destructive",
  not_uploaded: "destructive",
  uploaded: "secondary",
  external: "secondary",
  voided: "secondary",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Tucuman" }).format(date);
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; factura?: string; desde?: string; hasta?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las órdenes de Mercado Libre.</p>;
  }

  const { estado, factura, desde, hasta } = await searchParams;
  const key = parseOrderFilter(estado);
  const invoiceKey = parseInvoiceFilter(factura);
  const dateKey = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = dateKey(desde) ? tucumanMidnightUtc(dateKey(desde)!) : undefined;
  const to = dateKey(hasta) ? tucumanMidnightUtc(addDaysToDateKey(dateKey(hasta)!, 1)) : undefined;

  const connection = await requireMlConnection();
  // Al abrir la pantalla se buscan las compras que falten, como mucho una vez por
  // minuto, sin demorar la respuesta: aparecen en la próxima actualización (RF-14).
  if (connection.ok) after(() => fetchRecentOrdersSafely());

  const [rows, settings] = await Promise.all([
    loadOrders({ key, invoice: invoiceKey, from, to }),
    prisma.setting.findUnique({ where: { id: "singleton" }, select: { mlOrdersStartDate: true } }),
  ]);
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Órdenes de Mercado Libre</h1>
        <div className="flex flex-wrap gap-2">
          <AutoRefresh />
          {connection.ok && <FetchOrdersButton />}
        </div>
      </div>

      {!connection.ok && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {connection.error} Mientras tanto no entran compras nuevas.{" "}
            <Link href="/configuracion?tab=mercadolibre" className="underline">
              Ir a Configuración
            </Link>
          </p>
        </div>
      )}

      {!settings?.mlOrdersStartDate && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Falta la fecha desde la que se registran las compras: hasta cargarla no entra ninguna.{" "}
            <Link href="/configuracion?tab=mercadolibre" className="underline">
              Cargarla en Configuración
            </Link>
          </p>
        </div>
      )}

      <FilterForm
        toggleBelow
        activeCount={(estado && key !== "pendientes" ? 1 : 0) + (invoiceKey !== "todas" ? 1 : 0) + (desde ? 1 : 0) + (hasta ? 1 : 0)}
        search={
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Select
              name="estado"
              defaultValue={key}
              items={Object.fromEntries(Object.entries(ORDER_FILTERS).map(([k, v]) => [k, v.label]))}
            >
              <SelectTrigger id="estado" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_FILTERS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="factura">Factura</Label>
          <Select name="factura" defaultValue={invoiceKey} items={INVOICE_FILTERS}>
            <SelectTrigger id="factura" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INVOICE_FILTERS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={dateKey(desde)} className="w-full sm:w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={dateKey(hasta)} className="w-full sm:w-40" />
        </div>
      </FilterForm>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Compra</TableHead>
            <TableHead>Comprador</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead>Despachar hasta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const deadline = deadlineState(row, now);
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/ordenes/${row.id}`} className="font-medium hover:underline">
                    #{row.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</p>
                </TableCell>
                <TableCell>{row.buyerNickname}</TableCell>
                <TableCell>
                  <ul className="text-sm">
                    {row.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity} × {item.title}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.fraudRisk && <Badge variant="destructive">Riesgo de fraude</Badge>}
                    {row.outOfStock && <Badge variant="destructive">Sin stock</Badge>}
                    {row.needsReview && <Badge variant="outline">Revisar</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">{money(row.total)}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "CANCELLED" || row.status === "NOT_DELIVERED" ? "secondary" : "default"}>
                    {ORDER_STATUS_LABELS[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={INVOICE_BADGE[row.invoiceState]}>{INVOICE_STATE_LABELS[row.invoiceState]}</Badge>
                </TableCell>
                <TableCell>
                  {row.dispatchDeadline ? (
                    <span
                      className={
                        deadline === "overdue"
                          ? "font-medium text-destructive"
                          : deadline === "soon"
                            ? "font-medium text-amber-700 dark:text-amber-300"
                            : undefined
                      }
                    >
                      {formatDateTime(row.dispatchDeadline)}
                      {deadline === "overdue" && " · vencida"}
                      {deadline === "soon" && " · vence pronto"}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                {key === "pendientes" ? "No hay compras por despachar." : "No hay compras para estos filtros."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
