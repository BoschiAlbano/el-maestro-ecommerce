"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="w-fit print:hidden">
      Imprimir
    </Button>
  );
}
