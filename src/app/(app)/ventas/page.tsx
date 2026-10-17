import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SaleForm } from "./sale-form";

export default async function VentasPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.VENTAS, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para vender.</p>;
  }

  const shift = await prisma.cashShift.findFirst({ where: { closedAt: null } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ventas</h1>
        <Link href="/ventas/historial" className={cn(buttonVariants({ variant: "outline" }))}>
          Historial
        </Link>
      </div>

      {shift ? (
        <SaleForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          No hay una caja abierta. Abrí una caja antes de vender.
        </p>
      )}
    </div>
  );
}
