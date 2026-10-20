import { hasPermission, isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadResetCounts } from "@/lib/system-reset-data";
import { summarizeReset } from "@/lib/system-reset";
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
  // La pestaña "Sistema" (reiniciar todo) es solo del Dueño (specs/017).
  const resetSummary = isOwner(currentUser) ? summarizeReset(await loadResetCounts(currentUser.id)) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Configuración</h1>
      {puedeEditar ? (
        <SettingsForm settings={settings} resetSummary={resetSummary} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Tenés permiso para ver estos datos, pero no para editarlos.
        </p>
      )}
    </div>
  );
}
