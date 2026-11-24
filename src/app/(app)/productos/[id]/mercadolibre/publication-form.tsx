"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ExternalLink, ImagePlus, Search, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { keepForCategory, prefillFromSuggestion, type AttributeValue, type CategoryField } from "@/lib/mercadolibre/publish/category-form";
import type { Estimate } from "@/lib/mercadolibre/publish/estimate";
import { parsePrice } from "@/lib/mercadolibre/publish/price-change";
import { gtinDecision, missingForPublishing, photoUrls, type MissingItem, type PublicationData } from "@/lib/mercadolibre/publish/publication-rules";
import type { CategorySuggestion } from "@/lib/mercadolibre/publish/publish-api";
import type { PublicationForm as PublicationFormData } from "@/lib/mercadolibre/publish/publications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  estimateAction,
  loadCategoryFormAction,
  publishAction,
  reviewPublicationAction,
  savePublicationAction,
  suggestCategoriesAction,
  updatePublicationAction,
  uploadPublicationPhotoAction,
  type CategoryFormView,
} from "./actions";
import { AttributeField, SELECT_CLASS } from "./attribute-field";

type Feedback = { missing: MissingItem[]; errors: string[]; warnings: string[]; success: string | null };
const NO_FEEDBACK: Feedback = { missing: [], errors: [], warnings: [], success: null };

