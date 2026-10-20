import { describe, expect, it } from "vitest";
import { buildDepositTicketLines, buildTicketLines, type DepositTicketInput, type TicketLinesInput } from "./ticket-lines";
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

describe("buildDepositTicketLines", () => {
  const deposit: DepositTicketInput = {
    razonSocial: "El Maestro Ecommerce",
    extraText: "Gracias por su compra",
    customerName: "Juan Carlos Fernández",
    when: "20/10/26, 18:42",
    employee: "Admin",
    methodLabel: "Efectivo",
    items: [
      { id: "1", quantity: 2, name: "Cable USB-C", subtotal: 9000 },
      { id: "2", quantity: 1, name: "Auriculares inalámbricos bluetooth", subtotal: 18500 },
    ],
    orderTotal: 27500,
    deposit: 10000,
    remaining: 17500,
  };

  it("ninguna línea pasa del ancho de la impresora", () => {
    for (const line of buildDepositTicketLines(deposit)) {
      expect(line.length).toBeLessThanOrEqual(MAX);
    }
  });

  it("muestra el total, lo abonado y lo que falta, contra el borde derecho", () => {
    const lines = buildDepositTicketLines(deposit);
    const total = lines.find((l) => l.startsWith("TOTAL PEDIDO"));
    const abonado = lines.find((l) => l.startsWith("Seña abonada"));
    const falta = lines.find((l) => l.startsWith("FALTA PAGAR"));
    expect(total?.endsWith("$27.500")).toBe(true);
    expect(abonado?.endsWith("$10.000")).toBe(true);
    expect(falta?.endsWith("$17.500")).toBe(true);
    expect(falta!.length).toBe(MAX);
  });

  it("indica que es una seña y el cliente", () => {
    const text = buildDepositTicketLines(deposit).join("\n");
    expect(text).toContain("SEÑA DE PEDIDO");
    expect(text).toContain("Cliente:");
    expect(text).toContain("DOCUMENTO NO VÁLIDO");
  });

  it("si la seña cubre todo, falta pagar es cero", () => {
    const falta = buildDepositTicketLines({ ...deposit, deposit: 27500, remaining: 0 }).find((l) => l.startsWith("FALTA PAGAR"));
    expect(falta?.endsWith("$0")).toBe(true);
  });
});
