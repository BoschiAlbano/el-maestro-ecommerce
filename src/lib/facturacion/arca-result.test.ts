import { describe, expect, it } from "vitest";
import {
  ALREADY_AUTHENTICATED_MESSAGE,
  classifyArcaException,
  interpretVoucherResult,
  parseArcaDate,
  translateIssue,
} from "./arca-result";
import {
  IVA_CONDITIONS,
  defaultIvaCondition,
  isIvaConditionAllowed,
  ivaConditionFromMercadoLibre,
  ivaConditionLabel,
} from "./iva-conditions";

// Las respuestas son las reales de homologación del 2026-11-11 (prueba técnica 023).
const AUTHORIZED = {
  cae: "86451067775494",
  caeFchVto: "20261121",
  response: {
    FeCabResp: { Resultado: "A" },
    FeDetResp: {
      FECAEDetResponse: [{ Concepto: 1, DocTipo: 99, DocNro: 0, CbteDesde: 70, CbteHasta: 70, Resultado: "A", CAE: "86451067775494", CAEFchVto: "20261121" }],
    },
  },
};

const REJECTED_NUMBERING = {
  cae: "",
  caeFchVto: "",
  response: {
    FeDetResp: { FECAEDetResponse: [{ CbteDesde: 73, Resultado: "R", CAE: "", CAEFchVto: "" }] },
    Errors: {
      Err: [
        {
          Code: 10016,
          Msg: "El numero o fecha del comprobante no se corresponde con el proximo a autorizar. Consultar metodo FECompUltimoAutorizado.",
        },
      ],
    },
  },
};

const REJECTED_DATE = {
  cae: "",
  response: {
    FeDetResp: {
      FECAEDetResponse: [
        {
          CbteDesde: 69,
          Resultado: "R",
          Observaciones: {
            Obs: [
              {
                Code: 10016,
                Msg: "Campo CbteFch Debe estar comprendido  en el  rango  N-5 y N+5 siendo N la fecha de envio del pedido  de autorizacion para 1 - Productos",
              },
            ],
          },
        },
      ],
    },
  },
};

const REJECTED_TOTAL = {
  response: {
    FeDetResp: {
      FECAEDetResponse: [
        {
          CbteDesde: 74,
          Resultado: "R",
          Observaciones: { Obs: [{ Code: 10048, Msg: "El campo  'Importe Total' ImpTotal, debe ser igual  a la  suma de ImpNeto + ImpTrib. Donde ImpNeto es igual al Sub Total" }] },
        },
      ],
    },
  },
};

const REJECTED_IVA = {
  response: {
    FeDetResp: {
      FECAEDetResponse: [
        { CbteDesde: 74, Resultado: "R", Observaciones: { Obs: [{ Code: 10246, Msg: "Campo Condicion Frente al IVA del receptor es obligatorio conforme a lo reglamentado por la Resolucion General Nro 5616." }] } },
      ],
    },
  },
};

describe("interpretVoucherResult", () => {
  it("autorizado: código de autorización, vencimiento y número", () => {
    const outcome = interpretVoucherResult(AUTHORIZED);
    expect(outcome).toEqual({
      status: "authorized",
      cae: "86451067775494",
      caeExpiresAt: new Date("2026-11-21T00:00:00.000Z"),
      number: 70,
    });
  });

  it("un rechazo NO es un error: llega con éxito y Resultado R", () => {
    for (const raw of [REJECTED_NUMBERING, REJECTED_DATE, REJECTED_TOTAL, REJECTED_IVA]) {
      expect(interpretVoucherResult(raw).status).toBe("rejected");
    }
  });

  it("número fuera de secuencia: el motivo viene en Errors y reintentar consulta el último", () => {
    const outcome = interpretVoucherResult(REJECTED_NUMBERING);
    expect(outcome.status === "rejected" && outcome.issues[0]).toMatchObject({ code: 10016, kind: "numbering" });
  });

  it("fecha fuera de rango: mismo código 10016 pero otro motivo, y no se arregla reintentando", () => {
    const outcome = interpretVoucherResult(REJECTED_DATE);
    expect(outcome.status === "rejected" && outcome.issues[0]).toMatchObject({ code: 10016, kind: "date" });
    expect(outcome.status === "rejected" && outcome.issues[0].message).toMatch(/5 días/);
  });

  it("total que no cierra y condición IVA faltante, desde las observaciones", () => {
    const total = interpretVoucherResult(REJECTED_TOTAL);
    expect(total.status === "rejected" && total.issues[0]).toMatchObject({ code: 10048, kind: "data" });
    const iva = interpretVoucherResult(REJECTED_IVA);
    expect(iva.status === "rejected" && iva.issues[0]).toMatchObject({ code: 10246, kind: "data" });
  });

  it("junta los errores y las observaciones", () => {
    const both = {
      response: {
        Errors: { Err: [{ Code: 1, Msg: "uno" }] },
        FeDetResp: { FECAEDetResponse: [{ Resultado: "R", Observaciones: { Obs: [{ Code: 2, Msg: "dos" }] } }] },
      },
    };
    const outcome = interpretVoucherResult(both);
    expect(outcome.status === "rejected" && outcome.issues.map((i) => i.code)).toEqual([1, 2]);
  });

  it("sin motivo informado, igual es un rechazo y lo dice", () => {
    const outcome = interpretVoucherResult({ response: { FeDetResp: { FECAEDetResponse: [{ Resultado: "R" }] } } });
    expect(outcome.status === "rejected" && outcome.issues[0].message).toMatch(/no informó el motivo/);
  });

  it("respuestas raras nunca cuentan como autorizadas", () => {
    for (const raw of [null, undefined, {}, "texto", { response: {} }, { cae: "123" }]) {
      expect(interpretVoucherResult(raw).status).toBe("rejected");
    }
  });

  it("'A' sin código de autorización válido, vencimiento o número no cuenta como autorizado", () => {
    const withoutCae = structuredClone(AUTHORIZED) as typeof AUTHORIZED;
    withoutCae.cae = "";
    withoutCae.response.FeDetResp.FECAEDetResponse[0].CAE = "";
    expect(interpretVoucherResult(withoutCae).status).toBe("rejected");

    expect(interpretVoucherResult({ ...AUTHORIZED, cae: "1234" }).status).toBe("rejected");

    // El vencimiento se toma de arriba o del detalle: sin ninguno de los dos, no hay factura.
    const withoutExpiry = structuredClone(AUTHORIZED) as typeof AUTHORIZED;
    withoutExpiry.caeFchVto = "";
    withoutExpiry.response.FeDetResp.FECAEDetResponse[0].CAEFchVto = "";
    expect(interpretVoucherResult(withoutExpiry).status).toBe("rejected");

    // Con el vencimiento solo en el detalle, sí vale.
    expect(interpretVoucherResult({ ...AUTHORIZED, caeFchVto: "" }).status).toBe("authorized");
  });
});

