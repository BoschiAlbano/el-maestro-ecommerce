import { describe, expect, it } from "vitest";
import { MlReconnectRequiredError, MlTokenRequestError, MlUnavailableError } from "./errors";
import {
  RECONNECT_REASON,
  getValidAccessToken,
  type StoredConnection,
  type TokenManagerDeps,
} from "./token-manager";

const NOW = new Date("2026-11-11T15:00:00.000Z");
const HOUR = 60 * 60 * 1000;

// "Cifrado" de mentira, reversible y visible: alcanza para ver qué se guardó.
const enc = (plain: string) => `enc(${plain})`;
const dec = (stored: string) => stored.slice(4, -1);

type Refresh = TokenManagerDeps["refresh"];

/** Base en memoria con un bloqueo real de a uno, como `SELECT … FOR UPDATE`. */
function fakeDeps(initial: Partial<StoredConnection> | null, refresh: Refresh) {
  const state = {
    row:
      initial === null
        ? null
        : ({
            status: "CONNECTED",
            accessTokenEnc: enc("acceso-1"),
            refreshTokenEnc: enc("renovacion-1"),
            accessTokenExpiresAt: new Date(NOW.getTime() + 6 * HOUR),
            ...initial,
          } as StoredConnection),
    statusReason: null as string | null,
    refreshCalls: [] as string[],
    reconnectNotices: 0,
  };

  let queue: Promise<unknown> = Promise.resolve();

  const deps: TokenManagerDeps = {
    now: () => NOW,
    encrypt: enc,
    decrypt: dec,
    read: async () => (state.row ? { ...state.row } : null),
    withLock: (fn) => {
      const run = queue.then(() =>
        fn({
          row: state.row ? { ...state.row } : null,
          saveRenewed: async (data) => {
            state.row = { ...state.row!, ...data };
          },
          markNeedsReconnect: async (reason) => {
            state.row = { ...state.row!, status: "NEEDS_RECONNECT" };
            state.statusReason = reason;
          },
        }),
      );
      queue = run.catch(() => undefined);
      return run;
    },
    refresh: async (refreshToken) => {
      state.refreshCalls.push(refreshToken);
      return refresh(refreshToken);
    },
    onReconnectRequired: async () => {
      state.reconnectNotices += 1;
    },
  };

  return { deps, state };
}

const renewOk: Refresh = async () => ({ accessToken: "acceso-2", refreshToken: "renovacion-2", expiresIn: 21600 });
const expired = { accessTokenExpiresAt: new Date(NOW.getTime() - 1000) };
const aboutToExpire = { accessTokenExpiresAt: new Date(NOW.getTime() + 60 * 1000) };

