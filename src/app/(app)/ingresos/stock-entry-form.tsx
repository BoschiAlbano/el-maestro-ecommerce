"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createStockEntry } from "./actions";
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

type Product = { id: string; name: string };

type Row = { key: number; productId: string; quantity: string; purchasePrice: string };

// Sentinela fijo para "sin elegir": el `Select` tiene que ser controlado
// desde el primer render (un `value` que empieza en `undefined` y después
// pasa a ser un string hace que Base UI se queje de pasar de no controlado
// a controlado — encontrado probando esta pantalla a mano).
const UNSELECTED = "__unselected__";

let nextKey = 0;
function emptyRow(): Row {
  return { key: nextKey++, productId: UNSELECTED, quantity: "", purchasePrice: "" };
}

export function StockEntryForm({ products }: { products: Product[] }) {
  const [supplierName, setSupplierName] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pending, startTransition] = useTransition();

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function submit() {
    const items = rows
      .filter((row) => row.productId !== UNSELECTED)
      .map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
        purchasePrice: Number(row.purchasePrice),
      }));

    if (items.length === 0) {
      toast.error("Agregá al menos un ítem con un producto elegido.");
      return;
    }

    startTransition(async () => {
      const result = await createStockEntry(items, supplierName || undefined);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 max-w-sm">
        <Label htmlFor="supplierName">Proveedor (opcional)</Label>
        <Input
          id="supplierName"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Precio de compra</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Select
                  value={row.productId}
                  onValueChange={(value) => updateRow(row.key, { productId: value ?? UNSELECTED })}
                  items={{
                    [UNSELECTED]: "Elegir producto",
                    ...Object.fromEntries(products.map((p) => [p.id, p.name])),
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Elegir producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSELECTED}>Elegir producto</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28"
                  value={row.purchasePrice}
                  onChange={(e) => updateRow(row.key, { purchasePrice: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.key)}
                >
                  Quitar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
      >
        + Agregar ítem
      </Button>

      <Button type="button" disabled={pending} onClick={submit} className="w-fit">
        {pending ? "Guardando..." : "Confirmar ingreso"}
      </Button>
    </div>
  );
}
