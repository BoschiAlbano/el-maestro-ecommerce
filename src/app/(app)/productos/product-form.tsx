"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createProduct, updateProduct, type ActionState } from "./actions";
import { quickCreateBrand } from "../marcas/actions";
import { quickCreateRubro } from "../rubros/actions";
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

const NEW_BRAND = "__new_brand__";
const NEW_RUBRO = "__new_rubro__";
// Sentinela fijo para "sin elegir": el `Select` tiene que ser controlado
// desde el primer render, nunca pasar de `undefined` a un string (Base UI
// se queja — mismo bug encontrado y corregido en specs/006).
const UNSELECTED_RUBRO = "__unselected_rubro__";

type RubroOption = { id: string; label: string };

type ProductFormProps = {
  brands: { id: string; name: string }[];
  rubros: RubroOption[];
  canChangePrice: boolean;
  /** Solo importa en el alta: el campo de stock inicial no se muestra al editar. */
  canAdjustStock?: boolean;
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

export function ProductForm({
  brands,
  rubros,
  canChangePrice,
  canAdjustStock = false,
  product,
}: ProductFormProps) {
  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isEdit = Boolean(product);

  const [brandList, setBrandList] = useState(brands);
  const [rubroList, setRubroList] = useState(rubros);
  const [brandId, setBrandId] = useState(product?.brandId ?? "__none__");
  const [rubroId, setRubroId] = useState(product?.rubroId ?? UNSELECTED_RUBRO);
  const [newBrandName, setNewBrandName] = useState("");
  const [newRubroName, setNewRubroName] = useState("");
  const [creatingBrand, startCreatingBrand] = useTransition();
  const [creatingRubro, startCreatingRubro] = useTransition();

  function handleCreateBrand() {
    startCreatingBrand(async () => {
      const result = await quickCreateBrand(newBrandName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.brand) {
        setBrandList((prev) => [...prev, result.brand!].sort((a, b) => a.name.localeCompare(b.name)));
        setBrandId(result.brand.id);
        setNewBrandName("");
      }
    });
  }

  function handleCreateRubro() {
    startCreatingRubro(async () => {
      const result = await quickCreateRubro(newRubroName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.rubro) {
        setRubroList((prev) =>
          [...prev, { id: result.rubro!.id, label: result.rubro!.name }].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        );
        setRubroId(result.rubro.id);
        setNewRubroName("");
      }
    });
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="brandId">Marca (opcional)</Label>
        {brandId === NEW_BRAND ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nombre de la marca"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              disabled={creatingBrand || !newBrandName.trim()}
              onClick={handleCreateBrand}
            >
              Crear
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBrandId("__none__")}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Select
            name="brandId"
            value={brandId}
            onValueChange={(value) => setBrandId(value ?? "__none__")}
            items={{
              __none__: "Sin marca",
              ...Object.fromEntries(brandList.map((b) => [b.id, b.name])),
              [NEW_BRAND]: "+ Crear nueva marca",
            }}
          >
            <SelectTrigger id="brandId" className="w-full">
              <SelectValue placeholder="Sin marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin marca</SelectItem>
              {brandList.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_BRAND}>+ Crear nueva marca</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rubroId">Rubro</Label>
        {rubroId === NEW_RUBRO ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nombre del rubro"
              value={newRubroName}
              onChange={(e) => setNewRubroName(e.target.value)}
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              disabled={creatingRubro || !newRubroName.trim()}
              onClick={handleCreateRubro}
            >
              Crear
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRubroId(product?.rubroId ?? UNSELECTED_RUBRO)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Select
            name="rubroId"
            value={rubroId}
            onValueChange={(value) => setRubroId(value ?? UNSELECTED_RUBRO)}
            required
            items={{
              [UNSELECTED_RUBRO]: "Elegí un rubro",
              ...Object.fromEntries(rubroList.map((r) => [r.id, r.label])),
              [NEW_RUBRO]: "+ Crear nuevo rubro",
            }}
          >
            <SelectTrigger id="rubroId" className="w-full">
              <SelectValue placeholder="Elegí un rubro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_RUBRO} disabled>
                Elegí un rubro
              </SelectItem>
              {rubroList.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
              <SelectItem value={NEW_RUBRO}>+ Crear nuevo rubro</SelectItem>
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          El rubro nuevo queda de primer nivel; para un subrubro, usá{" "}
          <Link href="/rubros" className="underline">
            la pantalla de rubros
          </Link>
          .
        </p>
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

      {!isEdit && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="initialStock">Stock inicial (opcional)</Label>
          <Input
            id="initialStock"
            name="initialStock"
            type="number"
            min={0}
            step={1}
            disabled={!canAdjustStock}
          />
          {canAdjustStock ? (
            <p className="text-xs text-muted-foreground">
              Atajo para no tener que hacer un conteo físico aparte; si lo dejás vacío, el producto
              arranca en cero.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No tenés permiso para cargar stock.</p>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.warning && <p className="text-sm text-muted-foreground">{state.warning}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}