function money(value: string | number) {
  return `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const toInt = (value: string): number | null => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * El formulario de publicación (specs/025, RF-1 a RF-9): título, categoría,
 * características, código universal, fotos, descripción, tipo, garantía,
 * envío, paquete y la estimación de lo que cobra Mercado Libre.
 */
export function PublicationForm({
  form,
  initialCategory,
  connected,
  canEdit,
  canPublish,
  canChangePrice,
}: {
  form: PublicationFormData;
  initialCategory: CategoryFormView | null;
  connected: boolean;
  canEdit: boolean;
  canPublish: boolean;
  /** Permiso especial «cambiar precios» (RF-4b). */
  canChangePrice: boolean;
}) {
  const router = useRouter();
  const published = form.listing?.publishedFromSystem === true;
  const [data, setData] = useState<PublicationData>(form.data);
  const [category, setCategory] = useState<CategoryFormView | null>(initialCategory);
  const [categoryName, setCategoryName] = useState<string | null>(form.categoryName);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(form.suggestedCategoryId);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[] | null>(null);
  const [sku, setSku] = useState("");
  // El precio de venta del producto, editable al lado de la estimación (RF-4b).
  const [price, setPrice] = useState(form.product.salePrice);
  const priceValue = parsePrice(price);
  const priceChanged = priceValue !== null && !priceValue.equals(form.product.salePrice);
  const [estimate, setEstimate] = useState<Estimate | { error: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(form.lastError ? { ...NO_FEEDBACK, errors: [form.lastError] } : NO_FEEDBACK);
  const [pending, startTransition] = useTransition();
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [uploading, setUploading] = useState(false);

  const disabled = !canEdit || !connected || pending;
  const product = {
    ...form.product,
    sku: form.product.sku ?? (sku.trim() || null),
    salePrice: priceValue ? priceValue.toString() : form.product.salePrice,
  };
  const set = <K extends keyof PublicationData>(key: K, value: PublicationData[K]) => setData((d) => ({ ...d, [key]: value }));

  const rules = category
    ? { fields: category.fields, gtin: category.gtin, maxTitleLength: category.info.maxTitleLength, maxPictures: category.info.maxPictures, minimumPrice: category.info.minimumPrice }
    : null;
  const missing = missingForPublishing(data, product, rules);
  const gtin = category ? gtinDecision(product, category.gtin) : null;
  const photos = photoUrls(data, form.product);

  // La estimación se recalcula al cambiar el tipo, la categoría o el paquete (plan, sección 3.2).
  const pkg = [data.packageHeightCm, data.packageWidthCm, data.packageLengthCm, data.packageWeightG];
  const pkgKey = pkg.join("x");
  useEffect(() => {
    if (!data.categoryId || !connected) return;
    const [heightCm, widthCm, lengthCm, weightG] = pkg;
    const full = heightCm && widthCm && lengthCm && weightG ? { heightCm, widthCm, lengthCm, weightG } : null;
    if (!priceValue) return;
    const timer = setTimeout(() => {
      estimateAction(form.product.id, { categoryId: data.categoryId!, listingType: data.listingType, package: full, price: priceValue.toString() })
        .then(setEstimate)
        .catch(() => setEstimate({ error: "No se pudo calcular la estimación." }));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pkgKey` resume las cuatro medidas y `price` al precio
  }, [data.categoryId, data.listingType, pkgKey, price, connected, form.product.id]);

  function attributeValue(id: string): AttributeValue | undefined {
    return data.attributes.find((a) => a.id === id);
  }

  function setAttribute(value: AttributeValue) {
    setData((d) => ({ ...d, attributes: [...d.attributes.filter((a) => a.id !== value.id), value] }));
  }

  function suggest() {
    startTransition(async () => {
      const result = await suggestCategoriesAction(data.title);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) toast.error("Mercado Libre no sugirió ninguna categoría: probá con un título más descriptivo.");
    });
  }

  async function chooseCategory(suggestion: CategorySuggestion, index: number) {
    setLoadingCategory(true);
    try {
      const loaded = await loadCategoryFormAction(suggestion.categoryId);
      if ("error" in loaded) {
        toast.error(loaded.error);
        return;
      }
      setCategory(loaded);
      setCategoryName(loaded.info.name);
      if (index === 0 || !suggestedCategoryId) setSuggestedCategoryId(suggestions?.[0]?.categoryId ?? suggestion.categoryId);
      setData((d) => ({
        ...d,
        categoryId: loaded.info.id,
        attributes: prefillFromSuggestion(keepForCategory(d.attributes, loaded.fields), suggestion.attributes),
      }));
      setSuggestions(null);
    } finally {
      setLoadingCategory(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("photo", file);
      const result = await uploadPublicationPhotoAction(formData);
      if ("error" in result) toast.error(result.error);
      else set("extraPhotoUrls", [...data.extraPhotoUrls, result.url]);
    } finally {
      setUploading(false);
    }
  }

  function payload() {
    return {
      ...data,
      categoryName,
      suggestedCategoryId,
      sku: form.product.sku ? null : sku.trim() || null,
      salePrice: priceChanged ? priceValue!.toString() : null,
    };
  }

  function save() {
    startTransition(async () => {
      const result = await savePublicationAction(form.product.id, payload());
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Datos guardados.");
        router.refresh();
      }
    });
  }

  function reviewNow() {
    startTransition(async () => {
      const result = await reviewPublicationAction(form.product.id, payload());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const ok = result.missing.length === 0 && result.errors.length === 0;
      setFeedback({ ...result, success: ok ? "Mercado Libre revisó la publicación y no encontró errores." : null });
      router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishAction(form.product.id, payload());
      if (result.ok) {
        setFeedback({ ...NO_FEEDBACK, warnings: result.warnings, success: `Publicada en Mercado Libre: ${result.mlItemId}.` });
        toast.success("Producto publicado en Mercado Libre.");
      } else {
        setFeedback({ missing: result.missing ?? [], errors: result.error ? [result.error, ...(result.errors ?? [])] : (result.errors ?? []), warnings: result.warnings ?? [], success: null });
      }
      router.refresh();
    });
  }

  function update() {
    startTransition(async () => {
      const result = await updatePublicationAction(form.product.id, payload());
      if (result.ok) {
        setFeedback({ ...NO_FEEDBACK, warnings: result.warnings, success: result.changed ? "Cambios enviados a Mercado Libre." : "No había cambios para enviar." });
      } else {
        setFeedback({ missing: result.missing ?? [], errors: result.error ? [result.error, ...(result.errors ?? [])] : (result.errors ?? []), warnings: [], success: null });
      }
      router.refresh();
    });
  }

  const groups: { title: string; fields: CategoryField[]; collapsible?: boolean }[] = category
    ? [
        { title: "Obligatorias", fields: category.fields.filter((f) => f.group === "required") },
        { title: "Puede pedirlas según el producto", fields: category.fields.filter((f) => f.group === "conditional") },
        { title: "Recomendadas", fields: category.fields.filter((f) => f.group === "recommended") },
        { title: "Más características", fields: category.fields.filter((f) => f.group === "other"), collapsible: true },
      ].filter((g) => g.fields.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {published && form.listing && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge>Publicada desde el sistema</Badge>
          <a href={form.listing.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
            {form.listing.mlItemId}
            <ExternalLink className="size-3" />
          </a>
          <span className="text-muted-foreground">· el precio y el stock se mantienen solos desde el producto.</span>
        </div>
      )}

      <Section title="Título y categoría">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ml-title">Título</Label>
          <Input id="ml-title" value={data.title} maxLength={200} disabled={disabled} onChange={(e) => set("title", e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {data.title.trim().length} de {category?.info.maxTitleLength ?? 60} caracteres. Mercado Libre ajusta las mayúsculas.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Categoría</span>
          {category ? (
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium">{category.info.name}</span>
              <span className="text-xs text-muted-foreground">{category.info.path}</span>
              {suggestedCategoryId && category.info.id !== suggestedCategoryId && (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  No es la categoría que sugirió Mercado Libre: la publicación puede quedar observada.
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no elegiste la categoría.</p>
          )}
          {!published && (
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={disabled || !data.title.trim()} onClick={suggest}>
              <Search data-icon="inline-start" />
              {category ? "Cambiar categoría" : "Sugerir categoría"}
            </Button>
          )}
          {suggestions && suggestions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((s, index) => (
                <li key={s.categoryId}>
                  <button
                    type="button"
                    disabled={loadingCategory}
                    onClick={() => chooseCategory(s, index)}
                    className="flex w-full flex-col items-start rounded-md border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="font-medium">
                      {s.categoryName}
                      {index === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">sugerida</span>}
                    </span>
                    {s.domainName && <span className="text-xs text-muted-foreground">{s.domainName}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {category && (
        <Section title="Características" description="Las marcadas con * son obligatorias para esta categoría.">
          {groups.map((group) => {
            const grid = (
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <AttributeField key={field.id} field={field} value={attributeValue(field.id)} onChange={setAttribute} disabled={disabled} />
                ))}
              </div>
            );
            return group.collapsible ? (
              <details key={group.title} className="flex flex-col gap-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {group.title} ({group.fields.length})
                </summary>
                <div className="pt-3">{grid}</div>
              </details>
            ) : (
              <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
                {grid}
              </div>
            );
          })}
        </Section>
      )}

      <Section title="Identificación">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ml-sku">SKU</Label>
            {form.product.sku ? (
              <p className="text-sm">{form.product.sku}</p>
            ) : (
              <>
                <Input id="ml-sku" value={sku} maxLength={60} disabled={disabled} onChange={(e) => setSku(e.target.value)} />
                <p className="text-xs text-muted-foreground">El producto no tiene SKU: hace falta para publicar. Se guarda en el producto.</p>
              </>
            )}
          </div>
          {category && gtin && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Código universal</span>
              {gtin.kind === "send" && <p className="text-sm">Se manda el código de barras de origen: {gtin.value}.</p>}
              {gtin.kind === "none" && <p className="text-sm text-muted-foreground">Esta categoría no lo pide.</p>}
              {gtin.kind === "blocked" && <p className="text-sm text-destructive">{gtin.message}</p>}
              {gtin.kind === "empty" && (
                <>
                  <select
                    aria-label="Motivo por el que no tiene código universal"
                    className={SELECT_CLASS}
                    disabled={disabled}
                    value={data.emptyGtinReason ?? ""}
                    onChange={(e) => set("emptyGtinReason", e.target.value || null)}
                  >
                    <option value="">Elegí el motivo</option>
                    {category.emptyGtinReasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">El código de barras de este producto lo generó el sistema: no se manda.</p>
                </>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="Fotos y descripción" description={`Mínimo una foto; máximo ${category?.info.maxPictures ?? 12}. JPG, PNG o WEBP de hasta 5 MB.`}>
        <div className="flex flex-wrap gap-3">
          {form.product.photoUrl && (
            <label className="flex w-28 flex-col gap-1 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto del almacenamiento propio */}
              <img src={form.product.photoUrl} alt="Foto del catálogo" className={`size-28 rounded-md border object-cover ${data.useProductPhoto ? "" : "opacity-40"}`} />
              <span className="flex items-center gap-1">
                <input type="checkbox" checked={data.useProductPhoto} disabled={disabled} onChange={(e) => set("useProductPhoto", e.target.checked)} />
                Foto del catálogo
              </span>
            </label>
          )}
          {data.extraPhotoUrls.map((url) => (
            <div key={url} className="relative size-28">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto del almacenamiento propio */}
              <img src={url} alt="Foto de la publicación" className="size-28 rounded-md border object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1 right-1"
                disabled={disabled}
                aria-label="Quitar la foto"
                onClick={() => set("extraPhotoUrls", data.extraPhotoUrls.filter((u) => u !== url))}
              >
                <X />
              </Button>
            </div>
          ))}
          <label className={`flex size-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted ${disabled || uploading ? "pointer-events-none opacity-50" : ""}`}>
            <ImagePlus className="size-5" />
            {uploading ? "Subiendo..." : "Agregar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{photos.length} {photos.length === 1 ? "foto" : "fotos"} en la publicación.</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ml-description">Descripción</Label>
          <textarea
            id="ml-description"
            rows={6}
            maxLength={50_000}
            disabled={disabled}
            value={data.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">Texto sin formato.</p>
        </div>
      </Section>

      <Section title="Venta y envío">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ml-listing-type">Tipo de publicación</Label>
            <select id="ml-listing-type" className={SELECT_CLASS} disabled={disabled} value={data.listingType} onChange={(e) => set("listingType", e.target.value === "gold_pro" ? "gold_pro" : "gold_special")}>
              <option value="gold_special">Clásica: cuotas con interés a cargo del comprador</option>
              <option value="gold_pro">Premium: cuotas sin interés (Mercado Libre cobra más)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ml-warranty">Garantía</Label>
            <div className="flex gap-2">
              <select
                id="ml-warranty"
                className={SELECT_CLASS}
                disabled={disabled}
                value={data.warrantyType ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "SELLER" || e.target.value === "FACTORY" ? e.target.value : null;
                  setData((d) => ({ ...d, warrantyType: value, warrantyDays: value ? (d.warrantyDays ?? 30) : null }));
                }}
              >
                <option value="SELLER">Del vendedor</option>
                <option value="FACTORY">De fábrica</option>
                <option value="">Sin garantía</option>
              </select>
              {data.warrantyType && (
                <div className="flex items-center gap-1.5">
                  <Input
                    aria-label="Días de garantía"
                    inputMode="numeric"
                    className="w-20"
                    disabled={disabled}
                    value={data.warrantyDays ?? ""}
                    onChange={(e) => set("warrantyDays", toInt(e.target.value))}
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span>Mercado Envíos, despachando en un correo o una sucursal de Mercado Libre.</span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={data.localPickUp} disabled={disabled} onChange={(e) => set("localPickUp", e.target.checked)} />
            Además, retiro en el local
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Paquete embalado</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["packageHeightCm", "Alto (cm)"],
                ["packageWidthCm", "Ancho (cm)"],
                ["packageLengthCm", "Largo (cm)"],
                ["packageWeightG", "Peso (g)"],
              ] as const
            ).map(([key, text]) => (
              <div key={key} className="flex flex-col gap-1">
                <Label htmlFor={`ml-${key}`} className="text-xs font-normal text-muted-foreground">
                  {text}
                </Label>
                <Input id={`ml-${key}`} inputMode="numeric" disabled={disabled} value={data[key] ?? ""} onChange={(e) => set(key, toInt(e.target.value))} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Las del paquete como se despacha, no las del producto suelto.</p>
        </div>
      </Section>

      <Section title="Precio y lo que cobra Mercado Libre" description="Estimación con el precio de venta. El importe real se conoce al vender.">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ml-price">Precio de venta</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              id="ml-price"
              inputMode="decimal"
              className="w-40"
              disabled={disabled || !canChangePrice}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {priceChanged && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setPrice(form.product.salePrice)}>
                Volver a {money(form.product.salePrice)}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {canChangePrice
              ? "Es el precio del producto: al guardar cambia también en el sistema y queda en su historial."
              : "Es el precio del producto. No tenés permiso para cambiarlo."}
            {priceChanged && " Todavía no se guardó."}
          </p>
        </div>
        {!data.categoryId ? (
          <p className="text-sm text-muted-foreground">Elegí la categoría para ver la estimación.</p>
        ) : !priceValue ? (
          <p className="text-sm text-destructive">Cargá un precio de venta válido: un número mayor que cero, con hasta dos decimales.</p>
        ) : !estimate ? (
          <p className="text-sm text-muted-foreground">Calculando...</p>
        ) : "error" in estimate ? (
          <p className="text-sm text-destructive">{estimate.error}</p>
        ) : (
          <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Precio de venta</dt>
            <dd className="text-right tabular-nums">{money(estimate.price)}</dd>
            <dt className="text-muted-foreground">
              Comisión ({estimate.percentage} %{Number(estimate.fixedFee) > 0 ? ` + ${money(estimate.fixedFee)} fijo` : ""})
            </dt>
            <dd className="text-right tabular-nums">−{money(estimate.fee)}</dd>
            <dt className="text-muted-foreground">Envío gratis a tu cargo</dt>
            <dd className="text-right tabular-nums">−{money(estimate.shippingCost)}</dd>
            <dt className="font-medium">Te queda</dt>
            <dd className="text-right font-medium tabular-nums">{money(estimate.net)}</dd>
            {estimate.margin && (
              <>
                <dt className="text-muted-foreground">Menos el costo ({money(estimate.margin.purchasePrice)})</dt>
                <dd className={`text-right tabular-nums ${Number(estimate.margin.amount) < 0 ? "text-destructive" : ""}`}>{money(estimate.margin.amount)}</dd>
              </>
            )}
          </dl>
        )}
      </Section>

      <FeedbackPanel feedback={feedback} pendingMissing={missing} />

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {published ? (
            <Button type="button" disabled={disabled} onClick={update}>
              {pending ? "Enviando..." : "Guardar y enviar a Mercado Libre"}
            </Button>
          ) : (
            <>
              {canPublish && (
                <Button type="button" disabled={disabled || missing.length > 0 || !form.product.active} onClick={publish}>
                  {pending ? "Publicando..." : "Publicar"}
                </Button>
              )}
              <Button type="button" variant="outline" disabled={disabled || missing.length > 0} onClick={reviewNow}>
                Revisar con Mercado Libre
              </Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={save}>
                Guardar
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Lo que falta (calculado en el momento), y lo que respondió Mercado Libre la última vez. */
function FeedbackPanel({ feedback, pendingMissing }: { feedback: Feedback; pendingMissing: MissingItem[] }) {
  const missing = pendingMissing.length > 0 ? pendingMissing : feedback.missing;
  if (missing.length === 0 && feedback.errors.length === 0 && feedback.warnings.length === 0 && !feedback.success) return null;
  return (
    <div className="flex flex-col gap-2">
      {feedback.success && (
        <p className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {feedback.success}
        </p>
      )}
      {(missing.length > 0 || feedback.errors.length > 0) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{missing.length > 0 ? "Para publicar falta:" : "Mercado Libre no la acepta así:"}</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={`${m.field}-${m.message}`}>{m.message}</li>
            ))}
            {feedback.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <ul className="list-disc pl-4">
            {feedback.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
