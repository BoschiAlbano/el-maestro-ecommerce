import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { InvoiceRecord, InvoiceStore } from "./invoice-service";

// Los comprobantes sobre la tabla `invoices` (specs/023). Cada operación es
// una escritura propia y confirmada: en particular `saveAttempt`, que tiene
// que sobrevivir a una caída aunque lo que viene después falle (plan 3.3).

export const prismaInvoiceStore: InvoiceStore = {
  async load(id) {
    const row = await prisma.invoice.findUnique({
      where: { id },
      include: {
        sale: { select: { voidedAt: true } },
        relatedInvoice: { select: { status: true, number: true, pointOfSale: true, issueDate: true } },
      },
    });
    if (!row) return null;
    const record: InvoiceRecord = {
      id: row.id,
      kind: row.kind,
      status: row.status,
      environment: row.environment,
      pointOfSale: row.pointOfSale,
      number: row.number,
      attemptedNumber: row.attemptedNumber,
      total: row.total.toNumber(),
      receiverDocType: row.receiverDocType,
      receiverDocNumber: row.receiverDocNumber,
      receiverIvaCondition: row.receiverIvaCondition,
      saleVoided: row.sale.voidedAt !== null,
      relatedInvoice: row.relatedInvoice,
    };
    return record;
  },

  async saveAttempt(id, attemptedNumber) {
    await prisma.invoice.update({ where: { id }, data: { attemptedNumber } });
  },

  async markAuthorized(id, data) {
    await prisma.invoice.update({
      where: { id },
      data: {
        status: "AUTHORIZED",
        number: data.number,
        cae: data.cae,
        caeExpiresAt: data.caeExpiresAt,
        issueDate: data.issueDate,
        emitterSnapshot: data.emitterSnapshot as Prisma.InputJsonValue,
        authorizedAt: data.authorizedAt,
        lastError: null,
      },
    });
  },

  async markPending(id, reason) {
    await prisma.invoice.update({ where: { id }, data: { lastError: reason, attempts: { increment: 1 } } });
  },

  async discard(id, reason) {
    await prisma.invoice.update({ where: { id }, data: { status: "DISCARDED", lastError: reason } });
  },

  async isNumberTakenByAnother(invoice, number) {
    const other = await prisma.invoice.findFirst({
      where: {
        id: { not: invoice.id },
        status: "AUTHORIZED",
        environment: invoice.environment,
        pointOfSale: invoice.pointOfSale,
        kind: invoice.kind,
        number,
      },
      select: { id: true },
    });
    return other !== null;
  },
};
