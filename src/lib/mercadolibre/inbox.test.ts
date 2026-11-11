import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  buildDedupeKey,
  decideProcessing,
  isOurApplication,
  isRetryable,
  outcomeAfterError,
  parseMissedFeeds,
  parseNotification,
} from "./inbox";

const REAL_SHAPE = {
  _id: "abc-123",
  topic: "items",
  resource: "/items/MLA1234567890",
  user_id: 1512312240,
  application_id: 1234567890123456,
  sent: "2026-11-11T20:00:00.000Z",
  attempts: 1,
  received: "2026-11-11T19:59:59.900Z",
};

describe("parseNotification", () => {
  it("lee un aviso completo", () => {
    expect(parseNotification(REAL_SHAPE)).toEqual({
      externalId: "abc-123",
      topic: "items",
      resource: "/items/MLA1234567890",
      mlUserId: "1512312240",
      applicationId: "1234567890123456",
      sentAt: new Date("2026-11-11T20:00:00.000Z"),
    });
  });

  it("acepta un aviso sin identificador, sin aplicación y sin fecha", () => {
    expect(parseNotification({ topic: "orders_v2", resource: "/orders/1", user_id: "55" })).toEqual({
      externalId: undefined,
      topic: "orders_v2",
      resource: "/orders/1",
      mlUserId: "55",
      applicationId: undefined,
      sentAt: undefined,
    });
  });

  it("ignora una fecha inválida en vez de fallar", () => {
    expect(parseNotification({ ...REAL_SHAPE, sent: "no-es-fecha" })?.sentAt).toBeUndefined();
  });

  it("devuelve null si no tiene forma de aviso", () => {
    expect(parseNotification(null)).toBeNull();
    expect(parseNotification("texto")).toBeNull();
    expect(parseNotification({})).toBeNull();
    expect(parseNotification({ topic: "items" })).toBeNull();
    expect(parseNotification({ topic: "", resource: "/x", user_id: 1 })).toBeNull();
    expect(parseNotification({ topic: "items", resource: "/x" })).toBeNull();
  });
});

describe("parseMissedFeeds", () => {
  it("sin avisos perdidos (respuesta real de la prueba técnica)", () => {
    expect(parseMissedFeeds({ messages: null })).toEqual([]);
    expect(parseMissedFeeds({ messages: [] })).toEqual([]);
  });

  it("aviso en la propia entrada", () => {
    expect(parseMissedFeeds({ messages: [REAL_SHAPE] })).toHaveLength(1);
  });

  it("aviso dentro de request.data, como objeto o como texto", () => {
    const entry = { resource: "/x", user_id: 1, topic: "items", http_code: 500, request: { data: REAL_SHAPE } };
    expect(parseMissedFeeds({ messages: [entry] })[0]?.topic).toBe("items");

    const asText = { http_code: 500, request: { body: JSON.stringify(REAL_SHAPE) } };
    expect(parseMissedFeeds({ messages: [asText] })[0]?.externalId).toBe("abc-123");
  });

  it("lo que no se entiende se ignora sin romper la pasada", () => {
    expect(parseMissedFeeds(null)).toEqual([]);
    expect(parseMissedFeeds({ messages: "raro" })).toEqual([]);
    expect(parseMissedFeeds({ messages: [null, 3, "x", {}, REAL_SHAPE] })).toHaveLength(1);
  });
});

describe("buildDedupeKey", () => {
  const base = parseNotification({ ...REAL_SHAPE, _id: undefined })!;

  it("usa el identificador del aviso si viene", () => {
    expect(buildDedupeKey(parseNotification(REAL_SHAPE)!)).toBe("id:abc-123");
  });

  it("sin identificador, el mismo aviso da la misma clave", () => {
    expect(buildDedupeKey(base)).toBe(buildDedupeKey({ ...base }));
    expect(buildDedupeKey(base)).toMatch(/^h:[0-9a-f]{64}$/);
  });

  it("sin identificador, un aviso distinto da otra clave", () => {
    const other = (patch: object) => buildDedupeKey({ ...base, ...patch });
    expect(other({ resource: "/items/OTRO" })).not.toBe(buildDedupeKey(base));
    expect(other({ topic: "orders_v2" })).not.toBe(buildDedupeKey(base));
    expect(other({ mlUserId: "999" })).not.toBe(buildDedupeKey(base));
  });

  it("dos cambios del mismo recurso en momentos distintos no se pisan", () => {
    const later = { ...base, sentAt: new Date("2026-11-11T20:05:00.000Z") };
    expect(buildDedupeKey(later)).not.toBe(buildDedupeKey(base));
  });
});

describe("isOurApplication", () => {
  const n = parseNotification(REAL_SHAPE)!;

  it("acepta la propia aplicación", () => {
    expect(isOurApplication(n, "1234567890123456")).toBe(true);
  });

  it("rechaza otra aplicación", () => {
    expect(isOurApplication(n, "999")).toBe(false);
  });

  it("sin identificador de aplicación pasa; la cuenta se controla al procesar", () => {
    expect(isOurApplication({ ...n, applicationId: undefined }, "999")).toBe(true);
  });
});

describe("decideProcessing", () => {
  const connected = { mlUserId: "55", status: "CONNECTED" as const };

  it("sin cuenta conectada: descarta", () => {
    expect(decideProcessing({ connection: null, notificationMlUserId: "55", hasHandler: true })).toBe("discard");
  });

  it("de otra cuenta: descarta", () => {
    expect(decideProcessing({ connection: connected, notificationMlUserId: "77", hasHandler: true })).toBe("discard");
  });

  it("tema sin función: sin acción", () => {
    expect(decideProcessing({ connection: connected, notificationMlUserId: "55", hasHandler: false })).toBe(
      "no_action",
    );
  });

  it("de la cuenta conectada y con función: la ejecuta", () => {
    expect(decideProcessing({ connection: connected, notificationMlUserId: "55", hasHandler: true })).toBe("run");
  });

  it("con la conexión pidiendo reconexión también se ejecuta; la función se encarga de fallar", () => {
    const needs = { mlUserId: "55", status: "NEEDS_RECONNECT" as const };
    expect(decideProcessing({ connection: needs, notificationMlUserId: "55", hasHandler: true })).toBe("run");
  });
});

describe("outcomeAfterError", () => {
  it("falla pasajera: queda pendiente y no suma intento", () => {
    expect(outcomeAfterError("transient", 4)).toEqual({ status: "PENDING", countAttempt: false });
  });

  it("otro error: suma un intento y queda pendiente hasta agotarlos", () => {
    expect(outcomeAfterError("other", 0)).toEqual({ status: "PENDING", countAttempt: true });
    expect(outcomeAfterError("other", MAX_ATTEMPTS - 2)).toEqual({ status: "PENDING", countAttempt: true });
  });

  it("al agotar los intentos, queda fallido", () => {
    expect(outcomeAfterError("other", MAX_ATTEMPTS - 1)).toEqual({ status: "FAILED", countAttempt: true });
  });
});

describe("isRetryable", () => {
  it("toma los pendientes y los fallidos con intentos disponibles", () => {
    expect(isRetryable("PENDING", 0)).toBe(true);
    expect(isRetryable("FAILED", MAX_ATTEMPTS - 1)).toBe(true);
  });

  it("no toma los fallidos agotados ni los ya resueltos", () => {
    expect(isRetryable("FAILED", MAX_ATTEMPTS)).toBe(false);
    expect(isRetryable("PROCESSED", 0)).toBe(false);
    expect(isRetryable("NO_ACTION", 0)).toBe(false);
    expect(isRetryable("DISCARDED", 0)).toBe(false);
  });
});
