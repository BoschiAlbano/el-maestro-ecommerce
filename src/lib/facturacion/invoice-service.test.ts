import { describe, expect, it } from "vitest";
import { translateIssue, type VoucherOutcome } from "./arca-result";
import { ArcaError, type ExistingVoucher } from "./gateway";
import {
  authorizeInvoice,
  voucherMatches,
  type AuthorizeDeps,
  type AuthorizedData,
  type InvoiceRecord,
  type InvoiceStore,
} from "./invoice-service";
import type { ArcaVoucherRequest } from "./voucher";

const NOW = new Date("2026-11-11T15:00:00.000Z");
const PV = 1;

/** Un ARCA simulado con las reglas que se vieron en la prueba técnica. */
class FakeArca {
  vouchers = new Map<string, ExistingVoucher>();
  requests: ArcaVoucherRequest[] = [];
  events: string[];
  /** Qué hacer con el próximo pedido de emisión. */
  nextEmit: "ok" | "unreachable-before" | "unreachable-after" | "rejected" | "numbering-once" = "ok";
  private caeCounter = 86451067775000;

  constructor(events: string[]) {
    this.events = events;
  }

  private key = (pv: number, type: number, n: number) => `${pv}/${type}/${n}`;
  /** Último número autorizado por punto de venta y tipo: cada tipo tiene su propia numeración. */
  private last = new Map<string, number>();

  seed(type: number, number: number, patch: Partial<ExistingVoucher> = {}) {
    this.last.set(`${PV}/${type}`, Math.max(this.last.get(`${PV}/${type}`) ?? 0, number));
    this.vouchers.set(this.key(PV, type, number), {
      number,
      issueDate: "20261111",
      total: 100,
      docType: 99,
      docNumber: 0,
      cae: String(++this.caeCounter),
      caeExpiresAt: "20261121",
      authorized: true,
      ...patch,
    });
  }

  async lastNumber(pv: number, type: number) {
    this.events.push("lastNumber");
    return this.last.get(`${pv}/${type}`) ?? 0;
  }

  async findVoucher(pv: number, type: number, n: number) {
    this.events.push(`findVoucher:${n}`);
    return this.vouchers.get(this.key(pv, type, n)) ?? null;
  }

  async emit(request: ArcaVoucherRequest): Promise<VoucherOutcome> {
    this.events.push(`emit:${request.CbteDesde}`);
    this.requests.push(request);
    const mode = this.nextEmit;
    this.nextEmit = "ok";

    if (mode === "unreachable-before") throw new ArcaError("No se pudo comunicar con ARCA.", "unreachable");
    if (mode === "rejected") {
      return { status: "rejected", issues: [translateIssue(10246, "Campo Condicion Frente al IVA del receptor es obligatorio")] };
    }
    if (mode === "numbering-once") {
      // Otro sistema emitió en el medio: ARCA ya no espera este número.
      this.seed(request.CbteTipo, request.CbteDesde);
      return { status: "rejected", issues: [translateIssue(10016, "El numero o fecha del comprobante no se corresponde con el proximo a autorizar.")] };
    }

    const last = this.last.get(`${request.PtoVta}/${request.CbteTipo}`) ?? 0;
    if (request.CbteDesde !== last + 1) {
      return { status: "rejected", issues: [translateIssue(10016, "El numero o fecha del comprobante no se corresponde con el proximo a autorizar.")] };
    }
    this.seed(request.CbteTipo, request.CbteDesde, {
      total: request.ImpTotal,
      docType: request.DocTipo,
      docNumber: request.DocNro,
    });
    const stored = this.vouchers.get(this.key(request.PtoVta, request.CbteTipo, request.CbteDesde))!;
    if (mode === "unreachable-after") throw new ArcaError("No se pudo comunicar con ARCA.", "unreachable");
    return { status: "authorized", cae: stored.cae, caeExpiresAt: new Date("2026-11-21T00:00:00.000Z"), number: request.CbteDesde };
  }
}

