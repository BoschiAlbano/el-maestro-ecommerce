import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { loadHomeData } from "@/lib/home-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
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
  const sinNada = !data.caja && data.pedidosPendientes === null && !data.stock;

  if (sinNada) {
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

  return (
    <div className="flex flex-col gap-4">
      {data.caja && (
        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
            <CardDescription>
              {data.caja.open
                ? `Abierta por ${data.caja.open.openedByName} desde ${new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Tucuman",
                  }).format(data.caja.open.openedAt)} · Efectivo esperado: ${formatMoney(
                    data.caja.open.expectedCash,
                  )}`
                : "No hay ninguna caja abierta en este momento."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="font-medium">Movimientos de hoy</p>
            <p className="text-muted-foreground">
              Ingresos {formatMoney(data.caja.today.ingresos)} · Egresos{" "}
              {formatMoney(data.caja.today.egresos)} · Neto {formatMoney(data.caja.today.neto)}
            </p>
            <Link href="/caja" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-fit")}>
              Ir a Caja
            </Link>
          </CardContent>
        </Card>
      )}

      {data.pedidosPendientes !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Pedidos pendientes</CardTitle>
            <CardDescription>{data.pedidosPendientes}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/pedidos" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
              Ir a Pedidos
            </Link>
          </CardContent>
        </Card>
      )}

      {data.stock && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de stock</CardTitle>
            <CardDescription>
              {data.stock.alertCount === 0
                ? "Ningún producto está por debajo del stock que necesitás."
                : `${data.stock.alertCount} producto(s) por debajo del stock que necesitás.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/lista-de-viaje"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
            >
              Ver lista de viaje
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
