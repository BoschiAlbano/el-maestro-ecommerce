import { hasPermission, isOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadResetCounts } from "@/lib/system-reset-data";
import { summarizeReset } from "@/lib/system-reset";
import { loadMlConnectionView } from "@/lib/mercadolibre/connection";
import { asListingType, asWarrantyType } from "@/lib/mercadolibre/publish/publication-rules";
import { toTucumanDateKey } from "@/lib/analytics";
import { loadFacturacionView } from "@/lib/facturacion/facturacion-view";
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
  const mlSettings = await prisma.setting.findUnique({
    where: { id: "singleton" },
    select: { mlOrdersStartDate: true, mlDefaultListingType: true, mlDefaultWarrantyType: true, mlDefaultWarrantyDays: true, mlDefaultLocalPickUp: true },
  });
  const mercadoLibre = {
    view: await loadMlConnectionView(),
    isOwner: owner,
    result: parseMlResult(params[ML_RESULT_PARAM]),
    // Fecha de inicio de las órdenes (specs/022, RF-9b), como día de Tucumán.
    ordersStartDate: mlSettings?.mlOrdersStartDate ? toTucumanDateKey(mlSettings.mlOrdersStartDate) : null,
    // Valores por defecto de las publicaciones (specs/025, RF-5). Sin fila, los de la migración.
    publicationDefaults: {
      listingType: asListingType(mlSettings?.mlDefaultListingType),
      warrantyType: mlSettings === null ? ("SELLER" as const) : asWarrantyType(mlSettings.mlDefaultWarrantyType),
      warrantyDays: mlSettings === null ? 30 : mlSettings.mlDefaultWarrantyDays,
      localPickUp: mlSettings?.mlDefaultLocalPickUp ?? true,
    },
  };

  // La pestaña "Facturación" (specs/023) se ve con permiso "ver"; editar y los certificados son solo del Dueño.
  const facturacion = { view: await loadFacturacionView(), isOwner: owner };

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
        facturacion={facturacion}
        initialTab={initialTab}
      />
    </div>
  );
}
