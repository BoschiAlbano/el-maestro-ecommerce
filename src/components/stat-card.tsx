import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Tarjeta de un indicador: nombre, valor grande y una línea de contexto. */
export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  /** "negative" pinta el valor en rojo (salidas); "emphasis" lo destaca (el dato principal). */
  tone?: "negative" | "emphasis";
}) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border bg-card p-3 ${tone === "emphasis" ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : ""}`}>{value}</p>
      <p className="truncate text-xs text-muted-foreground" title={hint}>
        {hint}
      </p>
    </div>
  );
}

/** Panel con título (y descripción opcional) para un gráfico, una tabla o una lista. */
export function Panel({
  title,
  description,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
