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

export type PaymentBreakdown = { ingresos: number; egresos: number; neto: number };

export type ShiftSummary = {
  expectedCash: number;
  ingresos: number;
  egresos: number;
  efectivo: PaymentBreakdown;
  transferencia: PaymentBreakdown;
};

/**
 * Resumen de un turno para la pantalla de caja (specs/007, RF-10): el efectivo
 * esperado (misma cuenta que `computeExpectedCash`) y los ingresos, egresos y
 * neto, en total y por medio de pago.
 */
export function summarizeShift(openingAmount: number, movements: CashMovementForExpected[]): ShiftSummary {
  const efectivo: PaymentBreakdown = { ingresos: 0, egresos: 0, neto: 0 };
  const transferencia: PaymentBreakdown = { ingresos: 0, egresos: 0, neto: 0 };

  for (const movement of movements) {
    const target = movement.paymentMethod === "EFECTIVO" ? efectivo : transferencia;
    if (movement.type === "INGRESO") target.ingresos += movement.amount;
    else target.egresos += movement.amount;
  }
  efectivo.neto = efectivo.ingresos - efectivo.egresos;
  transferencia.neto = transferencia.ingresos - transferencia.egresos;

  return {
    expectedCash: computeExpectedCash(openingAmount, movements),
    ingresos: efectivo.ingresos + transferencia.ingresos,
    egresos: efectivo.egresos + transferencia.egresos,
    efectivo,
    transferencia,
  };
}
