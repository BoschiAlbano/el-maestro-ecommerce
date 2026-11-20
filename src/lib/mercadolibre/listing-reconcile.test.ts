import { describe, expect, it } from "vitest";
import type { ListingRead } from "./listing-read";
import { reconcile, type ReconcileInput } from "./listing-reconcile";

const read: ListingRead = {
  mlItemId: "MLA1",
  title: "Cable USB",
  price: "15000",
  mlStatus: "active",
  mlSubStatus: [],
  quantity: 5,
  permalink: "https://articulo.mercadolibre.com.ar/MLA-1",
  thumbnailUrl: null,
  categoryId: "MLA5338",
  sku: "ABC-1",
  gtins: [],
  variationId: null,
  variationCount: 0,
  notLinkableReason: null,
};

function input(changes: {
  read?: Partial<ListingRead>;
  product?: Partial<ReconcileInput["product"]>;
  stored?: Partial<ReconcileInput["stored"]>;
  taken?: boolean;
  mode?: ReconcileInput["mode"];
}): ReconcileInput {
  return {
    read: { ...read, ...changes.read },
    product: { salePrice: "15000.00", sku: "ABC-1", currentStock: 5, ...changes.product },
    stored: { status: "ACTIVE", pricePending: false, ...changes.stored },
    incomingSkuTakenByOther: changes.taken ?? false,
    mode: changes.mode,
  };
}

describe("reconcile", () => {
  it("aviso de un cambio propio: todo coincide y no hace nada", () => {
    const result = reconcile(input({}));
    expect(result).toMatchObject({
      newSalePrice: null,
      pushPendingPrice: false,
      newProductSku: null,
      notification: null,
      closed: false,
    });
    expect(result.listing.skuConflict).toBeNull();
  });

  it("precio cambiado en Mercado Libre: pasa a ser el precio de venta y avisa", () => {
    const result = reconcile(input({ read: { price: "777700" } }));
    expect(result.newSalePrice).toBe("777700");
    expect(result.notification).toBe(
      "«Cable USB»: El precio cambió en Mercado Libre de $15.000 a $777.700: es el nuevo precio de venta.",
    );
  });

  it("precio con centavos se toma exacto", () => {
    expect(reconcile(input({ read: { price: "1234.5" } })).newSalePrice).toBe("1234.5");
  });

  it("con un envío propio pendiente, se mantiene el del sistema y se reintenta", () => {
    const result = reconcile(input({ read: { price: "777700" }, stored: { pricePending: true } }));
    expect(result.newSalePrice).toBeNull();
    expect(result.pushPendingPrice).toBe(true);
    expect(result.notification).toBeNull();
  });

  it("SKU cambiado en Mercado Libre: se toma y avisa", () => {
    const result = reconcile(input({ read: { sku: "WEB-020" } }));
    expect(result.newProductSku).toEqual({ sku: "WEB-020", skuKey: "WEB-020" });
    expect(result.notification).toBe("«Cable USB»: El SKU cambió en Mercado Libre de ABC-1 a WEB-020.");
  });

  it("solo cambian las mayúsculas del SKU: no es un cambio", () => {
    expect(reconcile(input({ read: { sku: "abc-1" } })).newProductSku).toBeNull();
  });

  it("SKU borrado en Mercado Libre: el producto queda sin SKU", () => {
    expect(reconcile(input({ read: { sku: null } })).newProductSku).toEqual({ sku: null, skuKey: null });
  });

  it("SKU de otro producto: no se toma y queda en conflicto", () => {
    const result = reconcile(input({ read: { sku: "OTRO-1" }, taken: true }));
    expect(result.newProductSku).toBeNull();
    expect(result.listing.skuConflict).toBe("OTRO-1");
    expect(result.notification).toContain("no se tomó");
  });

  it("un conflicto de SKU ya señalado no vuelve a avisar", () => {
    const result = reconcile(input({ read: { sku: "OTRO-1" }, taken: true, stored: { skuConflict: "OTRO-1" } }));
    expect(result.notification).toBeNull();
  });

  it("SKU que no cumple el RF-1: no se toma y queda en conflicto", () => {
    const result = reconcile(input({ read: { sku: "CON ESPACIO" } }));
    expect(result.newProductSku).toBeNull();
    expect(result.listing.skuConflict).toBe("CON ESPACIO");
  });

  it("cuando los dos lados vuelven a coincidir, el conflicto se borra", () => {
    expect(reconcile(input({ read: { sku: "ABC-1" } })).listing.skuConflict).toBeNull();
  });

  it("observada por Mercado Libre: cambia el estado y avisa con el motivo", () => {
    const result = reconcile(input({ read: { mlStatus: "under_review", mlSubStatus: ["waiting_for_patch"] } }));
    expect(result.listing.status).toBe("UNDER_REVIEW");
    expect(result.notification).toBe(
      "«Cable USB»: Quedó observada por Mercado Libre: Mercado Libre pide corregir la publicación.",
    );
  });

  it("pausada por el vendedor desde la web: cambia el estado y avisa", () => {
    const result = reconcile(input({ read: { mlStatus: "paused", mlSubStatus: ["paused_by_seller"] } }));
    expect(result.listing.status).toBe("PAUSED");
    expect(result.notification).toBe("«Cable USB»: Se pausó desde Mercado Libre.");
  });

  it("pausada sin stock no avisa", () => {
    const result = reconcile(input({ read: { mlStatus: "paused", mlSubStatus: ["out_of_stock"] } }));
    expect(result.listing.status).toBe("PAUSED_NO_STOCK");
    expect(result.notification).toBeNull();
  });

  it("varios cambios a la vez van en un solo aviso", () => {
    const result = reconcile(
      input({ read: { mlStatus: "paused", mlSubStatus: ["paused_by_seller"], price: "20000", sku: "WEB-020" } }),
    );
    expect(result.notification).toBe(
      "«Cable USB»: Se pausó desde Mercado Libre. El precio cambió en Mercado Libre de $15.000 a $20.000: es el nuevo precio de venta. El SKU cambió en Mercado Libre de ABC-1 a WEB-020.",
    );
  });

  it("pausa propia ya guardada: el aviso no encuentra diferencia", () => {
    const result = reconcile(
      input({ read: { mlStatus: "paused", mlSubStatus: ["held"] }, stored: { status: "PAUSED" } }),
    );
    expect(result.notification).toBeNull();
  });

  it("finalizada: libera el producto, avisa y no toma precio ni SKU", () => {
    const result = reconcile(input({ read: { mlStatus: "closed", price: "1", sku: "OTRO" } }));
    expect(result.closed).toBe(true);
    expect(result.newSalePrice).toBeNull();
    expect(result.newProductSku).toBeNull();
    expect(result.notification).toBe("«Cable USB»: Se finalizó desde Mercado Libre.");
  });

  it("guarda lo último que se leyó", () => {
    const result = reconcile(input({ read: { price: "20000", sku: "WEB-020", title: "Nuevo título" } }));
    expect(result.listing).toMatchObject({ lastKnownPrice: "20000", lastKnownSku: "WEB-020", title: "Nuevo título" });
  });
});

