import { describe, expect, it } from "vitest";
import { ML_RESULTS, decideConnection, mlResultPath, parseMlResult } from "./connection-result";

describe("decideConnection", () => {
  it("sin cuenta conectada: crea", () => {
    expect(decideConnection(null, "111")).toBe("create");
  });

  it("la misma cuenta vuelve a autorizar: actualiza", () => {
    expect(decideConnection({ mlUserId: "111" }, "111")).toBe("update");
  });

  it("otra cuenta: no reemplaza", () => {
    expect(decideConnection({ mlUserId: "111" }, "222")).toBe("different_account");
  });
});

describe("parseMlResult", () => {
  it("reconoce los resultados conocidos", () => {
    expect(parseMlResult("conectada")).toBe("conectada");
    expect(parseMlResult("otra_cuenta")).toBe("otra_cuenta");
  });

  it("ignora valores desconocidos, vacíos o repetidos", () => {
    expect(parseMlResult(undefined)).toBeNull();
    expect(parseMlResult("")).toBeNull();
    expect(parseMlResult("<script>")).toBeNull();
    expect(parseMlResult("toString")).toBeNull();
    expect(parseMlResult(["conectada", "error"])).toBeNull();
  });
});

describe("resultados", () => {
  it("solo 'conectada' es un resultado bueno", () => {
    const good = Object.entries(ML_RESULTS)
      .filter(([, value]) => value.ok)
      .map(([key]) => key);
    expect(good).toEqual(["conectada"]);
  });

  it("la dirección de vuelta abre la pestaña de Mercado Libre con el resultado", () => {
    expect(mlResultPath("no_autorizado")).toBe("/configuracion?tab=mercadolibre&ml=no_autorizado");
  });
});
