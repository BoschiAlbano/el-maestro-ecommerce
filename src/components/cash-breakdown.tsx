import type { ShiftSummary } from "@/lib/cash-shift";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

type Row = { label: string; efectivo: number; transferencia: number; total: number; tone?: "negative"; strong?: boolean };

/**
 * Entradas, salidas y neto, separados por efectivo y transferencia y con el
 * total al costado (specs/007 y 014): lo primero que se mira de una caja, en
 * una sola tabla chica en vez de repartido en tarjetas y pestañas.
 */
export function CashBreakdown({ summary }: { summary: Pick<ShiftSummary, "ingresos" | "egresos" | "efectivo" | "transferencia"> }) {
  const rows: Row[] = [
    {
      label: "Entradas",
      efectivo: summary.efectivo.ingresos,
      transferencia: summary.transferencia.ingresos,
      total: summary.ingresos,
    },
    {
      label: "Salidas",
      efectivo: summary.efectivo.egresos,
      transferencia: summary.transferencia.egresos,
      total: summary.egresos,
      tone: "negative",
    },
    {
      label: "Neto",
      efectivo: summary.efectivo.neto,
      transferencia: summary.transferencia.neto,
      total: summary.ingresos - summary.egresos,
      strong: true,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium" />
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Efectivo
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Transferencia
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={cn("border-t", row.strong && "bg-muted/50 font-semibold")}>
              <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                {row.label}
              </th>
              {[row.efectivo, row.transferencia, row.total].map((value, i) => (
                <td
                  key={i}
                  className={cn(
                    "py-2.5 text-right tabular-nums",
                    i === 0 ? "px-3" : i === 1 ? "px-3" : "pl-3",
                    i === 2 && "font-semibold",
                    row.tone === "negative" && value > 0 && "text-destructive",
                  )}
                >
                  {row.tone === "negative" && value > 0 ? "−" : ""}
                  {formatMoney(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
