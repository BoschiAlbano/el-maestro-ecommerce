import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { ModuloNegocio, type MlListingStatus } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/mercadolibre/listing-status";
import { publishableQuantity } from "@/lib/mercadolibre/link-preview";
import { countUnlinkedActive, loadPublications, requireMlConnection } from "@/lib/mercadolibre/listings-view";
import { FilterForm } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ListingActions, SyncNowButton } from "./listing-actions";
import { AutoRefresh } from "./auto-refresh";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as MlListingStatus[];

const STATUS_BADGE: Record<MlListingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  PAUSED_NO_STOCK: "outline",
  UNDER_REVIEW: "destructive",
  CLOSED: "secondary",
};

function money(value: string) {
  return `$${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

export default async function PublicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver las publicaciones de Mercado Libre.</p>;
  }

  const { q, estado } = await searchParams;
  const status = STATUS_OPTIONS.includes(estado as MlListingStatus) ? (estado as MlListingStatus) : undefined;

  const can = {
    link: hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear"),
    edit: hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar"),
    void: hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "anular"),
  };

  const connection = await requireMlConnection();
  const [rows, unlinkedActive] = await Promise.all([
    loadPublications({ status, q }),
    connection.ok ? countUnlinkedActive(connection.mlUserId) : Promise.resolve(null),
  ]);
  const pendingCount = rows.filter((r) => r.pricePending || r.pausePending || r.quantityPending).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Publicaciones de Mercado Libre</h1>
        <div className="flex flex-wrap gap-2">
          <AutoRefresh />
          {can.edit && connection.ok && <SyncNowButton pendingCount={pendingCount} />}
          {can.link && connection.ok && (
            <Link href="/publicaciones/vincular" className={cn(buttonVariants())}>
              Vincular publicaciones
            </Link>
          )}
        </div>
      </div>

      {!connection.ok && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {connection.error} Mientras tanto no se puede vincular ni cambiar nada en Mercado Libre.{" "}
            <Link href="/configuracion?tab=mercadolibre" className="underline">
              Ir a Configuración
            </Link>
          </p>
        </div>
      )}

      {unlinkedActive !== null && unlinkedActive > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {unlinkedActive === 1
              ? "Hay 1 publicación activa en Mercado Libre sin vincular: sus ventas no descuentan stock del sistema."
              : `Hay ${unlinkedActive} publicaciones activas en Mercado Libre sin vincular: sus ventas no descuentan stock del sistema.`}{" "}
            {can.link && (
              <Link href="/publicaciones/vincular" className="underline">
                Vincularlas
              </Link>
            )}
          </p>
        </div>
      )}

      <FilterForm
        activeCount={status ? 1 : 0}
        search={
          <div className="flex flex-col gap-2">
            <Label htmlFor="q">Nombre, código o SKU</Label>
            <Input id="q" name="q" defaultValue={q} className="w-full sm:w-56" />
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            name="estado"
            defaultValue={status ?? "__vigentes__"}
            items={{ __vigentes__: "Vigentes", ...STATUS_LABELS }}
          >
            <SelectTrigger id="estado" className="w-full sm:w-56">
              <SelectValue placeholder="Vigentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__vigentes__">Vigentes</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterForm>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Foto</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">En Mercado Libre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {(row.thumbnailUrl ?? row.product.photoUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de Mercado Libre, sin optimizar
                  <img
                    src={row.thumbnailUrl ?? row.product.photoUrl ?? ""}
                    alt=""
                    className="size-10 rounded object-cover"
                  />
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Link href={`/productos/${row.product.id}`} className="font-medium hover:underline">
                    {row.product.name}
                  </Link>
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    {row.mlItemId}
                    <ExternalLink className="size-3" />
                  </a>
                  {!row.product.active && <span className="text-xs text-muted-foreground">Producto desactivado</span>}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{row.product.sku ?? "—"}</span>
                {row.skuConflict && (
                  <p className="text-xs text-destructive">
                    En Mercado Libre figura «{row.skuConflict}», que no se pudo tomar: es de otro producto o no es válido.
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">
                {money(row.product.salePrice)}
                {row.pricePending && <p className="text-xs text-amber-700 dark:text-amber-300">Pendiente de enviar</p>}
              </TableCell>
              <TableCell className="text-right">{row.product.currentStock}</TableCell>
              <TableCell className="text-right">
                {row.status === "CLOSED" ? (
                  "—"
                ) : (
                  <>
                    <span
                      className={
                        row.publishedQuantity !== null &&
                        !row.quantityPending &&
                        row.publishedQuantity !== publishableQuantity(row.product.currentStock)
                          ? "text-destructive"
                          : undefined
                      }
                    >
                      {row.publishedQuantity ?? "—"}
                    </span>
                    {row.quantityPending && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">Pendiente de enviar</p>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                {row.statusReason && row.status !== "ACTIVE" && (
                  <p className="mt-1 max-w-56 text-xs text-muted-foreground">{row.statusReason}</p>
                )}
                {row.pausePending && <p className="text-xs text-amber-700 dark:text-amber-300">Pausa pendiente de enviar</p>}
                {row.lastSyncError && (
                  <p className="max-w-56 text-xs text-destructive">{row.lastSyncError}</p>
                )}
              </TableCell>
              <TableCell className="text-right">
                {row.status !== "CLOSED" && connection.ok && (
                  <ListingActions
                    listingId={row.id}
                    productName={row.product.name}
                    status={row.status}
                    canEdit={can.edit}
                    canVoid={can.void}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                {q || status ? "No hay publicaciones para estos filtros." : "Todavía no hay publicaciones vinculadas."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
