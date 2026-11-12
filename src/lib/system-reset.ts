// Reinicio del sistema (specs/017). Funciones puras: la validación de la
// confirmación y el armado del resumen se usan en el servidor y en la pantalla.

export const RESET_PHRASE = "REINICIAR EL SISTEMA";

/**
 * Tablas de negocio que el reinicio vacía (specs/017, plan sección 3). Los
 * nombres son fijos, no vienen de ninguna entrada del usuario. Todo lo que
 * referencia a estas tablas también está en la lista, así que `CASCADE` no
 * arrastra nada más. Quedan afuera `users`, `roles`, `role_permissions`,
 * `settings`, `ml_connections` (la cuenta de Mercado Libre es configuración,
 * no datos del negocio: specs/019) y los datos de facturación (`fiscal_config`,
 * `arca_credentials`, `arca_tickets`: son configuración, specs/023), que se
 * tratan aparte. Los comprobantes (`invoices`) sí se vacían, con una advertencia
 * fuerte si hay reales.
 */
export const BUSINESS_TABLES = [
  "audit_logs",
  "notifications",
  "ml_notifications",
  "ticket_reprints",
  "invoices",
  "sale_items",
  "sales",
  "order_items",
  "orders",
  "cash_movements",
  "cash_shifts",
  "stock_entry_items",
  "stock_entries",
  "stock_movements",
  "product_price_history",
  "products",
  "brands",
  "rubros",
  "employees",
] as const;

/** Devuelve el mensaje de error, o `null` si la confirmación es válida. */
export function validateResetConfirmation(input: { password: string; phrase: string }): string | null {
  if (!input.password) return "Ingresá tu contraseña.";
  if (input.phrase.trim() !== RESET_PHRASE) {
    return `Escribí exactamente la frase ${RESET_PHRASE}.`;
  }
  return null;
}

export type ResetCounts = {
  products: number;
  brands: number;
  rubros: number;
  sales: number;
  orders: number;
  stockEntries: number;
  cashShifts: number;
  employees: number;
  /** Sin contar al Dueño que ejecuta el reinicio. */
  otherUsers: number;
  /** Sin contar al rol Dueño. */
  otherRoles: number;
  auditLogs: number;
  /** Todos los comprobantes (specs/023), de prueba o reales. */
  invoices: number;
  /** Los que ya están autorizados por ARCA con validez fiscal: siguen existiendo en ARCA. */
  realInvoices: number;
  /** Los que todavía no se emitieron: se pierden sin emitirse. */
  pendingInvoices: number;
  openShift: boolean;
  pendingOrders: number;
};

type CountKey = Exclude<keyof ResetCounts, "openShift" | "pendingOrders" | "realInvoices" | "pendingInvoices">;

const ROWS: { key: CountKey; singular: string; plural: string }[] = [
  { key: "products", singular: "producto", plural: "productos" },
  { key: "brands", singular: "marca", plural: "marcas" },
  { key: "rubros", singular: "rubro", plural: "rubros" },
  { key: "sales", singular: "venta", plural: "ventas" },
  { key: "invoices", singular: "comprobante electrónico", plural: "comprobantes electrónicos" },
  { key: "orders", singular: "pedido", plural: "pedidos" },
  { key: "stockEntries", singular: "ingreso de mercadería", plural: "ingresos de mercadería" },
  { key: "cashShifts", singular: "turno de caja", plural: "turnos de caja" },
  { key: "employees", singular: "empleado", plural: "empleados" },
  { key: "otherUsers", singular: "usuario (sin contarte a vos)", plural: "usuarios (sin contarte a vos)" },
  { key: "otherRoles", singular: "rol (sin contar Dueño)", plural: "roles (sin contar Dueño)" },
  { key: "auditLogs", singular: "entrada de auditoría", plural: "entradas de auditoría" },
];

export type ResetSummary = {
  rows: { label: string; count: number }[];
  warnings: string[];
};

/** Filas del resumen de lo que se va a borrar y avisos sobre lo que está en curso. */
export function summarizeReset(counts: ResetCounts): ResetSummary {
  const rows = ROWS.map(({ key, singular, plural }) => ({
    label: counts[key] === 1 ? singular : plural,
    count: counts[key],
  }));

  const warnings: string[] = [];
  if (counts.openShift) warnings.push("Hay un turno de caja abierto: se va a perder.");
  if (counts.pendingOrders > 0) {
    warnings.push(
      counts.pendingOrders === 1
        ? "Hay 1 pedido pendiente: se va a perder."
        : `Hay ${counts.pendingOrders} pedidos pendientes: se van a perder.`,
    );
  }

  if (counts.realInvoices > 0) {
    warnings.push(
      `Hay ${counts.realInvoices} ${counts.realInvoices === 1 ? "comprobante real emitido" : "comprobantes reales emitidos"} en ARCA. ` +
        "Borrarlos del sistema NO los anula: siguen existiendo en ARCA y cuentan para tu monotributo. " +
        "Acá se pierde la copia (no vas a poder volver a verlos ni reimprimirlos) y el acumulado contra el tope. " +
        "Antes de reiniciar, descargá el Excel desde Comprobantes. La numeración no se pierde: la lleva ARCA, " +
        "y los datos del emisor y el certificado se conservan.",
    );
  }
  if (counts.pendingInvoices > 0) {
    warnings.push(
      counts.pendingInvoices === 1
        ? "Hay 1 comprobante pendiente de emitir: se va a perder sin emitirse."
        : `Hay ${counts.pendingInvoices} comprobantes pendientes de emitir: se van a perder sin emitirse.`,
    );
  }

  return { rows, warnings };
}
