import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { loadHomeData } from "@/lib/home-data";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Panel, StatCard } from "@/components/stat-card";
import { PaymentMethodsChart } from "@/components/analytics/payment-methods-chart";
import { TopProductsChart } from "@/components/analytics/top-products-chart";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "America/Argentina/Tucuman" }).format(date);
}

function salesHint(count: number) {
  return `${count} ${count === 1 ? "venta" : "ventas"}`;
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Inicio</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const data = await loadHomeData(currentUser);

  if (!data.caja && !data.pedidos && !data.stock) {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Inicio</CardTitle>
          <CardDescription>
            Por ahora esto es solo el esqueleto de la spec 001: navegación, sesión y conexión a la base
            funcionando.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { caja, pedidos, stock } = data;
  const turno = caja?.open ?? null;

  return (
    <div className="flex flex-col gap-6">
      {caja && (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Turno actual</h2>
              <Link href="/caja" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Ir a Caja
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Estado de caja"
                value={turno ? "Abierta" : "Cerrada"}
                hint={
                  turno
                    ? `${turno.openedByName} · desde ${formatDate(turno.openedAt, { timeStyle: "short" })}`
                    : "No hay ninguna caja abierta"
                }
              />
              <StatCard
                label="Efectivo esperado"
                value={turno ? formatMoney(turno.expectedCash) : "—"}
                hint="Lo que debería haber en caja"
              />
              <StatCard
                label="Ventas del turno"
                value={turno ? formatMoney(turno.ventas.total) : "—"}
                hint={turno ? salesHint(turno.ventas.count) : "Sin caja abierta"}
              />
              <StatCard
                label="Transferencias del turno"
                value={turno ? formatMoney(turno.transferencias) : "—"}
                hint={turno ? "Para controlar el cierre" : "Sin caja abierta"}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Hoy</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Ingresos de hoy" value={formatMoney(caja.today.ingresos)} hint="Todos los turnos" />
              <StatCard label="Egresos de hoy" value={formatMoney(caja.today.egresos)} hint="Todos los turnos" />
              <StatCard label="Neto de hoy" value={formatMoney(caja.today.neto)} hint="Ingresos menos egresos" />
              <StatCard
                label="Ventas de hoy"
                value={formatMoney(caja.today.ventas.total)}
                hint={salesHint(caja.today.ventas.count)}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Cobrado hoy por medio de pago" description="Efectivo y transferencia">
              <PaymentMethodsChart data={caja.today.porMedioPago} />
            </Panel>
            <Panel title="Top 5 productos más vendidos hoy" description="Por unidades vendidas, todos los turnos">
              <TopProductsChart data={caja.today.topProductos} emptyMessage="Todavía no hubo ventas hoy." />
            </Panel>
          </section>
        </>
      )}

      {(pedidos || stock) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {pedidos && (
            <Panel
              title="Pedidos pendientes"
              description={pedidos.count === 0 ? "No hay pedidos pendientes" : `${pedidos.count} en total · los más antiguos primero`}
            >
              <div className="flex flex-col gap-3">
                {pedidos.proximos.length > 0 && (
                  <ul className="divide-y text-sm">
                    {pedidos.proximos.map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/pedidos/${order.id}`} className="truncate hover:underline">
                          {order.customerName}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(order.createdAt, { dateStyle: "short" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/pedidos" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
                  Ir a Pedidos
                </Link>
              </div>
            </Panel>
          )}

          {stock && (
            <Panel
              title="Productos bajo el mínimo"
              description={
                stock.alertCount === 0
                  ? "Ningún producto está por debajo del stock que necesitás."
                  : `${stock.alertCount} producto(s) por debajo del stock que necesitás · los de mayor faltante primero`
              }
            >
              <div className="flex flex-col gap-3">
                {stock.top.length > 0 && (
                  <ul className="divide-y text-sm">
                    {stock.top.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Disponible {item.available} · Sugerida{" "}
                          <span className="font-medium text-foreground">{item.suggested}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/lista-de-viaje"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
                >
                  Ver lista de viaje
                </Link>
              </div>
            </Panel>
          )}
        </section>
      )}
    </div>
  );
}
