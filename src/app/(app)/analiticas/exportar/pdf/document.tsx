import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { AnalyticsData } from "@/lib/analytics-data";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#555" },
  value: { fontWeight: 700 },
  productRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
});

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

export function AnalyticsPdfDocument({
  data,
  verCostos,
  desde,
  hasta,
}: {
  data: AnalyticsData;
  verCostos: boolean;
  desde: string;
  hasta: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Resumen de analíticas</Text>
        <Text style={styles.subtitle}>
          Período: {desde} a {hasta}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Total vendido</Text>
          <Text style={styles.value}>{formatMoney(data.totalVentas)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Período anterior</Text>
          <Text>{formatMoney(data.periodoAnterior.totalVentas)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cantidad de ventas</Text>
          <Text style={styles.value}>{data.cantidadVentas}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ticket promedio</Text>
          <Text style={styles.value}>{formatMoney(data.ticketPromedio)}</Text>
        </View>

        {verCostos && data.margen && (
          <View style={styles.row}>
            <Text style={styles.label}>Margen total ({data.margen.marginPct.toFixed(1)}%)</Text>
            <Text style={styles.value}>{formatMoney(data.margen.totalMargin)}</Text>
          </View>
        )}
        {verCostos && data.valorizacionStock !== null && (
          <View style={styles.row}>
            <Text style={styles.label}>Valorización del stock actual</Text>
            <Text style={styles.value}>{formatMoney(data.valorizacionStock)}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Top 5 productos más vendidos</Text>
        {data.masVendidos.slice(0, 5).map((g) => (
          <View key={g.key} style={styles.productRow}>
            <Text>{g.label}</Text>
            <Text>
              {g.cantidad} un. — {formatMoney(g.total)}
            </Text>
          </View>
        ))}
        {data.masVendidos.length === 0 && <Text>Sin ventas en el período.</Text>}

        <Text style={styles.sectionTitle}>Diferencias de caja</Text>
        {data.diferenciasCaja.map((g) => (
          <View key={g.key} style={styles.productRow}>
            <Text>{g.label}</Text>
            <Text>
              {formatMoney(g.total)} en {g.count} cierre(s)
            </Text>
          </View>
        ))}
        {data.diferenciasCaja.length === 0 && <Text>Sin cierres de caja en el período.</Text>}
      </Page>
    </Document>
  );
}
