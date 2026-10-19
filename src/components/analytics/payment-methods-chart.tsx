"use client";

import { Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type PaymentTotal = { method: string; total: number; count: number };

const chartConfig = {
  EFECTIVO: { label: "Efectivo", color: "var(--primary)" },
  TRANSFERENCIA: { label: "Transferencia", color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/** Lo cobrado por medio de pago: dona con el total al centro y el detalle al pasar el cursor. */
export function PaymentMethodsChart({ data }: { data: PaymentTotal[] }) {
  const total = data.reduce((sum, d) => sum + d.total, 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay cobros en el rango filtrado.</p>;
  }

  const slices = data.map((d) => ({ ...d, fill: `var(--color-${d.method})` }));

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-72 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="method"
              formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {chartConfig[item.payload.method as keyof typeof chartConfig]?.label ?? item.payload.method}
                  </span>
                  <span>
                    {formatMoney(Number(value))} · {item.payload.count}{" "}
                    {item.payload.count === 1 ? "cobro" : "cobros"}
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie data={slices} dataKey="total" nameKey="method" innerRadius={62} strokeWidth={4}>
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || viewBox.cx === undefined || viewBox.cy === undefined) return null;
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-lg font-semibold">
                    {formatMoney(total)}
                  </tspan>
                  <tspan x={viewBox.cx} y={viewBox.cy + 20} className="fill-muted-foreground text-xs">
                    cobrado
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="method" />} />
      </PieChart>
    </ChartContainer>
  );
}