describe("getValidAccessToken", () => {
  it("devuelve la autorización guardada si no está por vencer, sin renovar", async () => {
    const { deps, state } = fakeDeps({}, renewOk);
    expect(await getValidAccessToken(deps)).toBe("acceso-1");
    expect(state.refreshCalls).toEqual([]);
  });

  it("renueva si está vencida y guarda la autorización y la credencial nuevas", async () => {
    const { deps, state } = fakeDeps(expired, renewOk);
    expect(await getValidAccessToken(deps)).toBe("acceso-2");
    expect(state.refreshCalls).toEqual(["renovacion-1"]);
    expect(state.row).toMatchObject({
      status: "CONNECTED",
      accessTokenEnc: enc("acceso-2"),
      refreshTokenEnc: enc("renovacion-2"),
      accessTokenExpiresAt: new Date(NOW.getTime() + 6 * HOUR),
    });
  });

  it("renueva también cuando faltan menos de 5 minutos", async () => {
    const { deps, state } = fakeDeps(aboutToExpire, renewOk);
    expect(await getValidAccessToken(deps)).toBe("acceso-2");
    expect(state.refreshCalls).toHaveLength(1);
  });

  it("si la renovación no trae credencial nueva, conserva la anterior", async () => {
    const { deps, state } = fakeDeps(expired, async () => ({ accessToken: "acceso-2", expiresIn: 21600 }));
    await getValidAccessToken(deps);
    expect(state.row?.refreshTokenEnc).toBe(enc("renovacion-1"));
  });

  it("dos pedidos a la vez renuevan una sola vez", async () => {
    const { deps, state } = fakeDeps(expired, renewOk);
    const [a, b, c] = await Promise.all([
      getValidAccessToken(deps),
      getValidAccessToken(deps),
      getValidAccessToken(deps),
    ]);
    expect([a, b, c]).toEqual(["acceso-2", "acceso-2", "acceso-2"]);
    expect(state.refreshCalls).toEqual(["renovacion-1"]);
  });

  it("sin cuenta conectada pide reconexión, sin llamar a Mercado Libre ni avisar", async () => {
    const { deps, state } = fakeDeps(null, renewOk);
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(MlReconnectRequiredError);
    expect(state.refreshCalls).toEqual([]);
    expect(state.reconnectNotices).toBe(0);
  });

  it("si ya estaba marcada para reconectar, no reintenta ni vuelve a avisar", async () => {
    const { deps, state } = fakeDeps({ status: "NEEDS_RECONNECT", ...expired }, renewOk);
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(MlReconnectRequiredError);
    expect(state.refreshCalls).toEqual([]);
    expect(state.reconnectNotices).toBe(0);
  });

  it("permiso revocado: marca que requiere reconexión, avisa una vez y lanza", async () => {
    const { deps, state } = fakeDeps(expired, async () => {
      throw new MlTokenRequestError(400, { error: "invalid_grant" });
    });
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(MlReconnectRequiredError);
    expect(state.row?.status).toBe("NEEDS_RECONNECT");
    expect(state.statusReason).toBe(RECONNECT_REASON);
    expect(state.reconnectNotices).toBe(1);
    // La autorización guardada no se pisa.
    expect(state.row?.accessTokenEnc).toBe(enc("acceso-1"));
  });

  it("dos pedidos a la vez con el permiso revocado avisan una sola vez", async () => {
    const { deps, state } = fakeDeps(expired, async () => {
      throw new MlTokenRequestError(400, { error: "invalid_grant" });
    });
    const results = await Promise.allSettled([getValidAccessToken(deps), getValidAccessToken(deps)]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(state.refreshCalls).toHaveLength(1);
    expect(state.reconnectNotices).toBe(1);
  });

  it("falla pasajera con la autorización vencida: no toca el estado y lanza 'no responde'", async () => {
    const { deps, state } = fakeDeps(expired, async () => {
      throw new MlTokenRequestError(503, "Service Unavailable");
    });
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(MlUnavailableError);
    expect(state.row?.status).toBe("CONNECTED");
    expect(state.reconnectNotices).toBe(0);
  });

  it("falla de red con la autorización vencida: igual, no pide reconexión", async () => {
    const { deps, state } = fakeDeps(expired, async () => {
      throw new MlTokenRequestError(null, undefined);
    });
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(MlUnavailableError);
    expect(state.row?.status).toBe("CONNECTED");
  });

  it("falla pasajera con la autorización todavía vigente: usa la que hay", async () => {
    const { deps, state } = fakeDeps(aboutToExpire, async () => {
      throw new MlTokenRequestError(429, { error: "too_many_requests" });
    });
    expect(await getValidAccessToken(deps)).toBe("acceso-1");
    expect(state.row?.status).toBe("CONNECTED");
  });

  it("un error inesperado no se disfraza: se propaga", async () => {
    const { deps } = fakeDeps(expired, async () => {
      throw new TypeError("algo roto");
    });
    await expect(getValidAccessToken(deps)).rejects.toBeInstanceOf(TypeError);
  });

  describe("autorización rechazada por Mercado Libre", () => {
    it("fuerza la renovación aunque no esté vencida", async () => {
      const { deps, state } = fakeDeps({}, renewOk);
      expect(await getValidAccessToken(deps, { rejectedToken: "acceso-1" })).toBe("acceso-2");
      expect(state.refreshCalls).toEqual(["renovacion-1"]);
    });

    it("si otro ya la renovó, usa la nueva sin renovar de nuevo", async () => {
      const { deps, state } = fakeDeps({ accessTokenEnc: enc("acceso-9") }, renewOk);
      expect(await getValidAccessToken(deps, { rejectedToken: "acceso-1" })).toBe("acceso-9");
      expect(state.refreshCalls).toEqual([]);
    });

    it("permiso revocado antes del vencimiento: pasa a requerir reconexión", async () => {
      const { deps, state } = fakeDeps({}, async () => {
        throw new MlTokenRequestError(400, { error: "invalid_grant" });
      });
      await expect(getValidAccessToken(deps, { rejectedToken: "acceso-1" })).rejects.toBeInstanceOf(
        MlReconnectRequiredError,
      );
      expect(state.row?.status).toBe("NEEDS_RECONNECT");
      expect(state.reconnectNotices).toBe(1);
    });

    it("falla pasajera: no devuelve la autorización que ya fue rechazada", async () => {
      const { deps } = fakeDeps({}, async () => {
        throw new MlTokenRequestError(500, null);
      });
      await expect(getValidAccessToken(deps, { rejectedToken: "acceso-1" })).rejects.toBeInstanceOf(
        MlUnavailableError,
      );
    });
  });
});
