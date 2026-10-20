import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const href = (dateKey: string) => `/caja/dia?fecha=${dateKey}`;

/**
 * Navegación entre días de la caja del día (specs/014, RF-1): día anterior,
 * día siguiente, volver a hoy y un selector de fecha. Todo por URL, sin estado
 * en el cliente. No deja pasar de hoy.
 */
export function DayPicker({
  dateKey,
  todayKey,
  previousKey,
  nextKey,
}: {
  dateKey: string;
  todayKey: string;
  previousKey: string;
  nextKey: string;
}) {
  const isToday = dateKey === todayKey;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Link
        href={href(previousKey)}
        aria-label="Día anterior"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <ChevronLeft />
      </Link>

      <form action="/caja/dia" className="flex items-center gap-2">
        <Input type="date" name="fecha" defaultValue={dateKey} max={todayKey} required aria-label="Fecha" className="w-40" />
        <Button type="submit" variant="outline">
          Ver
        </Button>
      </form>

      {isToday ? (
        <span
          aria-disabled
          aria-label="Día siguiente"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "pointer-events-none opacity-50")}
        >
          <ChevronRight />
        </span>
      ) : (
        <Link
          href={href(nextKey)}
          aria-label="Día siguiente"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
        >
          <ChevronRight />
        </Link>
      )}

      {!isToday && (
        <Link href="/caja/dia" className={cn(buttonVariants({ variant: "ghost" }))}>
          <CalendarDays data-icon="inline-start" />
          Hoy
        </Link>
      )}
    </div>
  );
}