describe("reconcile: cantidad (specs/021, plan sección 3.3)", () => {
  it("igual a la del sistema: nada, también el aviso de un envío propio", () => {
    expect(reconcile(input({ read: { quantity: 5 } })).pushQuantity).toBe(false);
    expect(reconcile(input({ read: { quantity: 5 }, mode: "control" })).pushQuantity).toBe(false);
  });

  it("Mercado Libre tiene de más: se envía, en los dos modos", () => {
    expect(reconcile(input({ read: { quantity: 9 } })).pushQuantity).toBe(true);
    expect(reconcile(input({ read: { quantity: 9 }, mode: "control" })).pushQuantity).toBe(true);
  });

  it("Mercado Libre tiene de menos: con un aviso no se sube (puede ser una venta sin registrar)", () => {
    expect(reconcile(input({ read: { quantity: 4 } })).pushQuantity).toBe(false);
  });

  it("Mercado Libre tiene de menos: el control completo la corrige", () => {
    expect(reconcile(input({ read: { quantity: 4 }, mode: "control" })).pushQuantity).toBe(true);
  });

  it("con un envío propio pendiente, siempre se manda el del sistema", () => {
    expect(reconcile(input({ read: { quantity: 4 }, stored: { quantityPending: true } })).pushQuantity).toBe(true);
  });

  it("stock negativo corresponde a 0: con 0 en Mercado Libre no hay nada que hacer", () => {
    expect(reconcile(input({ read: { quantity: 0 }, product: { currentStock: -3 } })).pushQuantity).toBe(false);
  });

  it("finalizada: no se envía la cantidad", () => {
    expect(reconcile(input({ read: { mlStatus: "closed", quantity: 9 }, mode: "control" })).pushQuantity).toBe(false);
  });

  it("un cambio de cantidad no avisa en la campanita", () => {
    expect(reconcile(input({ read: { quantity: 9 } })).notification).toBeNull();
  });

  it("guarda la cantidad leída", () => {
    expect(reconcile(input({ read: { quantity: 4 } })).listing.lastKnownQuantity).toBe(4);
  });
});
