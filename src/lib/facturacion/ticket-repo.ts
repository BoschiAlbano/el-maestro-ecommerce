import "server-only";
import { prisma } from "@/lib/prisma";
import type { TicketRepo } from "./ticket-storage";

// El permiso temporal de ARCA sobre la tabla `arca_tickets` (specs/023). La
// clave es el ambiente y el servicio: el de pruebas y el real no se pisan.
export const prismaTicketRepo: TicketRepo = {
  async get(environment, service) {
    const row = await prisma.arcaTicket.findUnique({
      where: { environment_service: { environment, service } },
    });
    return row ? { payloadEnc: row.payloadEnc, cuit: row.cuit, expiresAt: row.expiresAt } : null;
  },

  async upsert(environment, service, row) {
    await prisma.arcaTicket.upsert({
      where: { environment_service: { environment, service } },
      create: { environment, service, ...row },
      update: row,
    });
  },

  async delete(environment, service) {
    await prisma.arcaTicket.deleteMany({ where: { environment, service } });
  },
};
