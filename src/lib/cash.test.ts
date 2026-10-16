import { describe, expect, it, vi } from "vitest";
import { registerCashMovement } from "./cash";

function makeTx() {
  return { cashMovement: { create: vi.fn().mockResolvedValue({ id: "mov-1" }) } };
}

describe("registerCashMovement", () => {
  it("crea el movimiento con los datos recibidos", async () => {
    const tx = makeTx();
    await registerCashMovement(tx, {
      shiftId: "s1",
      type: "INGRESO",
      amount: 500,
      concept: "Venta de prueba",
      paymentMethod: "EFECTIVO",
      userId: "u1",
    });

    expect(tx.cashMovement.create).toHaveBeenCalledWith({
      data: {
        shiftId: "s1",
        type: "INGRESO",
        amount: 500,
        concept: "Venta de prueba",
        paymentMethod: "EFECTIVO",
        transferReference: undefined,
        userId: "u1",
      },
    });
  });

  it("guarda la referencia de transferencia cuando se la pasan", async () => {
    const tx = makeTx();
    await registerCashMovement(tx, {
      shiftId: "s1",
      type: "EGRESO",
      amount: 1000,
      concept: "Devolución de seña",
      paymentMethod: "TRANSFERENCIA",
      transferReference: "4321",
      userId: "u1",
    });

    expect(tx.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transferReference: "4321" }) }),
    );
  });
});
