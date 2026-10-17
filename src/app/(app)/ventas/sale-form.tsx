"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { searchProducts, confirmSale, type SearchedProduct } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CartLine = { productId: string; name: string; salePrice: number; quantity: number };
type PaymentLine = {
  key: number;
  method: "EFECTIVO" | "TRANSFERENCIA";
  amount: string;
  transferReference: string;
};

let nextPaymentKey = 0;
function emptyPayment(): PaymentLine {
  return { key: nextPaymentKey++, method: "EFECTIVO", amount: "", transferReference: "" };
}

export function SaleForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([emptyPayment()]);
  const [searching, startSearch] = useTransition();
  const [confirming, startConfirm] = useTransition();

  const total = cart.reduce((sum, line) => sum + line.quantity * line.salePrice, 0);
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  function handleSearch() {
    startSearch(async () => {
      const found = await searchProducts(query);
      setResults(found);
    });
  }

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
    setQuery("");
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function updatePayment(key: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function handleConfirm() {
    if (cart.length === 0) {
      toast.error("El carrito está vacío.");
      return;
    }
    if (Math.round(paid) !== Math.round(total)) {
      toast.error("Los pagos no suman el total de la venta.");
      return;
    }

    const cartItems = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    const paymentItems = payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        transferReference: p.method === "TRANSFERENCIA" ? p.transferReference : undefined,
      }));

    startConfirm(async () => {
      const result = await confirmSale(cartItems, paymentItems);
      if (result?.error) toast.error(result.error);
      // Al confirmar sin error, la Server Action ya redirige al ticket.
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="query">Buscar por nombre o código</Label>
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
            autoFocus
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
        <h2 className="mb-2 text-sm font-semibold">Carrito</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Subtotal</TableHead>
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
                <TableCell>${line.salePrice.toFixed(0)}</TableCell>
                <TableCell>${(line.quantity * line.salePrice).toFixed(0)}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFromCart(line.productId)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {cart.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Todavía no agregaste productos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="mt-2 text-sm font-semibold">Total: ${total.toFixed(0)}</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Pagos</h2>
        <div className="flex flex-col gap-3">
          {payments.map((payment) => (
            <div key={payment.key} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <Label>Medio</Label>
                <Select
                  value={payment.method}
                  onValueChange={(v) => updatePayment(payment.key, { method: v as "EFECTIVO" | "TRANSFERENCIA" })}
                  items={{ EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => updatePayment(payment.key, { amount: e.target.value })}
                  className="w-28"
                />
              </div>
              {payment.method === "TRANSFERENCIA" && (
                <div className="flex flex-col gap-2">
                  <Label>Últimos 4 dígitos</Label>
                  <Input
                    maxLength={4}
                    value={payment.transferReference}
                    onChange={(e) => updatePayment(payment.key, { transferReference: e.target.value })}
                    className="w-24"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={payments.length === 1}
                onClick={() => setPayments((prev) => prev.filter((p) => p.key !== payment.key))}
              >
                Quitar
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => setPayments((prev) => [...prev, emptyPayment()])}
          >
            + Agregar forma de pago
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Pagado: ${paid.toFixed(0)} de ${total.toFixed(0)}
        </p>
      </div>

      <Button type="button" disabled={confirming} onClick={handleConfirm} className="w-fit">
        {confirming ? "Confirmando..." : "Confirmar venta"}
      </Button>
    </div>
  );
}