class FakeStore implements InvoiceStore {
  records = new Map<string, InvoiceRecord>();
  authorized = new Map<string, AuthorizedData>();
  reasons = new Map<string, string>();
  attempts = new Map<string, number>();
  constructor(private events: string[]) {}

  add(patch: Partial<InvoiceRecord> & { id: string }): InvoiceRecord {
    const record: InvoiceRecord = {
      kind: "FACTURA_C",
      status: "PENDING",
      environment: "HOMOLOGACION",
      pointOfSale: PV,
      number: null,
      attemptedNumber: null,
      total: 100,
      receiverDocType: "NONE",
      receiverDocNumber: null,
      receiverIvaCondition: 5,
      saleVoided: false,
      relatedInvoice: null,
      ...patch,
    };
    this.records.set(record.id, record);
    return record;
  }

  async load(id: string) {
    const r = this.records.get(id);
    return r ? { ...r } : null;
  }
  async saveAttempt(id: string, attemptedNumber: number) {
    this.events.push(`saveAttempt:${attemptedNumber}`);
    this.records.get(id)!.attemptedNumber = attemptedNumber;
  }
  async markAuthorized(id: string, data: AuthorizedData) {
    this.events.push(`authorized:${data.number}`);
    const r = this.records.get(id)!;
    r.status = "AUTHORIZED";
    r.number = data.number;
    this.authorized.set(id, data);
  }
  async discard(id: string, reason: string) {
    this.events.push("discarded");
    this.records.get(id)!.status = "DISCARDED";
    this.reasons.set(id, reason);
  }
  async markPending(id: string, reason: string) {
    this.events.push("pending");
    this.reasons.set(id, reason);
    this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
  }
  async isNumberTakenByAnother(invoice: InvoiceRecord, number: number) {
    return [...this.records.values()].some(
      (r) => r.id !== invoice.id && r.status === "AUTHORIZED" && r.number === number && r.kind === invoice.kind && r.pointOfSale === invoice.pointOfSale,
    );
  }
}

function serialLock() {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };
}

function setup(options: { ensureTicket?: () => Promise<unknown> } = {}) {
  const events: string[] = [];
  const arca = new FakeArca(events);
  const store = new FakeStore(events);
  const deps: AuthorizeDeps = {
    now: () => NOW,
    emitterCuit: "20111111112",
    gateway: arca,
    store,
    ensureTicket: options.ensureTicket ?? (async () => "existing"),
    withLock: serialLock(),
    emitterSnapshot: () => ({ razonSocial: "Negocio de Prueba" }),
  };
  return { events, arca, store, deps };
}

