"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { MovementDialog } from "./movement-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Menú "Más" de la caja abierta, solo en celular: reúne registrar ingreso/egreso
 * (que abren su ventana) y los links a Caja del día e Historial. En pantallas
 * grandes esos mismos botones van sueltos en el encabezado.
 */
export function CajaMobileMenu({ canRegister }: { canRegister: boolean }) {
  const [movement, setMovement] = useState<"INGRESO" | "EGRESO" | null>(null);

  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
          <MoreHorizontal data-icon="inline-start" />
          Más
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canRegister && (
            <>
              <DropdownMenuItem onClick={() => setMovement("INGRESO")}>Registrar ingreso</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMovement("EGRESO")}>Registrar egreso</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem render={<Link href="/caja/dia" />}>Caja del día</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/caja/historial" />}>Historial</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canRegister && (
        <>
          <MovementDialog
            type="INGRESO"
            showTrigger={false}
            open={movement === "INGRESO"}
            onOpenChange={(open) => setMovement(open ? "INGRESO" : null)}
          />
          <MovementDialog
            type="EGRESO"
            showTrigger={false}
            open={movement === "EGRESO"}
            onOpenChange={(open) => setMovement(open ? "EGRESO" : null)}
          />
        </>
      )}
    </div>
  );
}
