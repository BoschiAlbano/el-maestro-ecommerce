"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

/**
 * Selector de fecha de la caja del día (specs/014, RF-1). Al elegir una fecha
 * navega por URL, sin estado propio. No deja pasar de hoy.
 */
export function DayPicker({ dateKey, todayKey }: { dateKey: string; todayKey: string }) {
  const router = useRouter();

  return (
    <Input
      type="date"
      defaultValue={dateKey}
      max={todayKey}
      aria-label="Fecha"
      className="w-40"
      onChange={(event) => {
        const value = event.target.value;
        if (value && value <= todayKey) router.push(`/caja/dia?fecha=${value}`);
      }}
    />
  );
}
