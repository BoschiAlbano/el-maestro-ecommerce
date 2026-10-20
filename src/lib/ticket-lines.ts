import {
  MAX,
  addCenter,
  addExtremes,
  addRight,
  addSeparator,
  addSeparadorFuerte,
  formatoMonto,
  wrapWords,
} from "@/lib/ticket-texto";

/** Lo que necesita el ticket de una venta (specs/008, RF-5); lo arma `getTicketData`. */
export type TicketLinesInput = {
  razonSocial: string | null;
  extraText: string | null;
  ticketNumber: number;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  employee: string;
  voided: boolean;
  items: { id: string; quantity: number; name: string; subtotal: number }[];
  total: number;
  /** Solo en la entrega de un pedido con seña aplicada (specs/009, RF-5). */
  deposit: { applied: number; remaining: number } | null;
};

const centered = (text: string) => wrapWords(text).map(addCenter);

/**
 * Un ítem: "<cantidad> x <nombre>" cortado por palabras y el monto contra el
 * borde derecho — en la última línea si entra, o en una propia si no.
 */
function itemLines(quantity: number, name: string, subtotal: number): string[] {
  const amount = formatoMonto(subtotal);
  const lines = wrapWords(`${quantity} x ${name}`);
  const last = lines[lines.length - 1] ?? "";
  if (last.length + 1 + amount.length <= MAX) {
    return [...lines.slice(0, -1), addExtremes(last, amount)];
  }
  return [...lines, addRight(amount)];
}

/**
 * El ticket de 58 mm como líneas de texto plano ya alineadas con espacios
 * (helpers de `ticket-texto.ts`). Las térmicas en modo texto ignoran el CSS
 * (flex, bordes, text-align), así que cada línea se arma a mano.
 */
export function buildTicketLines(ticket: TicketLinesInput): string[] {
  const lines: string[] = [];

  lines.push(addSeparadorFuerte());
  if (ticket.razonSocial) lines.push(...centered(ticket.razonSocial));
  if (ticket.voided) lines.push(addCenter("** VENTA ANULADA **"));
  lines.push(addCenter(`Ticket #${ticket.ticketNumber}`));
  lines.push(addCenter(ticket.when));
  lines.push(...centered(`Atendió: ${ticket.employee}`));
  lines.push(addSeparator());

  for (const item of ticket.items) lines.push(...itemLines(item.quantity, item.name, item.subtotal));

  lines.push(addSeparator());
  lines.push(addExtremes("TOTAL", formatoMonto(ticket.total)));

  if (ticket.deposit) {
    lines.push(addSeparator());
    lines.push(addExtremes("Seña aplicada", formatoMonto(ticket.deposit.applied)));
    lines.push(addExtremes("Saldo a favor", formatoMonto(ticket.deposit.remaining)));
  }

  if (ticket.extraText) {
    lines.push(addSeparator());
    lines.push(...centered(ticket.extraText));
  }

  lines.push(addSeparator());
  // Dos líneas fijas: así no se parte en cualquier lado.
  lines.push(addCenter("DOCUMENTO NO VÁLIDO"), addCenter("COMO FACTURA"));
  lines.push(addSeparadorFuerte());
  // Espacio al final para que el corte del papel no pise la última línea.
  lines.push("", "");

  return lines;
}

/** Lo que necesita el ticket de la seña de un pedido (specs/009); lo arma `getDepositTicketData`. */
export type DepositTicketInput = {
  razonSocial: string | null;
  extraText: string | null;
  customerName: string;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  /** Quién cobró la seña. */
  employee: string;
  /** "Efectivo" o "Transferencia". */
  methodLabel: string;
  items: { id: string; quantity: number; name: string; subtotal: number }[];
  orderTotal: number;
  /** Lo abonado como seña. */
  deposit: number;
  /** Lo que falta pagar para completar el pedido (nunca negativo). */
  remaining: number;
};

/**
 * El comprobante de una seña en 58 mm: qué se abonó, el total del pedido y lo
 * que falta pagar. Mismo criterio que `buildTicketLines`: texto ya alineado.
 */
export function buildDepositTicketLines(ticket: DepositTicketInput): string[] {
  const lines: string[] = [];

  lines.push(addSeparadorFuerte());
  if (ticket.razonSocial) lines.push(...centered(ticket.razonSocial));
  lines.push(addCenter("SEÑA DE PEDIDO"));
  lines.push(addCenter(ticket.when));
  lines.push(...centered(`Cliente: ${ticket.customerName}`));
  lines.push(...centered(`Cobró: ${ticket.employee}`));
  lines.push(addSeparator());

  for (const item of ticket.items) lines.push(...itemLines(item.quantity, item.name, item.subtotal));

  lines.push(addSeparator());
  lines.push(addExtremes("TOTAL PEDIDO", formatoMonto(ticket.orderTotal)));
  lines.push(addExtremes("Seña abonada", formatoMonto(ticket.deposit)));
  lines.push(addExtremes(`(${ticket.methodLabel})`, ""));
  lines.push(addSeparator());
  lines.push(addExtremes("FALTA PAGAR", formatoMonto(ticket.remaining)));

  if (ticket.extraText) {
    lines.push(addSeparator());
    lines.push(...centered(ticket.extraText));
  }

  lines.push(addSeparator());
  lines.push(addCenter("DOCUMENTO NO VÁLIDO"), addCenter("COMO FACTURA"));
  lines.push(addSeparadorFuerte());
  // Espacio al final para que el corte del papel no pise la última línea.
  lines.push("", "");

  return lines;
}