describe("authorizeInvoice: el camino normal", () => {
  it("emite con el número siguiente y lo guarda ANTES de llamar a ARCA", async () => {
    const { events, arca, store, deps } = setup();
    arca.seed(11, 68);
    store.add({ id: "f1" });

    const result = await authorizeInvoice(deps, "f1");

    expect(result).toMatchObject({ status: "authorized", number: 69, recovered: false });
    expect(events.indexOf("saveAttempt:69")).toBeLessThan(events.indexOf("emit:69"));
    expect(events.indexOf("emit:69")).toBeLessThan(events.indexOf("authorized:69"));
    const saved = store.authorized.get("f1")!;
    expect(saved.cae).toMatch(/^\d{14}$/);
    expect(saved.issueDate.toISOString()).toBe("2026-11-11T00:00:00.000Z");
    expect(saved.emitterSnapshot).toEqual({ razonSocial: "Negocio de Prueba" });
  });

  it("una nota de crédito lleva asociada la factura original y usa su propia numeración", async () => {
    const { arca, store, deps } = setup();
    arca.seed(11, 70);
    store.add({ id: "f1", status: "AUTHORIZED", number: 70 });
    store.add({
      id: "nc1",
      kind: "NOTA_CREDITO_C",
      relatedInvoice: { status: "AUTHORIZED", number: 70, pointOfSale: PV, issueDate: new Date("2026-11-01T00:00:00Z") },
    });

    const result = await authorizeInvoice(deps, "nc1");
    expect(result).toMatchObject({ status: "authorized", number: 1 });
    expect(arca.requests[0]).toMatchObject({ CbteTipo: 13, CbtesAsoc: [{ Tipo: 11, Nro: 70, CbteFch: "20261101" }] });
  });

  it("una nota de crédito sobre una factura que no está autorizada no llama a ARCA", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "nc1", kind: "NOTA_CREDITO_C", relatedInvoice: { status: "PENDING", number: null, pointOfSale: PV, issueDate: null } });
    const result = await authorizeInvoice(deps, "nc1");
    expect(result).toMatchObject({ status: "pending", failure: "invalid" });
    expect(arca.requests).toHaveLength(0);
  });

  it("un comprobante ya autorizado no se vuelve a emitir", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1", status: "AUTHORIZED", number: 5 });
    expect(await authorizeInvoice(deps, "f1")).toMatchObject({ status: "authorized", number: 5 });
    expect(arca.requests).toHaveLength(0);
    expect(arca.events).not.toContain("lastNumber");
  });

  it("uno descartado ya no se autoriza", async () => {
    const { store, deps } = setup();
    store.add({ id: "f1", status: "DISCARDED" });
    await expect(authorizeInvoice(deps, "f1")).rejects.toThrow(/descartado/);
  });

  it("uno que no existe", async () => {
    const { deps } = setup();
    await expect(authorizeInvoice(deps, "nada")).rejects.toThrow(/no existe/);
  });
});

describe("authorizeInvoice: rechazos y caídas (la venta nunca se frena)", () => {
  it("un rechazo de ARCA queda pendiente, con el motivo en español, sin lanzar", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1" });
    arca.nextEmit = "rejected";

    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "pending", failure: "rejected" });
    expect(result.status === "pending" && result.reason).toMatch(/condición frente al IVA/);
    expect(store.records.get("f1")!.status).toBe("PENDING");
    expect(store.attempts.get("f1")).toBe(1);
  });

  it("si ARCA no responde, queda pendiente con el motivo y el número intentado guardado", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1" });
    arca.nextEmit = "unreachable-before";

    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "pending", failure: "unreachable" });
    expect(store.records.get("f1")!.attemptedNumber).toBe(1);
  });

  it("si no se pudo obtener el permiso, queda pendiente y no se llama a ARCA", async () => {
    const { arca, store, deps } = setup({
      ensureTicket: async () => {
        throw new ArcaError("ARCA tiene un permiso vigente que el sistema no tiene guardado", "already_authenticated");
      },
    });
    store.add({ id: "f1" });
    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "pending", failure: "already_authenticated" });
    expect(arca.requests).toHaveLength(0);
    expect(arca.events).not.toContain("lastNumber");
  });

  it("un error nuestro (no de ARCA) se registra y sube", async () => {
    const { store, deps } = setup();
    store.add({ id: "f1" });
    deps.gateway = {
      ...deps.gateway,
      lastNumber: async () => {
        throw new TypeError("algo roto");
      },
    } as AuthorizeDeps["gateway"];
    await expect(authorizeInvoice(deps, "f1")).rejects.toBeInstanceOf(TypeError);
    expect(store.reasons.get("f1")).toMatch(/inesperado/);
  });
});

