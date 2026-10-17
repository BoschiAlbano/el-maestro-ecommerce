"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { searchProducts, createOrder, type SearchedProduct } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CartLine = { productId: string; name: string; quantity: number };

export function OrderForm() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();

  function handleSearch() {
    startSearch(async () => {
      setResults(await searchProducts(query));
    });
  }

  function addToCart(product: SearchedProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1 }];
    });
    setResults([]);
    setQuery("");
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function handleCreate() {
    if (!customerName.trim()) {
      toast.error("El nombre del cliente es obligatorio.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Agregá al menos un producto.");
      return;
    }
    startCreate(async () => {
      const result = await createOrder(
        customerName,
        customerPhone || undefined,
        channel || undefined,
        cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      );
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerName">Cliente</Label>
          <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerPhone">Teléfono (opcional)</Label>
          <Input id="customerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="channel">Canal (opcional)</Label>
          <Input
            id="channel"
            placeholder="WhatsApp, Instagram..."
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="query">Buscar producto por nombre o código</Label>
          <Input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="w-64"
          />
        </div>
        <Button type="button" onClick={handleSearch} disabled={searching}>
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {results.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
                <TableCell>${product.salePrice.toFixed(0)}</TableCell>
                <TableCell>
                  <Button type="button" size="sm" onClick={() => addToCart(product)}>
                    Agregar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Productos pedidos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cart.map((line) => (
              <TableRow key={line.productId}>
                <TableCell>{line.name}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateQuantity(line.productId, Number(e.target.value) || 1)}
                    className="w-20"
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFromCart(line.productId)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {cart.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Todavía no agregaste productos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button type="button" disabled={creating} onClick={handleCreate} className="w-fit">
        {creating ? "Creando..." : "Crear pedido"}
      </Button>
    </div>
  );
}
