"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type TopProduct = { key: string; label: string; cantidad: number; total: number };

const chartConfig = {
  cantidad: { label: "Unidades vendidas", color: "var(--primary)" },
} satisfies ChartConfig;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Top de productos por unidades vendidas: barras horizontales, el más vendido arriba. */
export function TopProductsChart({
  data,
  emptyMessage = "No hay ventas en el rango filtrado.",
}: {
  data: TopProduct[];
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: 40 * data.length + 24 }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32 }}>
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="label"
          type="category"
          width={150}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => truncate(value, 22)}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{item.payload.label}</span>
                  <span>
                    {Number(value).toLocaleString("es-AR")} unidades · {formatMoney(item.payload.total)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4}>
          <LabelList dataKey="cantidad" position="right" className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
