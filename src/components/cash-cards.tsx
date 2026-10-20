import { Info } from "lucide-react";
import type { ShiftSummary } from "@/lib/cash-shift";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

type Detail = { label: string; value: number; negative?: boolean };

function CashCard({
  label,
  value,
  note,
  details,
  tone,
  help,
}: {
  label: string;
  value: number;
  note?: string;
  details?: Detail[];
  tone?: "emphasis" | "negative";
  /** Explicación breve que se muestra en un tooltip junto al nombre. */
  help?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card p-3",
        tone === "emphasis" && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <p>{label}</p>
        {help && (
          <Tooltip>
            <TooltipTrigger
              aria-label={`Más información sobre ${label}`}
              className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{help}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={cn("text-xl font-semibold tabular-nums", tone === "negative" && value > 0 && "text-destructive")}>
        {formatMoney(value)}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {details && (
        <dl className="mt-1 flex flex-col gap-0.5 border-t pt-1.5">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className={cn("tabular-nums", detail.negative && detail.value > 0 && "text-destructive")}>
                {detail.negative && detail.value > 0 ? "−" : ""}
                {formatMoney(detail.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Las cuatro tarjetas de una caja (specs/007 y 014): son las mismas en el turno
 * en curso, en el detalle de un turno cerrado y en la caja de un día completo;
 * lo único que cambia es sobre qué movimientos se calculan.
 *
 * 1. Efectivo, con sus entradas y salidas. 2. Transferencia, igual.
 * 3. Total (efectivo + transferencia). 4. Ventas: monto, cantidad y cobrado por medio de pago.
 */
export function CashSummaryCards({
  summary,
  sales,
  period,
  cashLabel,
  cashValue,
  cashNote,
}: {
  summary: Pick<ShiftSummary, "ingresos" | "egresos" | "efectivo" | "transferencia">;
  /** Ventas no anuladas del período y lo cobrado por ellas, por medio de pago (neto de devoluciones). */
  sales: {
    count: number;
    total: number;
    voidedCount: number;
    /** Seña de pedidos aplicada en esas ventas. */
    depositApplied: number;
    collected: { efectivo: number; transferencia: number };
  };
  /** "turno" o "día": va en el nombre de la tarjeta del total. */
  period: "turno" | "día";
  cashLabel: string;
  /** El número grande de la primera tarjeta (efectivo esperado en un turno, neto del día en la caja del día). */
  cashValue: number;
  cashNote: string;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CashCard
        tone="emphasis"
        label={cashLabel}
        value={cashValue}
        note={cashNote}
        details={[
          { label: "Entradas", value: summary.efectivo.ingresos },
          { label: "Salidas", value: summary.efectivo.egresos, negative: true },
        ]}
      />
      <CashCard
        label="Transferencia"
        value={summary.transferencia.neto}
        note="No cambia el efectivo"
        details={[
          { label: "Entradas", value: summary.transferencia.ingresos },
          { label: "Salidas", value: summary.transferencia.egresos, negative: true },
        ]}
      />
      <CashCard
        label={`Total del ${period}`}
        value={summary.efectivo.neto + summary.transferencia.neto}
        note="Efectivo + transferencia"
        details={[
          { label: "Entradas", value: summary.ingresos },
          { label: "Salidas", value: summary.egresos, negative: true },
        ]}
      />
      <CashCard
        label="Ventas"
        value={sales.total}
        note={`${sales.count} ${sales.count === 1 ? "venta" : "ventas"}${
          sales.voidedCount > 0 ? ` · ${sales.voidedCount} anulada${sales.voidedCount === 1 ? "" : "s"}` : ""
        }`}
        help="El monto vendido puede ser mayor a lo cobrado: la seña de un pedido se cobró antes y figura como un ingreso aparte."
        details={[
          { label: "Cobrado en efectivo", value: sales.collected.efectivo },
          { label: "Cobrado por transf.", value: sales.collected.transferencia },
          // Solo cuando hubo seña: con esta fila la cuenta cierra a la vista.
          ...(sales.depositApplied > 0 ? [{ label: "Seña aplicada", value: sales.depositApplied }] : []),
        ]}
      />
    </section>
  );
}
