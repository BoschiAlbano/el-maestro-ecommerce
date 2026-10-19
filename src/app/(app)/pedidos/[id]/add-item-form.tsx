"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { searchProducts, addOrderItem, type SearchedProduct } from "../actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 250;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Buscador para agregar un producto al pedido (specs/009, RF-2 y RF-10): el mismo
 * de la pantalla de venta — resultados flotantes, stock informativo y alta
 * automática con un código de barras exacto.
 */
export function AddItemForm({ orderId }: { orderId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedProduct[]>([]);
  const [searched, setSearched] = useState(false);
  const [, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function closeResults() {
    latest.current++;
    setResults([]);
    setSearched(false);
  }

  function runSearch(text: string, autoAdd: boolean) {
    const trimmed = text.trim();
    if (!trimmed) {
      closeResults();
      return;
    }
    const requestId = ++latest.current;
    startSearch(async () => {
      const found = await searchProducts(trimmed);
      if (requestId !== latest.current) return; // llegó una búsqueda más nueva
      // Un código de barras exacto con un único producto se agrega solo.
      if (autoAdd && found.length === 1 && found[0].barcode === trimmed) {
        handleAdd(found[0]);
        return;
      }
      setResults(found);
      setSearched(true);
    });
  }

  function handleChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value, false), SEARCH_DELAY_MS);
  }

  function handleAdd(product: SearchedProduct) {
    startAdd(async () => {
      const result = await addOrderItem(orderId, product.id, 1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${product.name} agregado al pedido.`);
      closeResults();
      setQuery("");
    });
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) closeResults();
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            runSearch(query, true);
          } else if (e.key === "Escape") {
            closeResults();
          }
        }}
        placeholder="Escribí el nombre o escaneá el código…"
        aria-label="Agregar producto al pedido"
        className="h-10 pl-9 text-base"
      />

      {results.length > 0 && (
        <ul
          // Evita que el clic en la lista le saque el foco al buscador (y la cierre antes de agregar).
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 divide-y overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                disabled={adding}
                onClick={() => handleAdd(product)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{product.barcode}</span>
                    {" · "}
                    <span className={cn(product.stock <= 0 && "text-destructive")}>
                      {product.stock <= 0 ? "Sin stock" : `Stock: ${product.stock}`}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(product.salePrice)}</span>
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Plus className="size-4" />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && results.length === 0 && (
        <p className="absolute top-full right-0 left-0 z-30 mt-1 rounded-lg bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg ring-1 ring-foreground/10">
          No se encontraron productos con esa búsqueda.
        </p>
      )}
    </div>
  );
}
