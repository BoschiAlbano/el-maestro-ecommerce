import { describe, expect, it } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { cropLabelTo10x15, LABEL_BOX, LABEL_HEIGHT, LABEL_WIDTH } from "./label";

/** Una hoja como la de Mercado Libre: A4 apaisada con la etiqueta arriba a la izquierda, y una segunda hoja. */
async function mercadoLibreLikePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const sheet = doc.addPage([841.89, 595.28]);
  sheet.drawRectangle({
    x: LABEL_BOX.left + 4,
    y: LABEL_BOX.bottom + 4,
    width: LABEL_BOX.right - LABEL_BOX.left - 8,
    height: LABEL_BOX.top - LABEL_BOX.bottom - 8,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  doc.addPage([595.28, 841.89]);
  return doc.save();
}

describe("cropLabelTo10x15", () => {
  it("devuelve una sola página de 10 × 15 cm", async () => {
    const result = await PDFDocument.load(await cropLabelTo10x15(await mercadoLibreLikePdf()));
    expect(result.getPageCount()).toBe(1);
    const { width, height } = result.getPage(0).getSize();
    expect(width).toBeCloseTo(LABEL_WIDTH, 1);
    expect(height).toBeCloseTo(LABEL_HEIGHT, 1);
    expect((width / 72) * 2.54).toBeCloseTo(10, 1);
    expect((height / 72) * 2.54).toBeCloseTo(15, 1);
  });

  it("el rectángulo de la etiqueta entra en la página sin agrandarse de más", () => {
    const width = LABEL_BOX.right - LABEL_BOX.left;
    const height = LABEL_BOX.top - LABEL_BOX.bottom;
    const scale = Math.min(LABEL_WIDTH / width, LABEL_HEIGHT / height);
    expect(scale).toBeGreaterThan(0.95);
    expect(scale).toBeLessThan(1.1);
  });

  it("un archivo que no es un PDF falla", async () => {
    await expect(cropLabelTo10x15(new TextEncoder().encode("no es un pdf"))).rejects.toThrow();
  });
});
