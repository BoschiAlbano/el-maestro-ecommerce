import { describe, expect, it } from "vitest";
import { buildTicketLines, type TicketLinesInput } from "./ticket-lines";
import { MAX } from "./ticket-texto";

const base: TicketLinesInput = {
  razonSocial: "El Maestro Ecommerce",
  extraText: null,
  ticketNumber: 16,
  when: "19/10/26, 18:42",
  employee: "Admin",
  voided: false,
  items: [
    { id: "1", quantity: 2, name: "Cable USB-C", subtotal: 9000 },
    { id: "2", quantity: 1, name: "Auriculares inalámbricos bluetooth", subtotal: 18500 },
  ],
  total: 27500,
  deposit: null,
};

describe("buildTicketLines", () => {
  it("ninguna línea pasa del ancho de la impresora", () => {
    for (const line of buildTicketLines({ ...base, extraText: "Gracias por su compra, vuelva pronto", deposit: { applied: 5000, remaining: 1200 } })) {
      expect(line.length).toBeLessThanOrEqual(MAX);
    }
  });

  it("el total va contra el borde derecho", () => {
    const total = buildTicketLines(base).find((l) => l.startsWith("TOTAL"));
    expect(total).toBeDefined();
    expect(total!.length).toBe(MAX);
    expect(total!.endsWith("$27.500")).toBe(true);
  });

  it("un ítem corto lleva el monto en la misma línea", () => {
    const line = buildTicketLines(base).find((l) => l.startsWith("2 x Cable USB-C"));
    expect(line).toBeDefined();
    expect(line!.endsWith("$9.000")).toBe(true);
    expect(line!.length).toBe(MAX);
  });

  it("un ítem largo se corta por palabras y el monto queda en su línea o al final", () => {
    const lines = buildTicketLines(base);
    const start = lines.findIndex((l) => l.startsWith("1 x Auriculares"));
    expect(start).toBeGreaterThan(-1);
    const block = lines.slice(start, start + 3).join("|");
    expect(block).toContain("$18.500");
    // Ninguna palabra queda cortada a la mitad.
    expect(lines.join("\n")).toContain("bluetooth");
  });

  it("muestra seña y saldo solo si hay seña aplicada", () => {
    expect(buildTicketLines(base).join("\n")).not.toContain("Seña aplicada");
    const withDeposit = buildTicketLines({ ...base, deposit: { applied: 5000, remaining: 1200 } }).join("\n");
    expect(withDeposit).toContain("Seña aplicada");
    expect(withDeposit).toContain("$5.000");
    expect(withDeposit).toContain("Saldo a favor");
    expect(withDeposit).toContain("$1.200");
  });

  it("marca la venta anulada", () => {
    expect(buildTicketLines({ ...base, voided: true }).join("\n")).toContain("** VENTA ANULADA **");
    expect(buildTicketLines(base).join("\n")).not.toContain("ANULADA");
  });

  it("siempre cierra con la leyenda de documento no válido", () => {
    const text = buildTicketLines(base).join("\n");
    expect(text).toContain("DOCUMENTO NO VÁLIDO");
    expect(text).toContain("COMO FACTURA");
  });

  it("sin razón social ni texto adicional no deja líneas de más", () => {
    const text = buildTicketLines({ ...base, razonSocial: null }).join("\n");
    expect(text).not.toContain("El Maestro");
  });
});
