"use client";

import { Button } from "@/components/ui/button";
import { BarcodeSvg } from "./barcode-svg";

type Product = { id: string; name: string; barcode: string; salePrice: string };

export function LabelSheet({ products }: { products: Product[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={() => window.print()} className="w-fit print:hidden">
        Imprimir
      </Button>

      <div className="grid grid-cols-3 gap-4 print:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex flex-col items-center gap-1 rounded-md border p-3 text-center"
          >
            <span className="text-sm font-medium">{product.name}</span>
            <BarcodeSvg value={product.barcode} />
            <span className="text-base font-semibold">${Number(product.salePrice).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
