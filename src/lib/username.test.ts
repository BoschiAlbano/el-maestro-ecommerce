import { describe, expect, it } from "vitest";
import { normalizeUsername, suggestUsernames, usernameKey, validateUsername } from "./username";

describe("normalizeUsername", () => {
  it("recorta y reduce los espacios repetidos", () => {
    expect(normalizeUsername("  El    Maestro  ")).toBe("El Maestro");
  });
});

describe("usernameKey", () => {
  it("no distingue mayúsculas ni espacios de más", () => {
    expect(usernameKey("El Maestro")).toBe("el maestro");
    expect(usernameKey("  EL   MAESTRO ")).toBe(usernameKey("el maestro"));
  });
});

describe("validateUsername", () => {
  it("acepta letras con tildes y ñ, números, espacios, punto, guion y guion bajo", () => {
    expect(validateUsername("El Maestro")).toBeNull();
    expect(validateUsername("Ñandú_2.0-b")).toBeNull();
  });

  it("rechaza menos de 3 y más de 40 caracteres, contando ya normalizado", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("   a   ")).not.toBeNull();
    expect(validateUsername("  a  b  ")).toBeNull();
    expect(validateUsername("a".repeat(40))).toBeNull();
    expect(validateUsername("a".repeat(41))).not.toBeNull();
  });

  it("rechaza símbolos no permitidos y emojis", () => {
    expect(validateUsername("juan/perez")).not.toBeNull();
    expect(validateUsername("juan😀")).not.toBeNull();
  });

  it("rechaza algo con formato de email con un mensaje específico", () => {
    expect(validateUsername("juan@gmail.com")).toMatch(/email/i);
  });
});

describe("suggestUsernames", () => {
  it("usa el nombre de la cuenta", () => {
    expect(suggestUsernames([{ id: "1", name: "El Maestro" }])).toEqual([{ id: "1", username: "El Maestro" }]);
  });

  it("numera los repetidos sin distinguir mayúsculas", () => {
    const result = suggestUsernames([
      { id: "1", name: "Juan" },
      { id: "2", name: "juan" },
      { id: "3", name: "JUAN" },
    ]);
    expect(result.map((r) => r.username)).toEqual(["Juan", "juan 2", "JUAN 3"]);
  });

  it("no choca con usuarios que ya existen, incluso con un sufijo ya tomado", () => {
    const result = suggestUsernames([{ id: "1", name: "Juan" }], ["juan", "juan 2"]);
    expect(result[0].username).toBe("Juan 3");
  });

  it("limpia caracteres no permitidos del nombre", () => {
    expect(suggestUsernames([{ id: "1", name: "Ana @ López/!" }])[0].username).toBe("Ana López");
  });

  it("completa con 'usuario' si el nombre queda demasiado corto", () => {
    const result = suggestUsernames([
      { id: "1", name: "@@" },
      { id: "2", name: "ab" },
    ]);
    expect(result.map((r) => r.username)).toEqual(["usuario", "usuario 2"]);
  });

  it("no pasa de 40 caracteres ni con el sufijo", () => {
    const long = "a".repeat(60);
    const result = suggestUsernames([
      { id: "1", name: long },
      { id: "2", name: long },
    ]);
    expect(result[0].username).toHaveLength(40);
    expect(result[1].username).toHaveLength(40);
    expect(result[1].username.endsWith(" 2")).toBe(true);
    expect(usernameKey(result[0].username)).not.toBe(usernameKey(result[1].username));
  });

  it("todo lo que genera pasa la validación", () => {
    for (const { username } of suggestUsernames([
      { id: "1", name: "x" },
      { id: "2", name: "María-José O'Brien" },
      { id: "3", name: "😀😀😀" },
    ])) {
      expect(validateUsername(username)).toBeNull();
    }
  });
});
