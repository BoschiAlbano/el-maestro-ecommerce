"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { searchProducts, addOrderItem, type SearchedProduct } from "../actions";
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

export function AddItemForm({ orderId }: { orderId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedProduct[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  function handleSearch() {
    startSearch(async () => {
      setResults(await searchProducts(query));
    });
  }

  function handleAdd(productId: string) {
    startAdd(async () => {
      const result = await addOrderItem(orderId, productId, 1);
      if (result.error) toast.error(result.error);
      else {
        setResults([]);
        setQuery("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="addItemQuery">Agregar producto</Label>
          <Input
            id="addItemQuery"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="w-56"
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
              <TableHead>Precio</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>${product.salePrice.toFixed(0)}</TableCell>
                <TableCell>
                  <Button type="button" size="sm" disabled={adding} onClick={() => handleAdd(product.id)}>
                    Agregar (1)
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
