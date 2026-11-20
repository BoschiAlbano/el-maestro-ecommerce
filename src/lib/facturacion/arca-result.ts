// Interpretación de lo que responde ARCA al pedir la autorización de un
// comprobante (specs/023, RF-11 y RF-12). Funciones puras, escritas a partir
// de las respuestas reales de homologación del 2026-11-11 (prueba técnica,
// A-6 a A-11).
//
// Dato clave: ARCA NO lanza un error cuando rechaza. Responde con éxito HTTP y
// `Resultado: "R"`, y el motivo viene en `Errors.Err` o en las observaciones
// del comprobante. Quien no lea `Resultado` toma un rechazo por una factura.

export type ArcaIssue = {
  code: number;
  /** Mensaje original de ARCA. */
  original: string;
  /** Mensaje para el usuario, en español claro y con qué hacer. */
  message: string;
  kind: IssueKind;
};

export type IssueKind =
  /** El número que se pidió no es el próximo: hay que volver a consultar el último y reintentar. */
  | "numbering"
  /** La fecha está fuera del rango que admite ARCA. */
  | "date"
  /** Falta o está mal un dato del comprobante. */
  | "data"
  | "other";

export type VoucherOutcome =
  | { status: "authorized"; cae: string; caeExpiresAt: Date; number: number }
  | { status: "rejected"; issues: ArcaIssue[] };

type RawIssue = { Code?: number; Msg?: string };
type RawDetail = {
  Resultado?: string;
  CAE?: string;
  CAEFchVto?: string;
  CbteDesde?: number;
  Observaciones?: { Obs?: RawIssue[] };
};
type RawResult = {
  cae?: string;
  caeFchVto?: string;
  response?: {
    FeDetResp?: { FECAEDetResponse?: RawDetail[] };
    Errors?: { Err?: RawIssue[] };
  };
};

/** "20261121" → 21 de noviembre de 2026, sin hora (se guarda como fecha). */
export function parseArcaDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Traduce un código de ARCA. Los desconocidos se muestran con su texto original. */
export function translateIssue(code: number, original: string): ArcaIssue {
  // El código 10016 sirve para dos cosas distintas: el número y la fecha.
  if (code === 10016 && /CbteFch/i.test(original)) {
    return {
      code,
      original,
      kind: "date",
      message:
        "La fecha del comprobante tiene que estar dentro de los 5 días anteriores o posteriores a hoy. Esta venta ya no se puede facturar.",
    };
  }
  if (code === 10016) {
    return {
      code,
      original,
      kind: "numbering",
      message: "El número del comprobante no es el próximo que espera ARCA. El sistema vuelve a consultarlo al reintentar.",
    };
  }
  if (code === 10048) {
    return { code, original, kind: "data", message: "El total del comprobante no coincide con la suma de sus importes." };
  }
  if (code === 10246) {
    return {
      code,
      original,
      kind: "data",
      message: "Falta la condición frente al IVA del comprador, que ARCA exige en todas las facturas.",
    };
  }
  return { code, original, kind: "other", message: `ARCA rechazó el comprobante (código ${code}): ${original}` };
}

function collectIssues(result: RawResult, detail: RawDetail | undefined): ArcaIssue[] {
  const raw = [...(result.response?.Errors?.Err ?? []), ...(detail?.Observaciones?.Obs ?? [])];
  return raw.map((issue) => translateIssue(issue.Code ?? 0, (issue.Msg ?? "").trim()));
}

/** Autorizado solo si ARCA lo dice (`Resultado: "A"`) y trae un código de 14 dígitos y el número. */
export function interpretVoucherResult(raw: unknown): VoucherOutcome {
  const result = (raw ?? {}) as RawResult;
  const detail = result.response?.FeDetResp?.FECAEDetResponse?.[0];

  const cae = (result.cae || detail?.CAE || "").trim();
  const expires = parseArcaDate(result.caeFchVto || detail?.CAEFchVto || "");
  const number = detail?.CbteDesde;

  if (detail?.Resultado === "A" && /^\d{14}$/.test(cae) && expires && typeof number === "number") {
    return { status: "authorized", cae, caeExpiresAt: expires, number };
  }

  const issues = collectIssues(result, detail);
  if (issues.length === 0) {
    issues.push({
      code: 0,
      original: "",
      kind: "other",
      message: "ARCA no autorizó el comprobante y no informó el motivo. Probá de nuevo.",
    });
  }
  return { status: "rejected", issues };
}

export type ArcaFailure =
  /** ARCA tiene un permiso vigente que el sistema no tiene guardado (plan, sección 3.3b). */
  | "already_authenticated"
  /** No se pudo hablar con ARCA: red, demora o servicio caído. */
  | "unreachable"
  | "other";

/** Clasifica una excepción al llamar a ARCA (no un rechazo: ver `interpretVoucherResult`). */
export function classifyArcaException(error: unknown): ArcaFailure {
  const text = `${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`;
  if (/alreadyAuthenticated|ya posee un TA valido/i.test(text)) return "already_authenticated";
  if (/ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|timeout|timed out|aborted/i.test(text)) {
    return "unreachable";
  }
  return "other";
}

export const ALREADY_AUTHENTICATED_MESSAGE =
  "ARCA tiene un permiso vigente que el sistema no tiene guardado, por ejemplo porque se restauró una copia de la base o se cambió la clave de cifrado. Se podrá volver a facturar cuando ese permiso venza, dentro de las próximas 12 horas. Mientras tanto las ventas siguen saliendo con ticket.";

export const UNREACHABLE_MESSAGE = "No se pudo comunicar con ARCA. La venta quedó hecha; podés reintentar la factura más tarde.";
