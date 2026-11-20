import Link from "next/link";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { loadLinkView, requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { LinkView } from "./link-view";

export default async function VincularPublicacionesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para vincular publicaciones.</p>;
  }

  const connection = await requireMlConnection();
  if (!connection.ok) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Vincular publicaciones</h1>
        <p className="text-sm text-muted-foreground">
          {connection.error}{" "}
          <Link href="/configuracion?tab=mercadolibre" className="underline">
            Ir a Configuración
          </Link>
        </p>
      </div>
    );
  }

  const view = await loadLinkView(connection.mlUserId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Vincular publicaciones</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Al vincular manda el sistema: la publicación queda con el precio de venta, el SKU y la cantidad según el stock
          del producto. Antes de confirmar se muestra qué cambia. Tené el inventario al día antes de vincular.
        </p>
      </div>
      {view.ok ? (
        <LinkView candidates={view.candidates} notLinkable={view.notLinkable} />
      ) : (
        <p className="text-sm text-destructive">No se pudieron traer las publicaciones. {view.error}</p>
      )}
    </div>
  );
}
