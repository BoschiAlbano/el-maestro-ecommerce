import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo de El Maestro (public/logo.svg, recortado, negro y sin fondo). */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="Logo de El Maestro"
      width={9229}
      height={13600}
      unoptimized
      priority
      className={cn("h-auto w-8 shrink-0", className)}
    />
  );
}

/** Marca horizontal para el menú: logo a la izquierda, nombre y "Ecommerce" apilados a la derecha. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 overflow-hidden transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0!",
        className
      )}
    >
      <BrandLogo className="w-8 transition-[width,margin] duration-200 ease-linear group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />
      <div className="flex min-w-0 max-w-40 flex-col leading-tight transition-[opacity,max-width] duration-200 ease-linear group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
        <span className="truncate text-sm font-semibold">El Maestro</span>
        <span className="truncate text-[11px] text-muted-foreground">Ecommerce</span>
      </div>
    </div>
  );
}
