"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BarcodeSvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Los códigos propios siempre son EAN-13, pero uno de origen puede
    // venir en otro formato (UPC-A de 12, o lo que sea) — CODE128 como
    // repliegue genérico, para que la etiqueta nunca se quede sin dibujar.
    const format = /^\d{13}$/.test(value) ? "EAN13" : /^\d{12}$/.test(value) ? "UPC" : "CODE128";
    try {
      JsBarcode(ref.current, value, {
        format,
        height: 40,
        width: 1.5,
        displayValue: true,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      // Ni siquiera CODE128 lo aceptó (caracteres raros) — no se dibuja nada,
      // pero el nombre/precio de la etiqueta sigue siendo visible.
    }
  }, [value]);

  return <svg ref={ref} />;
}
