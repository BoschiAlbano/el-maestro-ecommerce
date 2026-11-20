import { randomBytes } from "node:crypto";
import { AccessTicket } from "@arcasdk/core";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { ensureTicket } from "./ensure-ticket";
import { ArcaError } from "./gateway";
import { EncryptedTicketStorage, TicketStorageError, type TicketRepo, type TicketRow } from "./ticket-storage";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");
const CUIT = "20111111112";
const NOW = new Date("2026-11-11T15:00:00.000Z");
const SECRET_TOKEN = "TOKEN-DE-PRUEBA-que-no-debe-aparecer-en-la-base";
const SECRET_SIGN = "FIRMA-DE-PRUEBA-que-no-debe-aparecer-en-la-base";

/** Con la forma real del permiso de ARCA (prueba técnica 2026-11-11), con valores inventados. */
function fakeTicket(expiration = "2026-11-12T07:12:42.864-03:00") {
  return AccessTicket.create({
    header: [
      { version: "1.0" },
      {
        source: "CN=wsaahomo, O=AFIP, C=AR, SERIALNUMBER=CUIT 33693450239",
        destination: `SERIALNUMBER=CUIT ${CUIT}, CN=elmaestro`,
        uniqueid: "1",
        generationtime: "2026-11-11T19:12:42.864-03:00",
        expirationtime: expiration,
      },
    ],
    credentials: { token: SECRET_TOKEN, sign: SECRET_SIGN },
  } as never);
}

class MemoryRepo implements TicketRepo {
  rows = new Map<string, TicketRow>();
  private key = (environment: string, service: string) => `${environment}/${service}`;
  async get(environment: "HOMOLOGACION" | "PRODUCCION", service: string) {
    return this.rows.get(this.key(environment, service)) ?? null;
  }
  async upsert(environment: "HOMOLOGACION" | "PRODUCCION", service: string, row: TicketRow) {
    this.rows.set(this.key(environment, service), row);
  }
  async delete(environment: "HOMOLOGACION" | "PRODUCCION", service: string) {
    this.rows.delete(this.key(environment, service));
  }
}

function storage(repo: TicketRepo, overrides: { key?: string; cuit?: string; environment?: "HOMOLOGACION" | "PRODUCCION" } = {}) {
  const key = overrides.key ?? KEY;
  return new EncryptedTicketStorage(repo, {
    environment: overrides.environment ?? "HOMOLOGACION",
    cuit: overrides.cuit ?? CUIT,
    encrypt: (plain) => encryptSecret(plain, key),
    decrypt: (stored) => decryptSecret(stored, key),
    now: () => NOW,
  });
}

describe("EncryptedTicketStorage", () => {
  it("guarda y devuelve el permiso", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    const back = await storage(repo).get("wsfe");
    expect(back?.getToken()).toBe(SECRET_TOKEN);
    expect(back?.getSign()).toBe(SECRET_SIGN);
  });

  it("en la base no queda ni el token ni la firma en claro", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    const row = [...repo.rows.values()][0];
    expect(row.payloadEnc).not.toContain("TOKEN-DE-PRUEBA");
    expect(row.payloadEnc).not.toContain("FIRMA-DE-PRUEBA");
    expect(row.payloadEnc.startsWith("v1.")).toBe(true);
  });

  it("guarda el vencimiento del permiso y el CUIT del certificado", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    const row = [...repo.rows.values()][0];
    expect(row.expiresAt.toISOString()).toBe("2026-11-12T10:12:42.864Z");
    expect(row.cuit).toBe(CUIT);
  });

  it("sin permiso guardado devuelve null", async () => {
    expect(await storage(new MemoryRepo()).get("wsfe")).toBeNull();
    expect(await storage(new MemoryRepo()).hasValid("wsfe")).toBe(false);
  });

  it("un permiso vencido no sirve", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket("2026-11-11T11:00:00.000-03:00"), "wsfe"); // 14:00 UTC, antes de NOW
    expect(await storage(repo).get("wsfe")).toBeNull();
  });

  it("un permiso de otro CUIT no sirve", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    expect(await storage(repo, { cuit: "30500010912" }).get("wsfe")).toBeNull();
  });

  it("los dos ambientes no se pisan", async () => {
    const repo = new MemoryRepo();
    await storage(repo, { environment: "HOMOLOGACION" }).save(fakeTicket(), "wsfe");
    expect(await storage(repo, { environment: "PRODUCCION" }).get("wsfe")).toBeNull();
  });

  it("con otra clave de cifrado lanza, no devuelve null: pedir otro permiso chocaría con el vigente", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    await expect(storage(repo, { key: OTHER_KEY }).get("wsfe")).rejects.toBeInstanceOf(TicketStorageError);
    await expect(storage(repo, { key: OTHER_KEY }).get("wsfe")).rejects.toThrow(/clave de cifrado/);
  });

  it("el error de lectura no incluye el permiso", async () => {
    const repo = new MemoryRepo();
    await storage(repo).save(fakeTicket(), "wsfe");
    await expect(storage(repo, { key: OTHER_KEY }).get("wsfe")).rejects.not.toThrow(/TOKEN-DE-PRUEBA/);
  });

  it("borrar lo deja sin permiso", async () => {
    const repo = new MemoryRepo();
    const s = storage(repo);
    await s.save(fakeTicket(), "wsfe");
    await s.delete("wsfe");
    expect(await s.get("wsfe")).toBeNull();
  });

  it("volver a guardar reemplaza al anterior", async () => {
    const repo = new MemoryRepo();
    const s = storage(repo);
    await s.save(fakeTicket("2026-11-12T01:00:00.000-03:00"), "wsfe");
    await s.save(fakeTicket("2026-11-12T07:00:00.000-03:00"), "wsfe");
    expect(repo.rows.size).toBe(1);
    expect([...repo.rows.values()][0].expiresAt.toISOString()).toBe("2026-11-12T10:00:00.000Z");
  });
});

