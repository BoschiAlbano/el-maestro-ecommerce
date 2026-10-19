import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAnalyticsFilters, type AnalyticsSearchParams } from "@/lib/analytics";
import { loadAnalyticsData } from "@/lib/analytics-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Panel, StatCard } from "@/components/stat-card";
import { PaymentMethodsChart } from "@/components/analytics/payment-methods-chart";
import { TopProductsChart } from "@/components/analytics/top-products-chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

export default async function AnaliticasPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.ANALITICAS, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las analíticas.</p>;
  }

  const { desde, hasta, empleado, medioPago } = await searchParams;
  // Solo estos cuatro filtros existen en pantalla: un link viejo con ?marca=… no debe filtrar a escondidas.
  const rawParams: AnalyticsSearchParams = { desde, hasta, empleado, medioPago };
  const filters = parseAnalyticsFilters(rawParams, new Date());
  const puedeExportar = hasPermission(currentUser, ModuloNegocio.ANALITICAS, "exportar");
  const verCostos = hasSpecialPermission(currentUser, "verCostosMargenes");

  const [data, employees] = await Promise.all([
    loadAnalyticsData(filters, currentUser),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const desdeDefault = filters.from.toISOString().slice(0, 10);
  const hastaDefault = new Date(filters.to.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const queryString = new URLSearchParams(
    Object.entries(rawParams).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analíticas</h1>
        {puedeExportar && (
          <div className="flex gap-2">
            <Link
              href={`/analiticas/exportar/excel${queryString ? `?${queryString}` : ""}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Exportar Excel
            </Link>
            <Link
              href={`/analiticas/exportar/pdf${queryString ? `?${queryString}` : ""}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Exportar PDF
            </Link>
          </div>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desdeDefault} className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hastaDefault} className="w-40" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="empleado">Empleado</Label>
          <Select
            name="empleado"
            defaultValue={rawParams.empleado ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(employees.map((e) => [e.id, e.name])) }}
          >
            <SelectTrigger id="empleado" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="medioPago">Medio de pago</Label>
          <Select
            name="medioPago"
            defaultValue={rawParams.medioPago ?? "__all__"}
            items={{ __all__: "Todos", EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
          >
            <SelectTrigger id="medioPago" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="EFECTIVO">Efectivo</SelectItem>
              <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total vendido"
          value={formatMoney(data.totalVentas)}
          hint={`Período anterior: ${formatMoney(data.periodoAnterior.totalVentas)}`}
        />
        <StatCard
          label="Cantidad de ventas"
          value={data.cantidadVentas.toLocaleString("es-AR")}
          hint={`Período anterior: ${data.periodoAnterior.cantidadVentas.toLocaleString("es-AR")}`}
        />
        <StatCard
          label="Ticket promedio"
          value={formatMoney(data.ticketPromedio)}
          hint={`Período anterior: ${formatMoney(data.periodoAnterior.ticketPromedio)}`}
        />
        <StatCard
          label="Unidades vendidas"
          value={data.unidadesVendidas.toLocaleString("es-AR")}
          hint={`Período anterior: ${data.periodoAnterior.unidadesVendidas.toLocaleString("es-AR")}`}
        />
        <StatCard
          label="Ventas anuladas"
          value={data.ventasAnuladas.cantidad.toLocaleString("es-AR")}
          hint={`${formatMoney(data.ventasAnuladas.total)} anulados`}
        />
        <StatCard
          label="Venta más grande"
          value={data.ventaMasGrande ? formatMoney(data.ventaMasGrande.total) : "—"}
          hint={
            data.ventaMasGrande
              ? `${data.ventaMasGrande.employeeName} · ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Tucuman" }).format(data.ventaMasGrande.createdAt)}`
              : "Sin ventas en el rango"
          }
        />
        {verCostos && data.costoVendido !== null && (
          <StatCard
            label="Costo de lo vendido"
            value={formatMoney(data.costoVendido)}
            hint="Costo de la mercadería vendida"
          />
        )}
        {verCostos && data.margen && (
          <StatCard
            label="Margen"
            value={formatMoney(data.margen.totalMargin)}
            hint={`${data.margen.marginPct.toFixed(1)}% sobre lo vendido`}
          />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Panel title="Top 5 productos más vendidos" description="Por unidades vendidas" className="lg:col-span-3">
          <TopProductsChart data={data.masVendidos.slice(0, 5)} />
        </Panel>
        <Panel title="Cobrado por medio de pago" description="Efectivo y transferencia" className="lg:col-span-2">
          <PaymentMethodsChart data={data.porMedioPago} />
        </Panel>
      </section>

      {verCostos && data.margenPorMarca && data.margenPorRubro && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Margen por marca">
            <MarginTable rows={data.margenPorMarca} firstColumn="Marca" />
          </Panel>
          <Panel title="Margen por rubro">
            <MarginTable rows={data.margenPorRubro} firstColumn="Rubro" />
          </Panel>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Ventas por empleado">
          <TotalsTable rows={data.porEmpleado} firstColumn="Empleado" />
        </Panel>
        <Panel title="Ventas por canal">
          <TotalsTable rows={data.porCanal} firstColumn="Canal" />
        </Panel>
      </section>

      <Panel title="Ventas por turno de caja">
        <TotalsTable rows={data.porTurno} firstColumn="Turno" />
      </Panel>
    </div>
  );
}

function TotalsTable({
  rows,
  firstColumn,
}: {
  rows: { key: string; label: string; total: number; count: number }[];
  firstColumn: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{firstColumn}</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((g) => (
          <TableRow key={g.key}>
            <TableCell>{g.label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(g.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{g.count}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
              No hay ventas en el rango filtrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function MarginTable({
  rows,
  firstColumn,
}: {
  rows: { key: string; label: string; totalMargin: number; marginPct: number }[];
  firstColumn: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{firstColumn}</TableHead>
          <TableHead className="text-right">Margen</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((g) => (
          <TableRow key={g.key}>
            <TableCell>{g.label}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(g.totalMargin)}</TableCell>
            <TableCell className="text-right tabular-nums">{g.marginPct.toFixed(1)}%</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
              No hay ventas en el rango filtrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
