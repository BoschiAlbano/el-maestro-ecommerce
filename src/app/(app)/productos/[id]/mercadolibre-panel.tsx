import { ExternalLink, TriangleAlert } from "lucide-react";
import { ModuloNegocio } from "@/generated/prisma/client";
import { hasPermission, hasSpecialPermission, type UserLike } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/mercadolibre/listing-status";
import { mlErrorMessage } from "@/lib/mercadolibre/listings";
import { requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { loadCategoryForm, loadPublicationForm } from "@/lib/mercadolibre/publish/publications";
import { Badge } from "@/components/ui/badge";
import type { CategoryFormView } from "./mercadolibre/actions";
import { PublicationForm } from "./mercadolibre/publication-form";

/**
 * Pestaña «Mercado Libre» de la ficha del producto (specs/025, RF-11): el
 * estado de la publicación y el formulario para publicar o editarla.
 */
export async function MercadoLibrePanel({
  productId,
  currentUser,
  listing,
}: {
  productId: string;
  currentUser: UserLike;
  listing: { mlItemId: string; permalink: string; status: keyof typeof STATUS_LABELS; statusReason: string | null; linkedAt: Date; publishedFromSystem: boolean } | null;
}) {
  const form = await loadPublicationForm(productId);
  if (!form) return null;

  const connection = await requireMlConnection();
  let category: CategoryFormView | null = null;
  let categoryError: string | null = null;
  if (connection.ok && form.data.categoryId) {
    try {
      const loaded = await loadCategoryForm(form.data.categoryId);
      category = { info: loaded.info, fields: loaded.fields, gtin: loaded.rules.gtin, emptyGtinReasons: loaded.emptyGtinReasons };
    } catch (error) {
      categoryError = mlErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {listing && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"}>{STATUS_LABELS[listing.status]}</Badge>
          <a href={listing.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
            {listing.mlItemId}
            <ExternalLink className="size-3" />
          </a>
          <span className="text-muted-foreground">
            · {listing.publishedFromSystem ? "publicada desde el sistema" : "vinculada"} el{" "}
            {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Tucuman" }).format(listing.linkedAt)}
          </span>
          {listing.statusReason && listing.status !== "ACTIVE" && (
            <span className="basis-full text-xs text-muted-foreground">{listing.statusReason}</span>
          )}
        </div>
      )}

      {!connection.ok && <Notice>{connection.error}</Notice>}
      {categoryError && <Notice>No se pudo leer la categoría guardada: {categoryError}</Notice>}
      {!form.product.active && <Notice>El producto está desactivado: activalo antes de publicarlo.</Notice>}

      {listing && !listing.publishedFromSystem ? (
        // Una publicación vinculada desde Mercado Libre se sigue editando allá (plan, sección 3.5).
        <Notice>
          Este producto está vinculado a una publicación creada en Mercado Libre. Su contenido (título, fotos, descripción) se edita
          en Mercado Libre; el precio y el stock se siguen manteniendo desde el sistema.
        </Notice>
      ) : (
        <PublicationForm
          form={form}
          initialCategory={category}
          connected={connection.ok}
          canEdit={hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar")}
          canPublish={hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear")}
          canChangePrice={hasSpecialPermission(currentUser, "cambiarPrecios")}
        />
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
