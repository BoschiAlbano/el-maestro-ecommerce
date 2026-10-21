"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, History, MoreHorizontal, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ICONS = { print: Printer, history: History, calendar: CalendarDays };

/**
 * Una acción secundaria: un link (`href`), imprimir la pantalla (`print`) o copiar un
 * texto al portapapeles (`copyText`). Son datos simples porque llegan desde el servidor.
 */
export type PageAction = { label: string; icon?: keyof typeof ICONS } & (
  | { href: string }
  | { print: true }
  | { copyText: string }
);

/** Copia el texto; si el navegador nunca resuelve el permiso del portapapeles, no queda colgado. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return true;
  } catch {
    toast.error("No se pudo copiar. Copiá el texto a mano desde la lista.");
    return false;
  }
}

/**
 * Botones del encabezado de una pantalla. La acción principal (opcional) queda siempre a
 * la vista; las secundarias van en fila en pantallas grandes y dentro de un menú en celular.
 */
export function PageActions({
  primary,
  secondary,
  menuLabel = "Más",
}: {
  primary?: ReactNode;
  secondary: PageAction[];
  /** Texto del botón que abre el menú en celular. */
  menuLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function run(action: PageAction) {
    if ("print" in action) {
      window.print();
    } else if ("copyText" in action && (await copyToClipboard(action.copyText))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const labelOf = (action: PageAction) => ("copyText" in action && copied ? "¡Copiado!" : action.label);

  return (
    <div className="flex items-center gap-2 print:hidden">
      {secondary.length > 0 && (
        <>
          <div className="hidden gap-2 sm:flex">
            {secondary.map((action) => {
              const Icon = action.icon ? ICONS[action.icon] : null;
              const content = (
                <>
                  {Icon && <Icon data-icon="inline-start" />}
                  {labelOf(action)}
                </>
              );
              return "href" in action ? (
                <Link key={action.label} href={action.href} className={cn(buttonVariants({ variant: "outline" }))}>
                  {content}
                </Link>
              ) : (
                <Button key={action.label} type="button" variant="outline" onClick={() => run(action)}>
                  {content}
                </Button>
              );
            })}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" className="sm:hidden" />}>
              <MoreHorizontal data-icon="inline-start" />
              {menuLabel}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {secondary.map((action) =>
                "href" in action ? (
                  <DropdownMenuItem key={action.label} render={<Link href={action.href} />}>
                    {action.label}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={action.label} onClick={() => run(action)}>
                    {labelOf(action)}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      {primary}
    </div>
  );
}
