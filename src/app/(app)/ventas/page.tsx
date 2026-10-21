import Link from "next/link";
import { History } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/stat-card";
import { cn } from "@/lib/utils";
import { SaleForm } from "./sale-form";

export default async function VentasPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.VENTAS, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para vender.</p>;
  }

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });
  const puedeVerCaja = hasPermission(currentUser, ModuloNegocio.CAJA, "ver");
  const puedeVerHistorial = hasPermission(currentUser, ModuloNegocio.VENTAS, "ver");

  return (
    <div className="flex flex-col gap-4 lg:min-h-[calc(100svh-5.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Ventas</h1>
          <Badge variant={shift ? "default" : "outline"}>{shift ? "Caja abierta" : "Caja cerrada"}</Badge>
        </div>
        {puedeVerHistorial && (
          <Link href="/ventas/historial" className={cn(buttonVariants({ variant: "outline" }))}>
            <History data-icon="inline-start" />
            Historial
          </Link>
        )}
      </div>

      {shift ? (
        <SaleForm />
      ) : (
        <Panel
          title="No hay una caja abierta"
          description="Para vender hace falta tener una caja abierta: ahí se registra lo que se cobra."
          className="max-w-md"
        >
          {puedeVerCaja ? (
            <Link href="/caja" className={cn(buttonVariants())}>
              Ir a Caja
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Pedile a alguien con permiso que abra la caja.</p>
          )}
        </Panel>
      )}
    </div>
  );
}