describe("ensureTicket", () => {
  /** Un bloqueo real de a uno, como `SELECT … FOR UPDATE`. */
  function serialLock() {
    let queue: Promise<unknown> = Promise.resolve();
    return <T>(fn: () => Promise<T>): Promise<T> => {
      const run = queue.then(fn);
      queue = run.catch(() => undefined);
      return run;
    };
  }

  function setup(options: { startsWithTicket?: boolean; acquireSavesTicket?: boolean; acquireError?: Error } = {}) {
    const state = { hasTicket: options.startsWithTicket ?? false, acquired: 0 };
    const deps = {
      hasValidTicket: async () => state.hasTicket,
      withLock: serialLock(),
      acquire: async () => {
        state.acquired += 1;
        // Tarda: da tiempo a que otro proceso llegue mientras se está pidiendo.
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (options.acquireError) throw options.acquireError;
        if (options.acquireSavesTicket ?? true) state.hasTicket = true;
      },
    };
    return { state, deps };
  }

  it("con un permiso guardado no pide nada", async () => {
    const { state, deps } = setup({ startsWithTicket: true });
    expect(await ensureTicket(deps)).toBe("existing");
    expect(state.acquired).toBe(0);
  });

  it("sin permiso lo pide", async () => {
    const { state, deps } = setup();
    expect(await ensureTicket(deps)).toBe("acquired");
    expect(state.acquired).toBe(1);
  });

  it("varios procesos a la vez piden el permiso una sola vez", async () => {
    const { state, deps } = setup();
    const results = await Promise.all([ensureTicket(deps), ensureTicket(deps), ensureTicket(deps), ensureTicket(deps)]);
    expect(state.acquired).toBe(1);
    expect(results.filter((r) => r === "acquired")).toHaveLength(1);
    expect(results.filter((r) => r === "existing")).toHaveLength(3);
  });

  it("si ARCA lo entrega pero no quedó guardado, lo dice: es un permiso perdido", async () => {
    const { deps } = setup({ acquireSavesTicket: false });
    await expect(ensureTicket(deps)).rejects.toMatchObject({ name: "ArcaError", failure: "storage" });
  });

  it("si ARCA no lo entrega, el error sube tal cual", async () => {
    const failure = new ArcaError("ARCA tiene un permiso vigente que el sistema no tiene guardado", "already_authenticated");
    const { deps } = setup({ acquireError: failure });
    await expect(ensureTicket(deps)).rejects.toBe(failure);
  });

  it("un fallo no deja trabado el bloqueo para el siguiente", async () => {
    const { state, deps } = setup({ acquireError: new Error("sin red") });
    await expect(ensureTicket(deps)).rejects.toThrow("sin red");
    const second = setup();
    expect(await ensureTicket(second.deps)).toBe("acquired");
    expect(state.acquired).toBe(1);
  });
});
