// Usuario «Sistema» de las ventas de Mercado Libre (specs/022, RF-7). Lo crea
// la migración `20261120000000_add_ml_orders` con estos identificadores fijos:
// es inactivo y no puede iniciar sesión. Puro.

export const SYSTEM_ROLE_ID = "00000000-0000-4000-8000-000000000001";
export const SYSTEM_USER_ID = "00000000-0000-4000-8000-000000000002";

/** Para excluirlo de las listas de usuarios, roles y empleados. */
export function isSystemUser(userId: string): boolean {
  return userId === SYSTEM_USER_ID;
}
