/**
 * Efectivo esperado de un turno (specs/007, sección 1 y 4): el monto
 * inicial más los ingresos en efectivo, menos los egresos en efectivo. La
 * transferencia no cambia cuánto papel moneda debería haber en la caja.
 */

export type CashMovementForExpected = {
  type: "INGRESO" | "EGRESO";
  amount: number;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA";
};

export function computeExpectedCash(
  openingAmount: number,
  movements: CashMovementForExpected[],
): number {
  return movements.reduce((total, movement) => {
    if (movement.paymentMethod !== "EFECTIVO") return total;
    return movement.type === "INGRESO" ? total + movement.amount : total - movement.amount;
  }, openingAmount);
}
