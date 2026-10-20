// Nombre de usuario para ingresar al sistema (specs/016). Funciones puras: se
// usan tanto en el servidor (login, alta, edición) como en el script que le
// asigna un usuario a las cuentas que ya existían.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 40;

/** Letras (con tildes y ñ), números, espacios, punto, guion y guion bajo. */
const DISALLOWED_CHARS = /[^\p{L}\p{N} ._-]/gu;
const ALLOWED = /^[\p{L}\p{N} ._-]+$/u;

/** Recorta y reduce los espacios repetidos a uno. Es lo que se guarda para mostrar. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Forma sobre la que se busca y se garantiza la unicidad: sin distinguir mayúsculas. */
export function usernameKey(raw: string): string {
  return normalizeUsername(raw).toLowerCase();
}

/** Devuelve el mensaje de error, o `null` si el usuario es válido. */
export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (value.includes("@")) {
    return "El usuario no puede ser un email. Escribí un nombre, por ejemplo El Maestro.";
  }
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return `El usuario tiene que tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;
  }
  if (!ALLOWED.test(value)) {
    return "El usuario solo puede tener letras, números, espacios, punto, guion y guion bajo.";
  }
  return null;
}

/**
 * Usuarios automáticos para cuentas que todavía no tienen uno, a partir de su
 * nombre (specs/016, RF-9). `rows` va en orden de alta: la primera cuenta se
 * queda con el nombre limpio y las siguientes repetidas reciben " 2", " 3", …
 * `takenKeys` son las claves de los usuarios que ya existen, para no chocar.
 */
export function suggestUsernames(
  rows: { id: string; name: string }[],
  takenKeys: Iterable<string> = [],
): { id: string; username: string }[] {
  const taken = new Set(takenKeys);

  return rows.map(({ id, name }) => {
    let base = normalizeUsername(name.replace(DISALLOWED_CHARS, " ")).slice(0, USERNAME_MAX).trimEnd();
    if (base.length < USERNAME_MIN) base = "usuario";

    let username = base;
    for (let n = 2; taken.has(usernameKey(username)); n++) {
      const suffix = ` ${n}`;
      username = base.slice(0, USERNAME_MAX - suffix.length).trimEnd() + suffix;
    }
    taken.add(usernameKey(username));
    return { id, username };
  });
}
