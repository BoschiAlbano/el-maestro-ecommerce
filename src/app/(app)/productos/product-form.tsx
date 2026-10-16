"use client";

import { useActionState } from "react";
import { createProduct, updateProduct, type ActionState } from "./actions";
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

type RubroOption = { id: string; label: string };

type ProductFormProps = {
  brands: { id: string; name: string }[];
  rubros: RubroOption[];
  canChangePrice: boolean;
  product?: {
    id: string;
    name: string;
    brandId: string | null;
    rubroId: string;
    barcode: string;
    photoUrl: string | null;
    purchasePrice: string;
    salePrice: string;
    minStock: number;
  };
};

const initialState: ActionState = {};

export function ProductForm({ brands, rubros, canChangePrice, product }: ProductFormProps) {
  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isEdit = Boolean(product);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="brandId">Marca (opcional)</Label>
        <Select
          name="brandId"
          defaultValue={product?.brandId ?? "__none__"}
          items={{ __none__: "Sin marca", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
        >
          <SelectTrigger id="brandId" className="w-full">
            <SelectValue placeholder="Sin marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin marca</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rubroId">Rubro</Label>
        <Select
          name="rubroId"
          defaultValue={product?.rubroId}
          required
          items={Object.fromEntries(rubros.map((r) => [r.id, r.label]))}
        >
          <SelectTrigger id="rubroId" className="w-full">
            <SelectValue placeholder="Elegí un rubro" />
          </SelectTrigger>
          <SelectContent>
            {rubros.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="barcode">Código de barras {isEdit ? "" : "(vacío = se genera uno)"}</Label>
        <Input id="barcode" name="barcode" defaultValue={product?.barcode} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="photo">Foto (opcional)</Label>
        {product?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photoUrl}
            alt={product.name}
            className="h-24 w-24 rounded-md border object-cover"
          />
        )}
        <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="purchasePrice">Precio de compra</Label>
        <Input
          id="purchasePrice"
          name="purchasePrice"
          type="number"
          step="0.01"
          min={0}
          defaultValue={product?.purchasePrice}
          disabled={!canChangePrice}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="salePrice">Precio de venta</Label>
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min={0}
          defaultValue={product?.salePrice}
          disabled={!canChangePrice}
          required
        />
      </div>
      {!canChangePrice && (
        <p className="text-sm text-muted-foreground">No tenés permiso para cambiar precios.</p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="minStock">Stock mínimo {isEdit ? "" : "(vacío = el de la configuración)"}</Label>
        <Input
          id="minStock"
          name="minStock"
          type="number"
          min={0}
          defaultValue={product?.minStock}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.warning && <p className="text-sm text-muted-foreground">{state.warning}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}
