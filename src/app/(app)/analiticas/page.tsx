import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { parseAnalyticsFilters, type AnalyticsSearchParams } from "@/lib/analytics";
import { loadAnalyticsData, MOSTRADOR } from "@/lib/analytics-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

function formatDateKey(key: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(new Date(`${key}T12:00:00Z`));
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

  const rawParams = await searchParams;
  const filters = parseAnalyticsFilters(rawParams, new Date());
  const puedeExportar = hasPermission(currentUser, ModuloNegocio.ANALITICAS, "exportar");
  const verCostos = hasSpecialPermission(currentUser, "verCostosMargenes");

  const [data, employees, products, brands, topLevelRubros, channelRows] = await Promise.all([
    loadAnalyticsData(filters, currentUser),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { channel: { not: null } },
      select: { channel: true },
      distinct: ["channel"],
    }),
  ]);

  const rubroOptions = buildRubroOptions(topLevelRubros);
  const channels = [MOSTRADOR, ...channelRows.map((o) => o.channel!).filter((c) => c !== MOSTRADOR)];

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
          <Label htmlFor="producto">Producto</Label>
          <Select
            name="producto"
            defaultValue={rawParams.producto ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(products.map((p) => [p.id, p.name])) }}
          >
            <SelectTrigger id="producto" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="marca">Marca</Label>
          <Select
            name="marca"
            defaultValue={rawParams.marca ?? "__all__"}
            items={{ __all__: "Todas", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
          >
            <SelectTrigger id="marca" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rubro">Rubro</Label>
          <Select
            name="rubro"
            defaultValue={rawParams.rubro ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(rubroOptions.map((r) => [r.id, r.label])) }}
          >
            <SelectTrigger id="rubro" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {rubroOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="canal">Canal</Label>
          <Select
            name="canal"
            defaultValue={rawParams.canal ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(channels.map((c) => [c, c])) }}
          >
            <SelectTrigger id="canal" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {channels.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total vendido</p>
          <p className="text-lg font-semibold">{formatMoney(data.totalVentas)}</p>
          <p className="text-xs text-muted-foreground">
            Período anterior: {formatMoney(data.periodoAnterior.totalVentas)}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Cantidad de ventas</p>
          <p className="text-lg font-semibold">{data.cantidadVentas}</p>
          <p className="text-xs text-muted-foreground">
            Período anterior: {data.periodoAnterior.cantidadVentas}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Ticket promedio</p>
          <p className="text-lg font-semibold">{formatMoney(data.ticketPromedio)}</p>
          <p className="text-xs text-muted-foreground">
            Período anterior: {formatMoney(data.periodoAnterior.ticketPromedio)}
          </p>
        </div>
        {verCostos && data.margen && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Margen</p>
            <p className="text-lg font-semibold">{formatMoney(data.margen.totalMargin)}</p>
            <p className="text-xs text-muted-foreground">{data.margen.marginPct.toFixed(1)}%</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Evolución diaria</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.evolucionDiaria.map((d) => (
              <TableRow key={d.day}>
                <TableCell>{formatDateKey(d.day)}</TableCell>
                <TableCell>{formatMoney(d.total)}</TableCell>
              </TableRow>
            ))}
            {data.evolucionDiaria.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                  No hay ventas en el rango filtrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-6 sm:grid-cols-3">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Por empleado</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Ventas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porEmpleado.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.label}</TableCell>
                  <TableCell>{formatMoney(g.total)}</TableCell>
                  <TableCell>{g.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Por turno de caja</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turno</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Ventas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porTurno.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.label}</TableCell>
                  <TableCell>{formatMoney(g.total)}</TableCell>
                  <TableCell>{g.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Por canal</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Ventas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porCanal.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.label}</TableCell>
                  <TableCell>{formatMoney(g.total)}</TableCell>
                  <TableCell>{g.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Productos más vendidos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.masVendidos.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.label}</TableCell>
                  <TableCell>{g.cantidad}</TableCell>
                  <TableCell>{formatMoney(g.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        {data.sinMovimiento && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Productos sin movimiento</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sinMovimiento.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                  </TableRow>
                ))}
                {data.sinMovimiento.length === 0 && (
                  <TableRow>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      Todos los productos tuvieron movimiento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        )}
      </div>

      {verCostos && data.valorizacionStock !== null && (
        <section className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Valorización del stock actual</p>
          <p className="text-lg font-semibold">{formatMoney(data.valorizacionStock)}</p>
        </section>
      )}

      {verCostos && data.margenPorProducto && data.margenPorMarca && data.margenPorRubro && (
        <div className="grid gap-6 sm:grid-cols-3">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Margen por producto</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.margenPorProducto.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>{g.label}</TableCell>
                    <TableCell>{formatMoney(g.totalMargin)}</TableCell>
                    <TableCell>{g.marginPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Margen por marca</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.margenPorMarca.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>{g.label}</TableCell>
                    <TableCell>{formatMoney(g.totalMargin)}</TableCell>
                    <TableCell>{g.marginPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Margen por rubro</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.margenPorRubro.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>{g.label}</TableCell>
                    <TableCell>{formatMoney(g.totalMargin)}</TableCell>
                    <TableCell>{g.marginPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Diferencias de caja por empleado</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Diferencia total</TableHead>
              <TableHead>Cierres</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.diferenciasCaja.map((g) => (
              <TableRow key={g.key}>
                <TableCell>{g.label}</TableCell>
                <TableCell>{formatMoney(g.total)}</TableCell>
                <TableCell>{g.count}</TableCell>
              </TableRow>
            ))}
            {data.diferenciasCaja.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  No hubo cierres de caja en el rango filtrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
