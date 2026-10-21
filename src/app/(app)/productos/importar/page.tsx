import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { ImportWizard } from "./import-wizard";

export default async function ImportarProductosPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "crear")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para importar productos.</p>;
  }
  if (!hasSpecialPermission(currentUser, "cambiarPrecios")) {
    return (
      <p className="text-sm text-muted-foreground">
        Importar productos implica fijarles un precio, y no tenés el permiso &quot;cambiar precios&quot;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Importar productos</h1>
        <Link href="/productos/importar/plantilla" className="text-sm underline">
          Descargar plantilla
        </Link>
      </div>
      <ImportWizard />
    </div>
  );
}