describe("authorizeInvoice: nunca duplica", () => {
  it("si se perdió la respuesta pero ARCA SÍ autorizó, el reintento lo recupera y no emite otro", async () => {
    const { arca, store, deps } = setup();
    arca.seed(11, 68);
    store.add({ id: "f1", total: 2500 });
    arca.nextEmit = "unreachable-after";

    const first = await authorizeInvoice(deps, "f1");
    expect(first).toMatchObject({ status: "pending", failure: "unreachable" });
    expect(arca.vouchers.has("1/11/69")).toBe(true); // ARCA lo tiene
    expect(store.records.get("f1")!.status).toBe("PENDING"); // nosotros no lo sabíamos

    const emitsBefore = arca.requests.length;
    const second = await authorizeInvoice(deps, "f1");
    expect(second).toMatchObject({ status: "authorized", number: 69, recovered: true });
    expect(arca.requests).toHaveLength(emitsBefore); // no se emitió otro
    expect(store.authorized.get("f1")!.cae).toBe(arca.vouchers.get("1/11/69")!.cae);
    expect(store.authorized.get("f1")!.issueDate.toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });

  it("si ARCA NO lo autorizó, el reintento emite normalmente", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1" });
    arca.nextEmit = "unreachable-before";
    await authorizeInvoice(deps, "f1");
    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "authorized", number: 1, recovered: false });
    expect(arca.requests).toHaveLength(2);
  });

  it("el número intentado lo tomó otro comprobante nuestro: no se confunde con el de ARCA", async () => {
    const { arca, store, deps } = setup();
    // La factura A intentó el 69 y no llegó a autorizarse. La B tomó el 69 y sí.
    store.add({ id: "A", attemptedNumber: 69, total: 100 });
    store.add({ id: "B", status: "AUTHORIZED", number: 69, total: 100 });
    arca.seed(11, 69, { total: 100 });

    const result = await authorizeInvoice(deps, "A");
    expect(result).toMatchObject({ status: "authorized", number: 70, recovered: false });
  });

  it("el comprobante de ARCA con ese número es de otro importe o de otro comprador: no es este", async () => {
    for (const patch of [{ total: 999 }, { docType: 96, docNumber: 12345678 }]) {
      const { arca, store, deps } = setup();
      store.add({ id: "f1", attemptedNumber: 1, total: 100 });
      arca.seed(11, 1, patch);
      const result = await authorizeInvoice(deps, "f1");
      expect(result).toMatchObject({ status: "authorized", number: 2, recovered: false });
    }
  });

  it("un comprobante de ARCA no autorizado no se toma como el nuestro", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1", attemptedNumber: 1 });
    arca.seed(11, 1, { authorized: false });
    const result = await authorizeInvoice(deps, "f1");
    expect(result.status === "authorized" && result.recovered).toBe(false);
  });

  it("si otro emitió en el medio (número fuera de secuencia), vuelve a consultar y reintenta una vez", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1" });
    arca.nextEmit = "numbering-once";

    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "authorized", number: 2 });
    expect(arca.requests.map((r) => r.CbteDesde)).toEqual([1, 2]);
  });

  it("dos facturas distintas a la vez reciben números correlativos, sin repetir", async () => {
    const { arca, store, deps } = setup();
    arca.seed(11, 68);
    store.add({ id: "f1" });
    store.add({ id: "f2" });
    store.add({ id: "f3" });

    const results = await Promise.all([authorizeInvoice(deps, "f1"), authorizeInvoice(deps, "f2"), authorizeInvoice(deps, "f3")]);
    const numbers = results.map((r) => (r.status === "authorized" ? r.number : 0)).sort();
    expect(numbers).toEqual([69, 70, 71]);
  });

  it("la misma factura pedida dos veces a la vez se emite una sola vez", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1" });
    const [a, b] = await Promise.all([authorizeInvoice(deps, "f1"), authorizeInvoice(deps, "f1")]);
    expect([a.status, b.status]).toEqual(["authorized", "authorized"]);
    expect(arca.requests).toHaveLength(1);
  });
});

