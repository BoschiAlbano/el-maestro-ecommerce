import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { OrderForm } from "./order-form";

export default async function NuevoPedidoPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.PEDIDOS, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para crear pedidos.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Nuevo pedido</h1>
      <OrderForm />
    </div>
  );
}
