"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = { id: string; name: string; barcode: string };

export function LabelSelector({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        disabled={selected.size === 0}
        className="w-fit"
        onClick={() => {
          router.push(`/productos/etiquetas/imprimir?ids=${Array.from(selected).join(",")}`);
        }}
      >
        Imprimir etiquetas seleccionadas ({selected.size})
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Nombre</TableHead>
            <TableHead>Código</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <Checkbox
                  checked={selected.has(product.id)}
                  onCheckedChange={() => toggle(product.id)}
                />
              </TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
