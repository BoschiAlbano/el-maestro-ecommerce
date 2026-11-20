// El comprobante tal como se muestra e imprime (specs/023, RF-19 y RF-20).
// Funciones puras: del dato ya armado a texto y HTML. El mismo HTML se ve en
// pantalla y sale por la impresora de 58 mm, así lo que se ve es lo que sale.

export type InvoiceKindValue = "FACTURA_C" | "NOTA_CREDITO_C";

export type InvoiceView = {
  id: string;
  kind: InvoiceKindValue;
  status: "PENDING" | "AUTHORIZED" | "DISCARDED";
  environment: "HOMOLOGACION" | "PRODUCCION";
  saleId: string;
  ticketNumber: number;
  pointOfSale: number;
  number: number | null;
  /** AAAA-MM-DD. */
  issueDate: string | null;
  cae: string | null;
  /** AAAA-MM-DD. */
  caeExpiresAt: string | null;
  total: number;
  emitter: {
    razonSocial: string;
    cuit: string;
    domicilioComercial: string;
    iibb: string;
    inicioActividades: string | null;
    condicionIva: string;
  } | null;
  receiver: {
    docLabel: string | null;
    name: string | null;
    ivaLabel: string;
    /** Domicilio fiscal (specs/024): solo en las facturas de Mercado Libre que lo traen. */
    address?: string | null;
  };
  items: { description: string; quantity: number; unitPrice: number; subtotal: number }[];
  /** En una nota de crédito: el número de la factura que anula. */
  relatedNumberLabel: string | null;
  qrDataUrl: string | null;
  lastError: string | null;
};

export const TEST_LEGEND = "COMPROBANTE DE PRUEBA, SIN VALIDEZ FISCAL";

export const KIND_TITLE: Record<InvoiceKindValue, string> = {
  FACTURA_C: "FACTURA C",
  NOTA_CREDITO_C: "NOTA DE CRÉDITO C",
};

/** Código de comprobante de ARCA, tal como va impreso: «Cód. 011». */
export const KIND_CODE: Record<InvoiceKindValue, string> = { FACTURA_C: "011", NOTA_CREDITO_C: "013" };

/** «0001-00000075». */
export function formatInvoiceNumber(pointOfSale: number, number: number): string {
  return `${String(pointOfSale).padStart(4, "0")}-${String(number).padStart(8, "0")}`;
}

/** «CUIT 20-11111111-2» a partir de once dígitos. */
/** Nombre del PDF: «factura-c-00001-00000091.pdf». */
export function invoicePdfFileName(view: Pick<InvoiceView, "kind" | "pointOfSale" | "number">): string {
  const title = KIND_TITLE[view.kind].toLowerCase().replace(/ /g, "-").replace("é", "e");
  return `${title}-${formatInvoiceNumber(view.pointOfSale, view.number ?? 0)}.pdf`;
}

export function formatCuit(cuit: string): string {
  const d = cuit.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}

/** «2026-11-11» → «11/11/2026». */
export function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMoneyAr(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * El comprobante autorizado como una página HTML de 58 mm. Solo se arma para
 * un comprobante autorizado: uno pendiente todavía no es un comprobante.
 */
export function buildInvoiceTicketHtml(view: InvoiceView): string {
  if (view.status !== "AUTHORIZED" || view.number === null || !view.cae || !view.emitter) {
    throw new Error("Solo un comprobante autorizado se puede imprimir.");
  }
  const e = view.emitter;
  const isTest = view.environment === "HOMOLOGACION";
  const line = (text: string) => `<div>${escapeHtml(text)}</div>`;
  const row = (left: string, right: string) =>
    `<div class="row"><span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span></div>`;

  const items = view.items.map((item) => {
    const detail = `${item.quantity} x ${formatMoneyAr(item.unitPrice)}`;
    return `<div class="item"><div>${escapeHtml(item.description)}</div>${row(detail, formatMoneyAr(item.subtotal))}</div>`;
  });

  const parts = [
    isTest ? `<div class="test">${escapeHtml(TEST_LEGEND)}</div>` : "",
    `<div class="c b">${escapeHtml(e.razonSocial)}</div>`,
    `<div class="c">${escapeHtml(`CUIT ${formatCuit(e.cuit)}`)}</div>`,
    `<div class="c">${escapeHtml(e.domicilioComercial)}</div>`,
    `<div class="c">${escapeHtml(`Ing. Brutos: ${e.iibb}`)}</div>`,
    e.inicioActividades ? `<div class="c">${escapeHtml(`Inicio de actividades: ${formatIsoDate(e.inicioActividades)}`)}</div>` : "",
    `<div class="c">${escapeHtml(e.condicionIva)}</div>`,
    `<hr>`,
    `<div class="c big">${escapeHtml(KIND_TITLE[view.kind])}</div>`,
    `<div class="c">${escapeHtml(`Cód. ${KIND_CODE[view.kind]}`)}</div>`,
    `<div class="c b">${escapeHtml(`Nº ${formatInvoiceNumber(view.pointOfSale, view.number)}`)}</div>`,
    `<div class="c">${escapeHtml(`Fecha: ${formatIsoDate(view.issueDate)}`)}</div>`,
    view.relatedNumberLabel ? `<div class="c">${escapeHtml(`Anula la factura ${view.relatedNumberLabel}`)}</div>` : "",
    `<hr>`,
    view.receiver.name ? line(`Cliente: ${view.receiver.name}`) : "",
    view.receiver.docLabel ? line(view.receiver.docLabel) : "",
    line(`IVA: ${view.receiver.ivaLabel}`),
    view.receiver.address ? line(`Domicilio: ${view.receiver.address}`) : "",
    `<hr>`,
    ...items,
    `<hr>`,
    `<div class="row total"><span>TOTAL</span><span>${escapeHtml(formatMoneyAr(view.total))}</span></div>`,
    `<hr>`,
    `<div>${escapeHtml(`CAE: ${view.cae}`)}</div>`,
    `<div>${escapeHtml(`Vto. CAE: ${formatIsoDate(view.caeExpiresAt)}`)}</div>`,
    view.qrDataUrl ? `<div class="c"><img class="qr" alt="Código QR de ARCA" src="${escapeHtml(view.qrDataUrl)}"></div>` : "",
    `<div class="c small">Comprobante autorizado</div>`,
    isTest ? `<div class="test">${escapeHtml(TEST_LEGEND)}</div>` : "",
  ];

  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
    `@page{size:58mm auto;margin:0}` +
    `html,body{margin:0;background:#fff;color:#000}` +
    `body{width:52mm;padding:2mm 3mm;font:11px/1.3 monospace;word-break:break-word}` +
    `.c{text-align:center}.b{font-weight:bold}.big{font-size:15px;font-weight:bold}.small{font-size:9px}` +
    `.row{display:flex;justify-content:space-between;gap:4px}` +
    `.total{font-size:14px;font-weight:bold}` +
    `.item{margin-bottom:2px}` +
    `hr{border:0;border-top:1px dashed #000;margin:4px 0}` +
    `.qr{width:34mm;height:34mm;image-rendering:pixelated;margin:3px 0}` +
    `.test{border:1px solid #000;text-align:center;font-weight:bold;padding:2px;margin:4px 0;font-size:10px}` +
    `</style></head><body>${parts.filter(Boolean).join("")}</body></html>`
  );
}
