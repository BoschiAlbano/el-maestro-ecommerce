// Etiqueta de envío de 10 × 15 cm a partir del PDF de Mercado Libre (specs/022,
// RF-16; plan sección 3.7). Mercado Libre la entrega en una hoja A4 apaisada,
// con la etiqueta en la esquina superior izquierda: se recorta ese rectángulo
// y se pone en una página de 10 × 15 para la impresora de etiquetas.
import { PDFDocument } from "pdf-lib";

const CM = 72 / 2.54;
/** Página de la impresora de etiquetas. */
export const LABEL_WIDTH = 10 * CM;
export const LABEL_HEIGHT = 15 * CM;

/**
 * Rectángulo de la etiqueta en la primera hoja (puntos, origen abajo a la
 * izquierda), medido con la etiqueta real de la prueba técnica, con unos
 * puntos de margen. Si Mercado Libre cambia el diseño, se ajusta acá y la
 * prueba de `label.test.ts` lo muestra.
 */
export const LABEL_BOX = { left: 27, bottom: 139, right: 293, top: 571 };

/** El PDF de Mercado Libre recortado a una página de 10 × 15 cm. */
export async function cropLabelTo10x15(source: Uint8Array): Promise<Uint8Array> {
  const original = await PDFDocument.load(source);
  const [first] = original.getPages();
  if (!first) throw new Error("El PDF de la etiqueta no tiene páginas.");

  const output = await PDFDocument.create();
  const embedded = await output.embedPage(first, LABEL_BOX);
  const width = LABEL_BOX.right - LABEL_BOX.left;
  const height = LABEL_BOX.top - LABEL_BOX.bottom;
  const scale = Math.min(LABEL_WIDTH / width, LABEL_HEIGHT / height);

  const page = output.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  page.drawPage(embedded, {
    x: (LABEL_WIDTH - width * scale) / 2,
    y: (LABEL_HEIGHT - height * scale) / 2,
    xScale: scale,
    yScale: scale,
  });
  return output.save();
}
