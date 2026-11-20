"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildLinkPreview, type LinkPreview } from "@/lib/mercadolibre/link-preview";
import type { ListingRead } from "@/lib/mercadolibre/listing-read";
import type { CandidateProduct, LinkCandidate } from "@/lib/mercadolibre/listings-view";
import { linkListings, searchProductsForLink, type LinkResult } from "../actions";

const MATCHED_BY = { sku: "por SKU", barcode: "por código de barras", gtin: "por código universal" } as const;

function money(value: string) {
  return `$${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function ListingCell({ listing }: { listing: ListingRead }) {
  return (
    <div className="flex items-center gap-3">
      {listing.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura de Mercado Libre, sin optimizar
        <img src={listing.thumbnailUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{listing.title}</span>
        <a
          href={listing.permalink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          {listing.mlItemId} · {money(listing.price)} · {listing.quantity} u. · SKU {listing.sku ?? "—"}
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

/** Lo que cambia en la publicación al vincular (RF-8). */
function PreviewList({ preview }: { preview: LinkPreview }) {
  const items: string[] = [];
  if (preview.price.changes) items.push(`Precio: ${money(preview.price.from)} → ${money(preview.price.to)}`);
  if (preview.quantity.changes) items.push(`Cantidad: ${preview.quantity.from} → ${preview.quantity.to}`);
  if (preview.sku.changes) items.push(`SKU: ${preview.sku.from ?? "sin SKU"} → ${preview.sku.to ?? "sin SKU"}`);
  if (preview.productTakesListingSku) items.push(`El producto toma el SKU ${preview.sku.to}`);
  if (preview.quantity.to === 0) items.push("Sin stock en el sistema: queda pausada sin stock");
  if (items.length === 0) return <span className="text-xs text-muted-foreground">No cambia nada en la publicación.</span>;
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function reportResults(results: LinkResult[]) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  if (ok > 0) toast.success(ok === 1 ? "Publicación vinculada." : `Se vincularon ${ok} publicaciones.`);
  for (const f of failed) toast.error(`${f.mlItemId}: ${f.message}`);
}

/** Vincular a mano: buscar el producto y ver qué cambia antes de confirmar (RF-7). */
function ManualLink({ listing, onLink, busy }: { listing: ListingRead; onLink: (productId: string) => void; busy: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(CandidateProduct & { linked: boolean })[] | null>(null);
  const [chosen, setChosen] = useState<CandidateProduct | null>(null);
  const [searching, startSearch] = useTransition();

  function search() {
    startSearch(async () => {
      setChosen(null);
      setResults(await searchProductsForLink(query));
    });
  }

  if (chosen) {
    const preview = buildLinkPreview(chosen, { price: listing.price, quantity: listing.quantity, sku: listing.sku });
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{chosen.name}</span>
        <PreviewList preview={preview} />
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onLink(chosen.id)}>
            Vincular
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setChosen(null)}>
            Elegir otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, código o SKU"
          aria-label={`Buscar producto para ${listing.title}`}
          className="h-8 w-full sm:w-56"
        />
        <Button type="submit" size="sm" variant="outline" disabled={searching || query.trim().length < 2}>
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </form>
      {results !== null && results.length === 0 && (
        <span className="text-xs text-muted-foreground">No hay productos activos con eso.</span>
      )}
      {results && results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((p) => (
            <li key={p.id}>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto w-full justify-start py-1 text-left"
                disabled={p.linked}
                onClick={() => setChosen(p)}
              >
                <span className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.linked ? "Ya tiene una publicación vigente" : `${p.barcode} · SKU ${p.sku ?? "—"} · ${money(p.salePrice)}`}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LinkView({ candidates, notLinkable }: { candidates: LinkCandidate[]; notLinkable: ListingRead[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const proposed = candidates.filter((c) => c.proposal !== null);
  const manual = candidates.filter((c) => c.proposal === null);

  function link(pairs: { mlItemId: string; productId: string }[]) {
    startTransition(async () => {
      reportResults(await linkListings(pairs));
      router.refresh();
    });
  }

  if (candidates.length === 0 && notLinkable.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay publicaciones sin vincular en la cuenta de Mercado Libre.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {proposed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Propuestas ({proposed.length})</h2>
            {proposed.length > 1 && (
              <Button
                disabled={pending}
                onClick={() => link(proposed.map((c) => ({ mlItemId: c.listing.mlItemId, productId: c.proposal!.product.id })))}
              >
                {pending ? "Vinculando..." : `Vincular todas (${proposed.length})`}
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publicación</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Qué cambia en Mercado Libre</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposed.map(({ listing, proposal }) => (
                <TableRow key={listing.mlItemId}>
                  <TableCell>
                    <ListingCell listing={listing} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{proposal!.product.name}</span>
                      <Badge variant="outline">Coincide {MATCHED_BY[proposal!.matchedBy]}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PreviewList preview={proposal!.preview} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => link([{ mlItemId: listing.mlItemId, productId: proposal!.product.id }])}
                    >
                      Vincular
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {manual.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Sin propuesta: elegí el producto a mano ({manual.length})</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publicación</TableHead>
                <TableHead>Producto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manual.map(({ listing, reason }) => (
                <TableRow key={listing.mlItemId}>
                  <TableCell className="align-top">
                    <ListingCell listing={listing} />
                    {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
                  </TableCell>
                  <TableCell className="align-top">
                    <ManualLink
                      listing={listing}
                      busy={pending}
                      onLink={(productId) => link([{ mlItemId: listing.mlItemId, productId }])}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {notLinkable.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">No se pueden vincular ({notLinkable.length})</h2>
          <ul className="flex flex-col gap-3">
            {notLinkable.map((listing) => (
              <li key={listing.mlItemId} className="flex flex-col gap-1">
                <ListingCell listing={listing} />
                <span className="text-xs text-muted-foreground">{listing.notLinkableReason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