describe("authorizeInvoice: venta anulada con la factura pendiente (plan 3.4)", () => {
  it("si nunca se intentó, se descarta sin llamar a ARCA", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1", saleVoided: true });
    expect(await authorizeInvoice(deps, "f1")).toEqual({ status: "discarded" });
    expect(store.records.get("f1")!.status).toBe("DISCARDED");
    expect(arca.requests).toHaveLength(0);
    expect(arca.events).not.toContain("lastNumber");
  });

  it("si ARCA no la tenía, se descarta y no se emite", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1", saleVoided: true, attemptedNumber: 1 });
    expect(await authorizeInvoice(deps, "f1")).toEqual({ status: "discarded" });
    expect(arca.requests).toHaveLength(0);
  });

  it("si ARCA SÍ la había autorizado (se cortó la respuesta), se recupera y pide la nota de crédito", async () => {
    const { arca, store, deps } = setup();
    arca.seed(11, 69, { total: 100 });
    store.add({ id: "f1", saleVoided: true, attemptedNumber: 69, total: 100 });
    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "authorized", number: 69, recovered: true, needsCreditNote: true });
    expect(store.records.get("f1")!.status).toBe("AUTHORIZED");
    expect(arca.requests).toHaveLength(0);
  });

  it("si no se puede preguntar a ARCA, NO se descarta: podría estar autorizada", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f1", saleVoided: true, attemptedNumber: 1 });
    arca.findVoucher = async () => {
      throw new ArcaError("No se pudo comunicar con ARCA.", "unreachable");
    };
    const result = await authorizeInvoice(deps, "f1");
    expect(result).toMatchObject({ status: "pending", failure: "unreachable" });
    expect(store.records.get("f1")!.status).toBe("PENDING");
  });

  it("datos que no sirven (total en cero): queda pendiente con el motivo exacto, sin lanzar ni llamar a ARCA", async () => {
    const { arca, store, deps } = setup();
    store.add({ id: "f0", total: 0 });
    const result = await authorizeInvoice(deps, "f0");
    expect(result).toMatchObject({ status: "pending", failure: "invalid" });
    expect((result as { reason: string }).reason).toMatch(/mayor a cero/);
    expect(arca.requests).toHaveLength(0);
    expect(store.reasons.get("f0")).toMatch(/mayor a cero/);
  });

  it("una nota de crédito de una venta anulada se emite normalmente", async () => {
    const { arca, store, deps } = setup();
    arca.seed(11, 70);
    store.add({
      id: "nc1",
      kind: "NOTA_CREDITO_C",
      saleVoided: true,
      relatedInvoice: { status: "AUTHORIZED", number: 70, pointOfSale: PV, issueDate: new Date("2026-11-11T00:00:00Z") },
    });
    expect(await authorizeInvoice(deps, "nc1")).toMatchObject({ status: "authorized", number: 1 });
  });
});

describe("voucherMatches", () => {
  const invoice: InvoiceRecord = {
    id: "f1",
    kind: "FACTURA_C",
    status: "PENDING",
    environment: "HOMOLOGACION",
    pointOfSale: PV,
    number: null,
    attemptedNumber: 5,
    total: 1500,
    receiverDocType: "DNI",
    receiverDocNumber: "12.345.678",
    receiverIvaCondition: 5,
    saleVoided: false,
    relatedInvoice: null,
  };
  const existing: ExistingVoucher = { number: 5, issueDate: "20261111", total: 1500, docType: 96, docNumber: 12345678, cae: "86451067775494", caeExpiresAt: "20261121", authorized: true };

  it("coincide con total, tipo y número de documento", () => {
    expect(voucherMatches(invoice, existing)).toBe(true);
  });

  it("no coincide si cambia alguno, o si no está autorizado", () => {
    expect(voucherMatches(invoice, { ...existing, total: 1500.5 })).toBe(false);
    expect(voucherMatches(invoice, { ...existing, docNumber: 1 })).toBe(false);
    expect(voucherMatches(invoice, { ...existing, docType: 99 })).toBe(false);
    expect(voucherMatches(invoice, { ...existing, authorized: false })).toBe(false);
    expect(voucherMatches(invoice, { ...existing, cae: "" })).toBe(false);
  });

  it("Consumidor Final: documento 99 y número 0", () => {
    const cf = { ...invoice, receiverDocType: "NONE" as const, receiverDocNumber: null };
    expect(voucherMatches(cf, { ...existing, docType: 99, docNumber: 0 })).toBe(true);
    expect(voucherMatches(cf, existing)).toBe(false);
  });
});
