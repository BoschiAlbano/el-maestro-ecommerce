import { hasPermission, isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadResetCounts } from "@/lib/system-reset-data";
import { summarizeReset } from "@/lib/system-reset";
import { loadMlConnectionView } from "@/lib/mercadolibre/connection";
import { ML_RESULT_PARAM, parseMlResult } from "@/lib/mercadolibre/connection-result";
import { SettingsForm } from "./settings-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ConfiguracionPage({ searchParams }: { searchParams: SearchParams }) {
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
  const owner = isOwner(currentUser);
  const resetSummary = owner ? summarizeReset(await loadResetCounts(currentUser.id)) : undefined;

  // La pestaña "Mercado Libre" (specs/019) se ve con permiso "ver"; conectar y
  // desconectar son solo del Dueño y se validan en cada acción.
  const params = await searchParams;
  const initialTab = typeof params.tab === "string" ? params.tab : undefined;
  const mercadoLibre = {
    view: await loadMlConnectionView(),
    isOwner: owner,
    result: parseMlResult(params[ML_RESULT_PARAM]),
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Configuración</h1>
      {!puedeEditar && (
        <p className="text-sm text-muted-foreground">
          Tenés permiso para ver estos datos, pero no para editarlos.
        </p>
      )}
      <SettingsForm
        settings={settings}
        canEdit={puedeEditar}
        resetSummary={resetSummary}
        mercadoLibre={mercadoLibre}
        initialTab={initialTab}
      />
    </div>
  );
}
