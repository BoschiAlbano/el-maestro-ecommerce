import { hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ModuloNegocio } from "@/generated/prisma/client";
import { SettingsForm } from "./settings-form";

export default async function ConfiguracionPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CONFIGURACION, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver esta sección.</p>;
  }

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const puedeEditar = hasPermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Configuración</h1>
      {puedeEditar ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Tenés permiso para ver estos datos, pero no para editarlos.
        </p>
      )}
    </div>
  );
}
