import { describe, expect, it } from "vitest";
import { mapListingStatus, statusChangeNote } from "./listing-status";

describe("mapListingStatus", () => {
  it("activa", () => {
    expect(mapListingStatus("active", [])).toEqual({ status: "ACTIVE", reason: null, imposedByMercadoLibre: false });
  });

  it("pausada por el vendedor (la publicación de la prueba técnica)", () => {
    expect(mapListingStatus("paused", ["paused_by_seller"])).toEqual({
      status: "PAUSED",
      reason: null,
      imposedByMercadoLibre: false,
    });
  });

  it("pausada sin stock", () => {
    expect(mapListingStatus("paused", ["out_of_stock"])).toEqual({
      status: "PAUSED_NO_STOCK",
      reason: "Sin unidades disponibles.",
      imposedByMercadoLibre: false,
    });
  });

  it("pausada por el vendedor y en 0 unidades: sigue siendo pausada por el vendedor (prueba técnica 021)", () => {
    expect(mapListingStatus("paused", ["out_of_stock", "paused_by_seller"])).toEqual({
      status: "PAUSED",
      reason: null,
      imposedByMercadoLibre: false,
    });
  });

  it("pausada por Mercado Libre, con motivo", () => {
    const result = mapListingStatus("paused", ["held"]);
    expect(result.status).toBe("PAUSED");
    expect(result.reason).toBe("Mercado Libre la retuvo para revisarla.");
    expect(result.imposedByMercadoLibre).toBe(true);
  });

  it("sin stock y además retenida: manda la retención", () => {
    const result = mapListingStatus("paused", ["out_of_stock", "held"]);
    expect(result.status).toBe("PAUSED");
    expect(result.imposedByMercadoLibre).toBe(true);
  });

  it("observada, con y sin motivo", () => {
    expect(mapListingStatus("under_review", ["waiting_for_patch"]).reason).toBe(
      "Mercado Libre pide corregir la publicación.",
    );
    expect(mapListingStatus("under_review", [])).toEqual({
      status: "UNDER_REVIEW",
      reason: "Mercado Libre la está revisando.",
      imposedByMercadoLibre: true,
    });
  });

  it("inactiva se muestra como observada", () => {
    expect(mapListingStatus("inactive", []).status).toBe("UNDER_REVIEW");
  });

  it("finalizada por el vendedor y dada de baja por Mercado Libre", () => {
    expect(mapListingStatus("closed", [])).toEqual({ status: "CLOSED", reason: null, imposedByMercadoLibre: false });
    expect(mapListingStatus("closed", ["forbidden"]).imposedByMercadoLibre).toBe(true);
  });

  it("un subestado desconocido se muestra tal cual", () => {
    expect(mapListingStatus("paused", ["algo_nuevo"]).reason).toBe(
      "Motivo informado por Mercado Libre: algo_nuevo.",
    );
  });

  it("un estado desconocido queda como observada, con el estado en el motivo", () => {
    const result = mapListingStatus("payment_required", []);
    expect(result.status).toBe("UNDER_REVIEW");
    expect(result.reason).toContain("payment_required");
  });
});

describe("statusChangeNote (todo cambio de Mercado Libre avisa, salvo por stock)", () => {
  it("sin cambio de estado, no avisa", () => {
    expect(statusChangeNote("UNDER_REVIEW", mapListingStatus("under_review", []))).toBeNull();
  });

  it("pausada, reactivada o finalizada por el vendedor desde Mercado Libre", () => {
    expect(statusChangeNote("ACTIVE", mapListingStatus("paused", ["paused_by_seller"]))).toBe("Se pausó desde Mercado Libre.");
    expect(statusChangeNote("PAUSED", mapListingStatus("active", []))).toBe("Se reactivó desde Mercado Libre.");
    expect(statusChangeNote("ACTIVE", mapListingStatus("closed", []))).toBe("Se finalizó desde Mercado Libre.");
  });

  it("lo que decide Mercado Libre avisa con el motivo", () => {
    expect(statusChangeNote("ACTIVE", mapListingStatus("under_review", ["waiting_for_patch"]))).toBe(
      "Quedó observada por Mercado Libre: Mercado Libre pide corregir la publicación.",
    );
    expect(statusChangeNote("ACTIVE", mapListingStatus("paused", ["held"]))).toBe(
      "Quedó pausada: Mercado Libre la retuvo para revisarla.",
    );
    expect(statusChangeNote("ACTIVE", mapListingStatus("closed", ["forbidden"]))).toBe(
      "Quedó finalizada: Mercado Libre la dio de baja por no cumplir sus políticas.",
    );
  });

  it("pausada sin stock y su vuelta no avisan (las provoca el sistema)", () => {
    expect(statusChangeNote("ACTIVE", mapListingStatus("paused", ["out_of_stock"]))).toBeNull();
    expect(statusChangeNote("PAUSED_NO_STOCK", mapListingStatus("active", []))).toBeNull();
  });
});
