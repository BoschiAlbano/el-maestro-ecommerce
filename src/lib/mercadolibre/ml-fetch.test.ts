import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MlApiError, MlRateLimitError, MlReconnectRequiredError, MlUnavailableError } from "./errors";
import type { MlHttpResponse } from "./http";
import { createMlFetch } from "./ml-fetch";

const schema = z.object({ id: z.number(), nickname: z.string() });
const OK: MlHttpResponse = { status: 200, body: { id: 1, nickname: "TESTUSER" } };
const UNAUTHORIZED: MlHttpResponse = { status: 401, body: { code: "unauthorized", message: "invalid access token" } };

function setup(responses: MlHttpResponse[], tokens: (string | Error)[] = ["acceso-1", "acceso-2"]) {
  const calls: { path: string; token?: string; method: string }[] = [];
  const tokenRequests: (string | undefined)[] = [];
  const mlFetch = createMlFetch({
    getToken: async (options) => {
      tokenRequests.push(options?.rejectedToken);
      const next = tokens.shift();
      if (next instanceof Error) throw next;
      return next ?? "sin-mas-tokens";
    },
    http: async (method, path, options) => {
      calls.push({ method, path, token: options?.token });
      return responses.shift() ?? { status: 599, body: null };
    },
  });
  return { mlFetch, calls, tokenRequests };
}

describe("mlFetch", () => {
  it("manda la autorización y devuelve la respuesta validada", async () => {
    const { mlFetch, calls } = setup([OK]);
    expect(await mlFetch("/users/me", { schema })).toEqual({ id: 1, nickname: "TESTUSER" });
    expect(calls).toEqual([{ method: "GET", path: "/users/me", token: "acceso-1" }]);
  });

  it("si Mercado Libre rechaza la autorización, fuerza la renovación y reintenta una vez", async () => {
    const { mlFetch, calls, tokenRequests } = setup([UNAUTHORIZED, OK]);
    expect(await mlFetch("/users/me", { schema })).toEqual({ id: 1, nickname: "TESTUSER" });
    expect(tokenRequests).toEqual([undefined, "acceso-1"]);
    expect(calls.map((c) => c.token)).toEqual(["acceso-1", "acceso-2"]);
  });

  it("si la renovación forzada pide reconexión, lo propaga sin reintentar", async () => {
    const { mlFetch, calls } = setup([UNAUTHORIZED], ["acceso-1", new MlReconnectRequiredError()]);
    await expect(mlFetch("/users/me", { schema })).rejects.toBeInstanceOf(MlReconnectRequiredError);
    expect(calls).toHaveLength(1);
  });

  it("si vuelve a rechazarla después de renovar, no entra en un ciclo", async () => {
    const { mlFetch, calls } = setup([UNAUTHORIZED, UNAUTHORIZED]);
    await expect(mlFetch("/users/me", { schema })).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(2);
  });

  it("límite de consultas", async () => {
    const { mlFetch } = setup([{ status: 429, body: null }]);
    await expect(mlFetch("/users/me", { schema })).rejects.toBeInstanceOf(MlRateLimitError);
  });

  it("error del lado de Mercado Libre", async () => {
    const { mlFetch } = setup([{ status: 503, body: "Service Unavailable" }]);
    await expect(mlFetch("/users/me", { schema })).rejects.toBeInstanceOf(MlUnavailableError);
  });

  it("pedido rechazado: error con el código y lo que respondió", async () => {
    const { mlFetch } = setup([{ status: 404, body: { error: "not_found" } }]);
    await expect(mlFetch("/items/MLA1", { schema })).rejects.toMatchObject({
      name: "MlApiError",
      status: 404,
      body: { error: "not_found" },
    });
  });

  it("respuesta con otra forma: no se usa", async () => {
    const { mlFetch } = setup([{ status: 200, body: { id: "no-es-numero" } }]);
    await expect(mlFetch("/users/me", { schema })).rejects.toBeInstanceOf(MlApiError);
  });

  it("pasa el método y el cuerpo", async () => {
    const { mlFetch, calls } = setup([OK]);
    await mlFetch("/items/MLA1", { method: "PUT", json: { status: "paused" }, schema });
    expect(calls[0]).toMatchObject({ method: "PUT", path: "/items/MLA1" });
  });
});
