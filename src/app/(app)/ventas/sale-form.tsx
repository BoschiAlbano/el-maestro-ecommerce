"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { searchProducts, confirmSale, type SearchedProduct } from "./actions";
import { PaymentDialog, type SalePayment } from "./payment-dialog";
import { TicketDialog } from "./ticket-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/stat-card";
import { cn } from "@/lib/utils";

type CartLine = { productId: string; name: string; salePrice: number; quantity: number };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

const SEARCH_DELAY_MS = 250;

export function SaleForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedProduct[]>([]);
  const [searched, setSearched] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paying, setPaying] = useState(false);
  const [ticketSaleId, setTicketSaleId] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearch = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const total = cart.reduce((sum, line) => sum + line.quantity * line.salePrice, 0);
  const units = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addToCart(product: SearchedProduct) {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...prev, { productId: product.id, name: product.name, salePrice: product.salePrice, quantity: 1 }];
    });
    setResults([]);
    setSearched(false);
    setQuery("");
  }

  function closeResults() {
    latestSearch.current++;
    setResults([]);
    setSearched(false);
  }

  function runSearch(text: string, autoAdd: boolean) {
    const trimmed = text.trim();
    if (!trimmed) {
      latestSearch.current++;
      setResults([]);
      setSearched(false);
      return;
    }
    const requestId = ++latestSearch.current;
    startSearch(async () => {
      const found = await searchProducts(trimmed);
      if (requestId !== latestSearch.current) return; // llegó una búsqueda más nueva
      // Un código de barras exacto con un único producto se agrega solo (specs/008, RF-12).
      if (autoAdd && found.length === 1 && found[0].barcode === trimmed) {
        addToCart(found[0]);
        return;
      }
      setResults(found);
      setSearched(true);
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(value, false), SEARCH_DELAY_MS);
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line,
      ),
    );
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function handleConfirm(payments: SalePayment[]) {
    const cartItems = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    startConfirm(async () => {
      const result = await confirmSale(cartItems, payments);
      if (result.error || !result.saleId) {
        toast.error(result.error ?? "No se pudo confirmar la venta.");
        return;
      }
      // Venta hecha: se cierra el cobro y se muestra el ticket (specs/008, RF-14).
      setPaying(false);
      setTicketSaleId(result.saleId);
    });
  }

  function handleTicketClose() {
    // "Nueva venta": la pantalla queda vacía para la siguiente.
    setTicketSaleId(null);
    setCart([]);
    setResults([]);
    setSearched(false);
    setQuery("");
  }

  return (
    <>
      <div className="grid gap-4 pb-24 lg:flex-1 lg:grid-cols-[1fr_20rem] lg:pb-0">
        <div className="flex flex-col gap-4">
          {/* El Panel deja de recortar (overflow-visible) para que los resultados floten sobre el carrito en vez de empujarlo. */}
          <Panel
            title="Buscar producto"
            description="Por nombre o código de barras. Con el lector, el producto se agrega solo."
            className="overflow-visible"
          >
            <div
              className="relative"
              onBlur={(e) => {
                // Si el foco sale del buscador y de la lista, se cierra la lista.
                if (!e.currentTarget.contains(e.relatedTarget)) closeResults();
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (searchTimer.current) clearTimeout(searchTimer.current);
                    runSearch(query, true);
                  } else if (e.key === "Escape") {
                    closeResults();
                  }
                }}
                placeholder="Escribí el nombre o escaneá el código…"
                aria-label="Buscar producto por nombre o código"
                className="h-10 pl-9 text-base"
                autoFocus
              />

              {results.length > 0 && (
                <ul
                  // Evita que el clic en la lista le saque el foco al buscador (y la cierre antes de agregar).
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 divide-y overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
                >
                  {results.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
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

              {searched && !searching && results.length === 0 && (
                <p className="absolute top-full right-0 left-0 z-30 mt-1 rounded-lg bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg ring-1 ring-foreground/10">
                  No se encontraron productos con esa búsqueda.
                </p>
              )}
            </div>
          </Panel>

          <Panel title={`Carrito${units > 0 ? ` (${units})` : ""}`} className="flex-1" contentClassName="flex flex-1 flex-col">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
                <ShoppingCart className="size-8" aria-hidden />
                <p className="text-sm">Todavía no agregaste productos.</p>
                <p className="text-xs">Buscá un producto o escaneá su código para empezar.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {cart.map((line) => (
                  <li key={line.productId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{line.name}</span>
                      <span className="text-xs text-muted-foreground">{formatMoney(line.salePrice)} c/u</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label={`Quitar una unidad de ${line.name}`}
                        disabled={line.quantity <= 1}
                        onClick={() => changeQuantity(line.productId, -1)}
                      >
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        aria-label={`Cantidad de ${line.name}`}
                        onChange={(e) => setQuantity(line.productId, Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                        className="h-7 w-14 text-center"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label={`Agregar una unidad de ${line.name}`}
                        onClick={() => changeQuantity(line.productId, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">
                      {formatMoney(line.quantity * line.salePrice)}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Quitar ${line.name} del carrito`}
                      onClick={() => removeFromCart(line.productId)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="hidden lg:block">
          <Panel title="Resumen de la venta" className="sticky top-4">
            <div className="flex flex-col gap-4">
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Productos distintos</dt>
                  <dd className="tabular-nums">{cart.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unidades</dt>
                  <dd className="tabular-nums">{units}</dd>
                </div>
              </dl>
              <div className="rounded-lg bg-muted px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-semibold tabular-nums">{formatMoney(total)}</p>
              </div>
              <Button type="button" size="lg" disabled={cart.length === 0} onClick={() => setPaying(true)}>
                Cobrar
              </Button>
              {cart.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setCart([])}>
                  Vaciar carrito
                </Button>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 lg:hidden">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {units} {units === 1 ? "unidad" : "unidades"}
          </span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(total)}</span>
        </div>
        <Button type="button" size="lg" disabled={cart.length === 0} onClick={() => setPaying(true)}>
          Cobrar
        </Button>
      </div>

      <TicketDialog saleId={ticketSaleId} onClose={handleTicketClose} closeLabel="Nueva venta" />

      <PaymentDialog open={paying} onOpenChange={setPaying} total={total} confirming={confirming} onConfirm={handleConfirm} />
    </>
  );
}
