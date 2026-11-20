import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  KIND_CODE,
  KIND_TITLE,
  TEST_LEGEND,
  formatCuit,
  formatInvoiceNumber,
  formatIsoDate,
  formatMoneyAr,
  type InvoiceView,
} from "@/lib/facturacion/invoice-document";

// La factura en A4 (specs/023, RF-19): para mandar por mail o WhatsApp, y la
// que se sube a la compra de Mercado Libre (specs/024, RF-13). En 10 × 15 cm,
// para la impresora de etiquetas, junto con la etiqueta del envío (specs/024,
// RF-17). Mismos datos que el ticket de 58 mm. Solo fuentes estándar: el PDF
// queda liviano.

export type InvoicePdfFormat = "a4" | "10x15";

/** 10 × 15 cm en puntos (72 por pulgada): el tamaño de la etiqueta de Mercado Libre. */
export const LABEL_PAGE_SIZE: [number, number] = [283.46, 425.2];

const a4Styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#000" },
  testBanner: { borderWidth: 1, borderColor: "#000", padding: 4, textAlign: "center", fontFamily: "Helvetica-Bold", marginBottom: 8 },
  header: { flexDirection: "row", borderWidth: 1, borderColor: "#000" },
  headerSide: { flex: 1, padding: 10 },
  letterBox: { width: 70, alignItems: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#000", paddingVertical: 8 },
  letter: { fontSize: 32, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  block: { borderWidth: 1, borderColor: "#000", borderTopWidth: 0, padding: 8 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", paddingBottom: 3, marginTop: 10, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderColor: "#999" },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colUnit: { width: 80, textAlign: "right" },
  colSub: { width: 80, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10, fontSize: 13, fontFamily: "Helvetica-Bold" },
  footer: { flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 },
  qr: { width: 90, height: 90 },
});

/** Lo mismo, apretado para 10 × 15: la factura entra en una sola etiqueta. */
const labelStyles = StyleSheet.create({
  ...a4Styles,
  page: { padding: 10, fontSize: 8, fontFamily: "Helvetica", color: "#000" },
  testBanner: { borderWidth: 1, borderColor: "#000", padding: 2, textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 6, marginBottom: 4 },
  headerSide: { flex: 1, padding: 4 },
  letterBox: { width: 32, alignItems: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#000", paddingVertical: 3 },
  letter: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 5.5 },
  title: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  block: { borderWidth: 1, borderColor: "#000", borderTopWidth: 0, padding: 4 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", paddingBottom: 2, marginTop: 5, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderColor: "#999" },
  colQty: { width: 22, textAlign: "right" },
  colUnit: { width: 50, textAlign: "right" },
  colSub: { width: 50, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 5, fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  footer: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  qr: { width: 72, height: 72 },
});

export function InvoicePdfDocument({ view, format = "a4" }: { view: InvoiceView; format?: InvoicePdfFormat }) {
  if (view.status !== "AUTHORIZED" || view.number === null || !view.emitter) {
    throw new Error("Solo un comprobante autorizado tiene PDF.");
  }
  const e = view.emitter;
  const test = view.environment === "HOMOLOGACION";
  const styles = format === "10x15" ? labelStyles : a4Styles;

  return (
    <Document title={`${KIND_TITLE[view.kind]} ${formatInvoiceNumber(view.pointOfSale, view.number)}`}>
      <Page size={format === "10x15" ? LABEL_PAGE_SIZE : "A4"} style={styles.page}>
        {test && <Text style={styles.testBanner}>{TEST_LEGEND}</Text>}

        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Text style={styles.title}>{e.razonSocial}</Text>
            <Text>{e.domicilioComercial}</Text>
            <Text>Condición frente al IVA: {e.condicionIva}</Text>
          </View>
          <View style={styles.letterBox}>
            <Text style={styles.letter}>C</Text>
            <Text style={styles.small}>Cód. {KIND_CODE[view.kind]}</Text>
          </View>
          <View style={styles.headerSide}>
            <Text style={styles.title}>{KIND_TITLE[view.kind]}</Text>
            <Text style={styles.bold}>Nº {formatInvoiceNumber(view.pointOfSale, view.number)}</Text>
            <Text>Fecha de emisión: {formatIsoDate(view.issueDate)}</Text>
            <Text>CUIT: {formatCuit(e.cuit)}</Text>
            <Text>Ingresos Brutos: {e.iibb}</Text>
            {e.inicioActividades && <Text>Inicio de actividades: {formatIsoDate(e.inicioActividades)}</Text>}
          </View>
        </View>

        <View style={styles.block}>
          <Text>
            <Text style={styles.bold}>Cliente: </Text>
            {view.receiver.name ?? "Consumidor Final"}
            {view.receiver.docLabel ? `  -  ${view.receiver.docLabel}` : ""}
          </Text>
          <Text>
            <Text style={styles.bold}>Condición frente al IVA: </Text>
            {view.receiver.ivaLabel}
          </Text>
          {view.receiver.address && (
            <Text>
              <Text style={styles.bold}>Domicilio: </Text>
              {view.receiver.address}
            </Text>
          )}
          {view.relatedNumberLabel && (
            <Text>
              <Text style={styles.bold}>Anula la factura: </Text>
              {view.relatedNumberLabel}
            </Text>
          )}
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.colDesc}>Descripción</Text>
          <Text style={styles.colQty}>Cant.</Text>
          <Text style={styles.colUnit}>Precio unit.</Text>
          <Text style={styles.colSub}>Subtotal</Text>
        </View>
        {view.items.map((item, index) => (
          <View key={index} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colUnit}>{formatMoneyAr(item.unitPrice)}</Text>
            <Text style={styles.colSub}>{formatMoneyAr(item.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text>Total: {formatMoneyAr(view.total)}</Text>
        </View>

        <View style={styles.footer} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- es la imagen del PDF, no un <img> */}
          {view.qrDataUrl && <Image src={view.qrDataUrl} style={styles.qr} />}
          <View>
            <Text style={styles.bold}>Comprobante autorizado</Text>
            <Text>CAE: {view.cae}</Text>
            <Text>Vencimiento del CAE: {formatIsoDate(view.caeExpiresAt)}</Text>
          </View>
        </View>

        {test && <Text style={[styles.testBanner, { marginTop: format === "10x15" ? 6 : 16 }]}>{TEST_LEGEND}</Text>}
      </Page>
    </Document>
  );
}

/** El PDF de un comprobante, en A4 o en 10 × 15. */
export async function renderInvoicePdf(view: InvoiceView, format: InvoicePdfFormat = "a4"): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(InvoicePdfDocument({ view, format })));
}
