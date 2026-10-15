// Lógica pura, sin I/O — se puede importar desde componentes cliente (como
// la navegación, para decidir qué ítems mostrar) sin arrastrar nada de
// Prisma/Supabase. Por eso el enum se importa como tipo y desde "enums"
// (ver nota equivalente en components/permission-matrix.tsx).
//
// `getCurrentUser()` (la única parte que toca sesión + base) vive aparte,
// en src/lib/current-user.ts — importarlo acá rompería esa separación.
import type { ModuloNegocio } from "@/generated/prisma/enums";

/**
 * Verificación de permisos (specs/002). Constitución, regla 14: esto se
 * llama siempre del lado del servidor, al principio de cada Server
 * Action/Route Handler. La interfaz solo oculta.
 */

export type Accion = "ver" | "crear" | "editar" | "anular" | "exportar";

export type PermisoEspecial =
  | "verCostosMargenes"
  | "anularVentas"
  | "ajustarStock"
  | "reimprimirTickets"
  | "cerrarCaja"
  | "cambiarPrecios";

type RolePermissionLike = { module: ModuloNegocio } & Record<Accion, boolean>;

export type RoleLike = { isOwnerRole: boolean; permissions: RolePermissionLike[] } & Record<
  PermisoEspecial,
  boolean
>;

export type UserLike = { active: boolean; role: RoleLike };

export class PermissionError extends Error {
  constructor(message = "No tenés permiso para hacer esto.") {
    super(message);
    this.name = "PermissionError";
  }
}

export function isOwner(user: UserLike): boolean {
  return user.active && user.role.isOwnerRole;
}

export function hasPermission(user: UserLike, module: ModuloNegocio, action: Accion): boolean {
  if (!user.active) return false;
  if (user.role.isOwnerRole) return true;
  const row = user.role.permissions.find((p) => p.module === module);
  return row?.[action] ?? false;
}

export function hasSpecialPermission(user: UserLike, permiso: PermisoEspecial): boolean {
  if (!user.active) return false;
  if (user.role.isOwnerRole) return true;
  return user.role[permiso];
}

/** Tira `PermissionError` si no es Dueño (ver specs/002, sección 6). */
export function requireOwner(user: UserLike | null): asserts user is UserLike {
  if (!user || !isOwner(user)) {
    throw new PermissionError("Necesitás ser Dueño para hacer esto.");
  }
}

export function requirePermission(
  user: UserLike | null,
  module: ModuloNegocio,
  action: Accion,
): asserts user is UserLike {
  if (!user || !hasPermission(user, module, action)) {
    throw new PermissionError("No tenés permiso para hacer esto.");
  }
}

export function requireSpecialPermission(
  user: UserLike | null,
  permiso: PermisoEspecial,
): asserts user is UserLike {
  if (!user || !hasSpecialPermission(user, permiso)) {
    throw new PermissionError("No tenés el permiso necesario para esta acción.");
  }
}
