import { describe, expect, it, vi } from "vitest";
import { registerStockMovement } from "./stock";

function makeTx() {
  return {
    stockMovement: { create: vi.fn().mockResolvedValue({ id: "mov-1" }) },
    product: { update: vi.fn().mockResolvedValue({}) },
  };
}

describe("registerStockMovement", () => {
  it("crea el movimiento con los datos recibidos", async () => {
    const tx = makeTx();
    await registerStockMovement(tx, {
      productId: "p1",
      type: "AJUSTE",
      quantity: 5,
      reason: "Conteo físico",
      userId: "u1",
    });

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: { productId: "p1", type: "AJUSTE", quantity: 5, reason: "Conteo físico", userId: "u1" },
    });
  });

  it("incrementa currentStock cuando la cantidad es positiva", async () => {
    const tx = makeTx();
    await registerStockMovement(tx, { productId: "p1", type: "INGRESO", quantity: 10, userId: "u1" });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { currentStock: { increment: 10 } },
    });
  });

  it("decrementa currentStock cuando la cantidad es negativa (increment con número negativo)", async () => {
    const tx = makeTx();
    await registerStockMovement(tx, { productId: "p1", type: "VENTA", quantity: -3, userId: "u1" });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { currentStock: { increment: -3 } },
    });
  });

  it("permite que la cantidad deje el stock en negativo: no valida ni bloquea nada antes de llamar a Prisma", async () => {
    const tx = makeTx();
    await expect(
      registerStockMovement(tx, { productId: "p1", type: "MERMA", quantity: -1000, userId: "u1" }),
    ).resolves.toBeDefined();
  });

  it("devuelve el movimiento creado", async () => {
    const tx = makeTx();
    const result = await registerStockMovement(tx, {
      productId: "p1",
      type: "AJUSTE",
      quantity: 1,
      userId: "u1",
    });
    expect(result).toEqual({ id: "mov-1" });
  });
});
