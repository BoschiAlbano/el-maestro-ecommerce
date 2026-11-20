import { describe, expect, it } from "vitest";
import {
  BUSINESS_TABLES,
  RESET_PHRASE,
  summarizeReset,
  validateResetConfirmation,
  type ResetCounts,
} from "./system-reset";

const empty: ResetCounts = {
  products: 0,
  brands: 0,
  rubros: 0,
  sales: 0,
  orders: 0,
  stockEntries: 0,
  cashShifts: 0,
  employees: 0,
  otherUsers: 0,
  otherRoles: 0,
  auditLogs: 0,
  invoices: 0,
  realInvoices: 0,
  pendingInvoices: 0,
  linkedListings: 0,
  openShift: false,
  pendingOrders: 0,
};

describe("validateResetConfirmation", () => {
  it("acepta la contraseña y la frase exacta", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: RESET_PHRASE })).toBeNull();
  });

  it("ignora los espacios de los extremos de la frase", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: `  ${RESET_PHRASE} ` })).toBeNull();
  });

  it("exige la frase tal cual: mayúsculas y espacios internos", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: "reiniciar el sistema" })).not.toBeNull();
    expect(validateResetConfirmation({ password: "clave", phrase: "REINICIAR  EL SISTEMA" })).not.toBeNull();
    expect(validateResetConfirmation({ password: "clave", phrase: "" })).not.toBeNull();
  });

  it("exige la contraseña", () => {
    expect(validateResetConfirmation({ password: "", phrase: RESET_PHRASE })).toBe("Ingresá tu contraseña.");
  });
});

describe("summarizeReset", () => {
  it("lista todo en cero para un sistema vacío, sin avisos", () => {
    const { rows, warnings } = summarizeReset(empty);
    expect(rows.every((r) => r.count === 0)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("usa singular y plural según la cantidad", () => {
    const { rows } = summarizeReset({ ...empty, products: 1, sales: 3 });
    expect(rows.find((r) => r.count === 1)?.label).toBe("producto");
    expect(rows.find((r) => r.count === 3)?.label).toBe("ventas");
  });

  it("avisa de un turno abierto y de los pedidos pendientes", () => {
    const { warnings } = summarizeReset({ ...empty, openShift: true, pendingOrders: 2 });
    expect(warnings).toEqual([
      "Hay un turno de caja abierto: se va a perder.",
      "Hay 2 pedidos pendientes: se van a perder.",
    ]);
  });

  it("avisa en singular con un solo pedido pendiente", () => {
    expect(summarizeReset({ ...empty, pendingOrders: 1 }).warnings).toEqual(["Hay 1 pedido pendiente: se va a perder."]);
  });
});

describe("summarizeReset con comprobantes (specs/023)", () => {
  it("cuenta los comprobantes como una fila más", () => {
    const { rows } = summarizeReset({ ...empty, invoices: 2 });
    expect(rows.find((r) => r.count === 2)?.label).toBe("comprobantes electrónicos");
  });

  it("con comprobantes reales avisa fuerte: siguen en ARCA, qué se pierde y qué no", () => {
    const { warnings } = summarizeReset({ ...empty, invoices: 3, realInvoices: 3 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/3 comprobantes reales emitidos en ARCA/);
    expect(warnings[0]).toMatch(/NO los anula/);
    expect(warnings[0]).toMatch(/Excel/);
    expect(warnings[0]).toMatch(/se conservan/);
  });

  it("solo con comprobantes de prueba no hay advertencia fuerte", () => {
    expect(summarizeReset({ ...empty, invoices: 5 }).warnings).toEqual([]);
  });

  it("avisa de los pendientes de emitir, en singular y plural", () => {
    expect(summarizeReset({ ...empty, invoices: 1, pendingInvoices: 1 }).warnings).toEqual([
      "Hay 1 comprobante pendiente de emitir: se va a perder sin emitirse.",
    ]);
    expect(summarizeReset({ ...empty, invoices: 2, pendingInvoices: 2 }).warnings[0]).toMatch(/2 comprobantes pendientes/);
  });
});

describe("publicaciones vinculadas (specs/020)", () => {
  it("avisa que se pierde el vínculo pero no la publicación", () => {
    const { warnings, rows } = summarizeReset({ ...empty, linkedListings: 2 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/2 publicaciones de Mercado Libre vinculadas/);
    expect(warnings[0]).toMatch(/sigue en Mercado Libre/);
    expect(rows.some((r) => r.label.includes("Mercado Libre"))).toBe(false);
  });

  it("sin publicaciones vinculadas no avisa nada", () => {
    expect(summarizeReset(empty).warnings).toEqual([]);
  });
});

describe("BUSINESS_TABLES", () => {
  it("vacía los comprobantes y conserva la configuración de facturación (specs/023)", () => {
    expect(BUSINESS_TABLES).toContain("invoices");
    for (const table of ["fiscal_config", "arca_credentials", "arca_tickets"]) {
      expect(BUSINESS_TABLES).not.toContain(table);
    }
  });

  it("vacía los avisos de Mercado Libre (specs/019)", () => {
    expect(BUSINESS_TABLES).toContain("ml_notifications");
  });

  it("vacía las compras de Mercado Libre junto con las ventas (specs/022)", () => {
    for (const table of ["ml_orders", "ml_order_items", "ml_order_events", "sales"]) {
      expect(BUSINESS_TABLES).toContain(table);
    }
  });

  it("vacía los vínculos con Mercado Libre junto con los productos (specs/020)", () => {
    expect(BUSINESS_TABLES).toContain("ml_listings");
    expect(BUSINESS_TABLES).toContain("products");
  });

  it("conserva la cuenta de Mercado Libre, igual que la configuración (specs/019)", () => {
    expect(BUSINESS_TABLES).not.toContain("ml_connections");
    expect(BUSINESS_TABLES).not.toContain("settings");
  });

  it("no toca usuarios ni roles: se tratan aparte", () => {
    for (const table of ["users", "roles", "role_permissions"]) {
      expect(BUSINESS_TABLES).not.toContain(table);
    }
  });

  it("no repite tablas", () => {
    expect(new Set(BUSINESS_TABLES).size).toBe(BUSINESS_TABLES.length);
  });
});
