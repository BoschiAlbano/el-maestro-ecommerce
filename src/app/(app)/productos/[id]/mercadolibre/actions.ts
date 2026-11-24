"use server";

import { revalidatePath } from "next/cache";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasSpecialPermission, requirePermission } from "@/lib/permissions";
import { uploadProductPhoto } from "@/lib/upload-photo";
import { mlErrorMessage } from "@/lib/mercadolibre/listings";
import type { CategoryField } from "@/lib/mercadolibre/publish/category-form";
import type { Estimate } from "@/lib/mercadolibre/publish/estimate";
import { suggestCategories, type CategoryInfo, type CategorySuggestion } from "@/lib/mercadolibre/publish/publish-api";
import {
  estimatePublication,
  loadCategoryForm,
  publishProduct,
  reviewPublication,
  savePublicationData,
  updatePublication,
  type PublishResult,
  type ReviewOutcome,
  type SaveResult,
  type UpdateResult,
} from "@/lib/mercadolibre/publish/publications";

// Acciones del formulario de publicación (specs/025, plan secciones 3.2 a 3.5
// y 4). Todas validan el permiso en el servidor.

/** El precio de venta se cambia con el permiso especial, igual que en la ficha del producto (RF-4b). */
function canChangePrice(currentUser: Parameters<typeof hasSpecialPermission>[0]): boolean {
  return hasSpecialPermission(currentUser, "cambiarPrecios");
}

function revalidate(productId: string) {
  revalidatePath(`/productos/${productId}`);
  revalidatePath("/publicaciones");
}

/** «Sugerir categoría» (RF-2). */
export async function suggestCategoriesAction(title: string): Promise<{ suggestions: CategorySuggestion[] } | { error: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  try {
    return { suggestions: await suggestCategories(String(title).slice(0, 200)) };
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }
}

export type CategoryFormView = {
  info: CategoryInfo;
  fields: CategoryField[];
  gtin: { gtin: boolean; required: boolean };
  emptyGtinReasons: { id: string; name: string }[];
};

/** Lo que pide la categoría elegida (RF-2). */
export async function loadCategoryFormAction(categoryId: string): Promise<CategoryFormView | { error: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  if (!/^MLA\d+$/.test(String(categoryId))) return { error: "La categoría no es válida." };
  try {
    const form = await loadCategoryForm(categoryId);
    if (!form.info.listingAllowed) return { error: "Mercado Libre no admite publicaciones en esa categoría: elegí otra más específica." };
    return { info: form.info, fields: form.fields, gtin: form.rules.gtin, emptyGtinReasons: form.emptyGtinReasons };
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }
}

/** La estimación de lo que cobra Mercado Libre (RF-4). La diferencia contra el costo, solo con el permiso. */
export async function estimateAction(
  productId: string,
  input: {
    categoryId: string;
    listingType: "gold_special" | "gold_pro";
    package: { heightCm: number; widthCm: number; lengthCm: number; weightG: number } | null;
    price?: string | null;
  },
): Promise<Estimate | { error: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver");
  if (!/^MLA\d+$/.test(String(input.categoryId))) return { error: "Elegí la categoría." };
  const listingType = input.listingType === "gold_pro" ? "gold_pro" : "gold_special";
  const pkg = input.package;
  const valid = pkg && [pkg.heightCm, pkg.widthCm, pkg.lengthCm, pkg.weightG].every((n) => Number.isInteger(n) && n > 0 && n <= 100_000);
  return estimatePublication(
    productId,
    { categoryId: input.categoryId, listingType, package: valid ? pkg : null, price: typeof input.price === "string" ? input.price.slice(0, 20) : null },
    hasSpecialPermission(currentUser, "verCostosMargenes"),
  );
}

/** «Guardar» (RF-1). */
export async function savePublicationAction(productId: string, input: unknown): Promise<SaveResult> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const result = await savePublicationData(productId, input, currentUser.id, canChangePrice(currentUser));
  revalidate(productId);
  return result;
}

/** «Revisar con Mercado Libre» (RF-6): guarda y revisa sin crear nada. */
export async function reviewPublicationAction(productId: string, input: unknown): Promise<ReviewOutcome | { error: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const saved = await savePublicationData(productId, input, currentUser.id, canChangePrice(currentUser));
  if ("error" in saved) return saved;
  revalidate(productId);
  return reviewPublication(productId);
}

/** «Publicar» (RF-6 a RF-8): guarda y publica. */
export async function publishAction(productId: string, input: unknown): Promise<PublishResult> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear");
  const saved = await savePublicationData(productId, input, currentUser.id, canChangePrice(currentUser));
  if ("error" in saved) return { ok: false, error: saved.error };
  const result = await publishProduct(productId, currentUser.id);
  revalidate(productId);
  return result;
}

/** «Guardar y enviar a Mercado Libre» en una publicación creada desde el sistema (RF-9). */
export async function updatePublicationAction(productId: string, input: unknown): Promise<UpdateResult> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const result = await updatePublication(productId, input, currentUser.id, canChangePrice(currentUser));
  revalidate(productId);
  return result;
}

/** Sube una foto de la publicación al mismo almacenamiento que las del catálogo. */
export async function uploadPublicationPhotoAction(formData: FormData): Promise<{ url: string } | { error: string }> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí una foto." };
  try {
    return { url: await uploadProductPhoto(file) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo subir la foto." };
  }
}
