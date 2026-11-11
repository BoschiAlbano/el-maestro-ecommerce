// Reinicio del sistema (specs/017). Funciones puras: la validación de la
// confirmación y el armado del resumen se usan en el servidor y en la pantalla.

export const RESET_PHRASE = "REINICIAR EL SISTEMA";

/**
 * Tablas de negocio que el reinicio vacía (specs/017, plan sección 3). Los
 * nombres son fijos, no vienen de ninguna entrada del usuario. Todo lo que
 * referencia a estas tablas también está en la lista, así que `CASCADE` no
 * arrastra nada más. Quedan afuera `users`, `roles`, `role_permissions`,
 * `settings` y `ml_connections` (la cuenta de Mercado Libre es configuración,
 * no datos del negocio: specs/019), que se tratan aparte.
 */
export const BUSINESS_TABLES = [
  "audit_logs",
  "notifications",
  "ml_notifications",
  "ticket_reprints",
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
  openShift: boolean;
  pendingOrders: number;
};

type CountKey = Exclude<keyof ResetCounts, "openShift" | "pendingOrders">;

const ROWS: { key: CountKey; singular: string; plural: string }[] = [
  { key: "products", singular: "producto", plural: "productos" },
  { key: "brands", singular: "marca", plural: "marcas" },
  { key: "rubros", singular: "rubro", plural: "rubros" },
  { key: "sales", singular: "venta", plural: "ventas" },
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

  return { rows, warnings };
}
