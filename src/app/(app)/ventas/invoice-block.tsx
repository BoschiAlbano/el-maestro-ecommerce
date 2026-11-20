"use client";

import { useRef } from "react";
import { FileText } from "lucide-react";
import { warmUpInvoicing } from "./facturacion-actions";
import { IVA_CONDITIONS } from "@/lib/facturacion/iva-conditions";
import { withDocType, type InvoiceForm } from "@/lib/facturacion/invoice-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * El bloque "Factura" de la pantalla de cobro (specs/023, RF-6 a RF-9). Viene
 * apagado: la cajera decide en cada venta. Sin datos del comprador es a
 * Consumidor Final; desde el monto configurado hay que identificarlo.
 */
export function InvoiceBlock({
  form,
  onChange,
  error,
  mustIdentify,
  showToggle = true,
}: {
  form: InvoiceForm;
  onChange: (form: InvoiceForm) => void;
  /** Por qué todavía no se puede confirmar con esta factura, o `null`. */
  error: string | null;
  /** El total obliga a identificar al comprador. */
  mustIdentify: boolean;
  /** `false`: la factura ya se decidió (por ejemplo, al facturar una venta ya hecha) y no hay casilla. */
  showToggle?: boolean;
}) {
  const warmedUp = useRef(false);

  function toggle(enabled: boolean) {
    onChange({ ...form, enabled, identify: enabled && mustIdentify ? true : form.identify });
    // El primer llamado a ARCA tarda en frío: se adelanta ahora para que al confirmar ya esté listo.
    if (enabled && !warmedUp.current) {
      warmedUp.current = true;
      void warmUpInvoicing().catch(() => undefined);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      {showToggle && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => toggle(event.target.checked)}
            className="size-4"
          />
          <FileText className="size-4" aria-hidden />
          Emitir factura
        </label>
      )}

      {form.enabled && (
        <>
          <div className="flex gap-1" role="group" aria-label="Comprador de la factura">
            <Button
              type="button"
              size="sm"
              variant={!form.identify ? "default" : "outline"}
              aria-pressed={!form.identify}
              disabled={mustIdentify}
              onClick={() => onChange({ ...form, identify: false })}
            >
              Consumidor Final
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.identify ? "default" : "outline"}
              aria-pressed={form.identify}
              onClick={() => onChange({ ...form, identify: true })}
            >
              Identificar al comprador
            </Button>
          </div>

          {form.identify && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-doc-type">Documento</Label>
                <select
                  id="invoice-doc-type"
                  className={SELECT_CLASS}
                  value={form.docType}
                  onChange={(event) => onChange(withDocType(form, event.target.value as "DNI" | "CUIT"))}
                >
                  <option value="DNI">DNI</option>
                  <option value="CUIT">CUIT / CUIL</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-doc-number">Número</Label>
                <Input
                  id="invoice-doc-number"
                  inputMode="numeric"
                  value={form.docNumber}
                  onChange={(event) => onChange({ ...form, docNumber: event.target.value })}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="invoice-name">Nombre o razón social</Label>
                <Input
                  id="invoice-name"
                  value={form.name}
                  maxLength={120}
                  onChange={(event) => onChange({ ...form, name: event.target.value })}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="invoice-iva">Condición frente al IVA</Label>
                <select
                  id="invoice-iva"
                  className={SELECT_CLASS}
                  value={form.ivaCondition}
                  onChange={(event) => onChange({ ...form, ivaCondition: Number(event.target.value) })}
                >
                  {IVA_CONDITIONS.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mustIdentify && !form.identify && (
            <p className="text-xs text-muted-foreground">Por el monto, hay que identificar al comprador.</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
