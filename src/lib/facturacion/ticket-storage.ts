import { AccessTicket } from "@arcasdk/core";

// Almacenamiento del permiso temporal de ARCA (specs/023, plan sección 3.3b).
//
// ARCA entrega un permiso de 12 horas y no entrega otro mientras el anterior
// siga vigente: perder el que ARCA considera vigente bloquea la facturación
// hasta que venza. Por eso el permiso se guarda siempre, cifrado, y la base se
// consulta antes de pedir uno nuevo. La base entra por `TicketRepo`, para
// poder probar esto sin base.

export type TicketEnvironment = "HOMOLOGACION" | "PRODUCCION";

export type TicketRow = {
  /** El permiso completo (token y firma incluidos), cifrado. */
  payloadEnc: string;
  /** CUIT del certificado con el que se pidió. */
  cuit: string;
  expiresAt: Date;
};

export interface TicketRepo {
  get(environment: TicketEnvironment, service: string): Promise<TicketRow | null>;
  upsert(environment: TicketEnvironment, service: string, row: TicketRow): Promise<void>;
  delete(environment: TicketEnvironment, service: string): Promise<void>;
}

export class TicketStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketStorageError";
  }
}

export type TicketStorageOptions = {
  environment: TicketEnvironment;
  /** CUIT del certificado en uso: un permiso de otro CUIT no sirve. */
  cuit: string;
  encrypt(plain: string): string;
  decrypt(stored: string): string;
  now?: () => Date;
};

/**
 * Cumple la interfaz de almacenamiento que acepta `@arcasdk/core`
 * (`save`, `get` y `delete`, por servicio).
 */
export class EncryptedTicketStorage {
  constructor(
    private readonly repo: TicketRepo,
    private readonly options: TicketStorageOptions,
  ) {}

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  async save(ticket: AccessTicket, service: string): Promise<void> {
    await this.repo.upsert(this.options.environment, service, {
      payloadEnc: this.options.encrypt(JSON.stringify(ticket.toLoginCredentials())),
      cuit: this.options.cuit,
      expiresAt: ticket.getExpiration(),
    });
  }

  /**
   * El permiso guardado, o `null` si no hay uno que sirva (no existe, venció o
   * es de otro CUIT). Si existe pero no se puede leer (la clave de cifrado
   * cambió), lanza en lugar de devolver `null`: devolver `null` haría pedir un
   * permiso nuevo, y ARCA lo rechazaría porque el anterior sigue vigente.
   */
  async get(service: string): Promise<AccessTicket | null> {
    const row = await this.repo.get(this.options.environment, service);
    if (!row) return null;
    if (row.cuit !== this.options.cuit) return null;
    if (row.expiresAt.getTime() <= this.now().getTime()) return null;

    try {
      return AccessTicket.create(JSON.parse(this.options.decrypt(row.payloadEnc)));
    } catch {
      throw new TicketStorageError(
        "No se pudo leer el permiso de ARCA guardado: la clave de cifrado del servidor no coincide. ARCA lo considera vigente hasta 12 horas, así que no se puede pedir otro hasta que venza; volver a la clave anterior lo resuelve de inmediato.",
      );
    }
  }

  async delete(service: string): Promise<void> {
    await this.repo.delete(this.options.environment, service);
  }

  /** ¿Hay un permiso utilizable guardado? */
  async hasValid(service: string): Promise<boolean> {
    return (await this.get(service)) !== null;
  }
}