describe("parseArcaDate", () => {
  it("lee AAAAMMDD", () => {
    expect(parseArcaDate("20261121")?.toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("rechaza lo que no es una fecha", () => {
    expect(parseArcaDate("")).toBeNull();
    expect(parseArcaDate("2026-11-21")).toBeNull();
    expect(parseArcaDate("2026112")).toBeNull();
  });
});

describe("translateIssue", () => {
  it("un código desconocido conserva el texto de ARCA", () => {
    const issue = translateIssue(99999, "Algo raro");
    expect(issue).toMatchObject({ code: 99999, kind: "other", original: "Algo raro" });
    expect(issue.message).toContain("99999");
    expect(issue.message).toContain("Algo raro");
  });
});

describe("classifyArcaException", () => {
  it("el permiso vigente que no tenemos (el error de la prueba técnica)", () => {
    const error = new Error("ns1:coe.alreadyAuthenticated: El CEE ya posee un TA valido para el acceso al WSN solicitado");
    expect(classifyArcaException(error)).toBe("already_authenticated");
    expect(ALREADY_AUTHENTICATED_MESSAGE).toMatch(/12 horas/);
  });

  it("caídas de red y demoras", () => {
    expect(classifyArcaException(new Error("connect ETIMEDOUT 1.2.3.4:443"))).toBe("unreachable");
    expect(classifyArcaException(new Error("getaddrinfo ENOTFOUND wsaa"))).toBe("unreachable");
    expect(classifyArcaException(new Error("fetch failed"))).toBe("unreachable");
    expect(classifyArcaException(new Error("The operation was aborted due to timeout"))).toBe("unreachable");
  });

  it("lo demás", () => {
    expect(classifyArcaException(new Error("algo roto"))).toBe("other");
    expect(classifyArcaException("texto")).toBe("other");
  });
});

describe("condiciones frente al IVA", () => {
  it("los códigos son los de la tabla de ARCA para clase C", () => {
    expect(Object.fromEntries(IVA_CONDITIONS.map((c) => [c.label, c.id]))).toEqual({
      "Consumidor Final": 5,
      "IVA Responsable Inscripto": 1,
      "Responsable Monotributo": 6,
      "Monotributista Social": 13,
      "IVA Sujeto Exento": 4,
    });
  });

  it("valor inicial según cómo se identifica el comprador", () => {
    expect(defaultIvaCondition("NONE")).toBe(5);
    expect(defaultIvaCondition("DNI")).toBe(5);
    expect(defaultIvaCondition("CUIT")).toBe(1);
  });

  it("sin identificar solo puede ser Consumidor Final; un código desconocido nunca", () => {
    expect(isIvaConditionAllowed("NONE", 5)).toBe(true);
    expect(isIvaConditionAllowed("NONE", 1)).toBe(false);
    expect(isIvaConditionAllowed("CUIT", 6)).toBe(true);
    expect(isIvaConditionAllowed("CUIT", 999)).toBe(false);
  });

  it("etiqueta de un código, con respaldo", () => {
    expect(ivaConditionLabel(6)).toBe("Responsable Monotributo");
    expect(ivaConditionLabel(99)).toBe("Condición 99");
  });

  it("traduce la situación fiscal que informa Mercado Libre", () => {
    expect(ivaConditionFromMercadoLibre("Monotributo")).toBe(6);
    expect(ivaConditionFromMercadoLibre("IVA Responsable Inscripto")).toBe(1);
    expect(ivaConditionFromMercadoLibre("IVA Exento")).toBe(4);
    expect(ivaConditionFromMercadoLibre(null)).toBe(5);
    expect(ivaConditionFromMercadoLibre("otra cosa")).toBe(5);
  });
});
