"use client";

import { useActionState, useState, useTransition } from "react";
import {
  generateCertificateRequestAction,
  removeCertificateAction,
  saveFiscalConfig,
  setFiscalEnvironment,
  testArcaConnection,
  uploadCertificate,
  type FacturacionState,
} from "./facturacion-actions";
import type { CertificateView, FacturacionView } from "@/lib/facturacion/facturacion-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Environment = "HOMOLOGACION" | "PRODUCCION";

const ENVIRONMENT_LABEL: Record<Environment, string> = {
  HOMOLOGACION: "Pruebas (sin validez fiscal)",
  PRODUCCION: "Real (con validez fiscal)",
};

const initialState: FacturacionState = {};

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" });

function formatDate(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00.000Z`));
}

function Message({ state }: { state: FacturacionState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.success}
        </p>
      )}
    </>
  );
}

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Estado general: si se puede facturar, o qué falta (RF-4). */
function StatusBlock({ view }: { view: FacturacionView }) {
  const ready = view.missing.length === 0;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Estado</h2>
        {ready ? <Badge variant="secondary">Lista para facturar</Badge> : <Badge variant="destructive">Falta configurar</Badge>}
      </div>
      {ready ? (
        <p className="text-sm text-muted-foreground">
          Se factura en modo <strong>{view.config.environment === "PRODUCCION" ? "real" : "de pruebas"}</strong>
          {view.config.environment === "HOMOLOGACION" && ": las facturas no tienen validez fiscal"}.
        </p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {view.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmitterForm({ view, isOwner }: { view: FacturacionView; isOwner: boolean }) {
  const [state, formAction, pending] = useActionState(saveFiscalConfig, initialState);
  const c = view.config;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Datos del emisor</h2>
      <fieldset disabled={!isOwner || pending} className="grid gap-4 sm:grid-cols-2">
        <Field id="razonSocial" label="Razón social" defaultValue={c.razonSocial} required />
        <Field id="cuit" label="CUIT" defaultValue={c.cuit} inputMode="numeric" placeholder="20-12345678-9" required />
        <Field id="domicilioComercial" label="Domicilio comercial" defaultValue={c.domicilioComercial} required />
        <Field id="iibb" label="Ingresos Brutos" defaultValue={c.iibb} required />
        <Field id="inicioActividades" label="Inicio de actividades" type="date" defaultValue={c.inicioActividades} required />
        <Field
          id="puntoDeVenta"
          label="Punto de venta"
          defaultValue={c.puntoDeVenta}
          inputMode="numeric"
          hint="El número que diste de alta en ARCA para facturación electrónica (web services)."
          required
        />
        <Field
          id="topeAnual"
          label="Tope anual del monotributo (opcional)"
          defaultValue={c.topeAnual}
          inputMode="decimal"
          hint="Solo para avisarte al llegar al 80 %. Nunca frena una venta."
        />
        <Field
          id="montoIdentificacion"
          label="Identificar al comprador desde"
          defaultValue={c.montoIdentificacion}
          inputMode="decimal"
          hint="Desde este total ARCA exige DNI o CUIT del comprador."
          required
        />
        <Field
          id="diasParaFacturar"
          label="Días para facturar una venta ya hecha"
          type="number"
          min={0}
          max={view.maxDiasParaFacturar}
          defaultValue={c.diasParaFacturar}
          hint={`ARCA no acepta facturas de más de ${view.maxDiasParaFacturar} días de antigüedad.`}
          required
        />
      </fieldset>
      <Message state={state} />
      {isOwner ? (
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Guardando..." : "Guardar datos del emisor"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo el Dueño puede cambiar estos datos.</p>
      )}
    </form>
  );
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-pem-file" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function CertificateCard({ environment, certificate }: { environment: Environment; certificate: CertificateView }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadCertificate, initialState);
  const [message, setMessage] = useState<FacturacionState>({});
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withKey, setWithKey] = useState(false);

  const state = uploadState.error || uploadState.success ? uploadState : message;
  const expiring = certificate.daysLeft !== null && certificate.daysLeft <= 30;

  function generate() {
    setMessage({});
    startTransition(async () => {
      const result = await generateCertificateRequestAction(environment);
      if (result.error || !result.csr) {
        setMessage({ error: result.error ?? "No se pudo generar el pedido." });
        return;
      }
      downloadText(`pedido-certificado-${environment === "PRODUCCION" ? "real" : "pruebas"}.csr`, result.csr);
      setMessage({
        success: "Pedido generado y descargado. Subilo en ARCA (Administrador de Certificados Digitales) y después cargá acá el certificado que te devuelve.",
      });
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Certificado — {ENVIRONMENT_LABEL[environment]}</h3>
        {certificate.hasCertificate ? (
          <Badge variant={expiring ? "destructive" : "secondary"}>{expiring ? "Por vencer" : "Cargado"}</Badge>
        ) : (
          <Badge variant="outline">Sin cargar</Badge>
        )}
      </div>

      {certificate.hasCertificate && certificate.expiresAt && (
        <p className="text-sm">
          Vence el {formatDate(certificate.expiresAt)}
          {certificate.daysLeft !== null &&
            (certificate.daysLeft >= 0 ? ` (en ${certificate.daysLeft} días)` : " (ya venció)")}
          . Emisor: CUIT {certificate.cuit}.
        </p>
      )}
      {expiring && (
        <p className="text-sm text-destructive">
          Hay que renovar el certificado antes de que venza. Generá un pedido nuevo y cargá el certificado que te devuelva ARCA.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={generate}>
          {pending ? "Generando..." : certificate.hasCertificate ? "Generar pedido para renovar" : "Generar pedido de certificado"}
        </Button>
        {certificate.hasPendingRequest && certificate.pendingCsrPem && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => downloadText(`pedido-certificado-${environment === "PRODUCCION" ? "real" : "pruebas"}.csr`, certificate.pendingCsrPem!)}
          >
            Volver a descargar el pedido
          </Button>
        )}
        {certificate.hasCertificate && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmOpen(true)}>
            Quitar certificado
          </Button>
        )}
      </div>

      <form action={uploadAction} className="flex flex-col gap-3">
        <input type="hidden" name="environment" value={environment} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`certificate-${environment}`}>Certificado que devolvió ARCA (.crt o .pem)</Label>
          <Input id={`certificate-${environment}`} name="certificate" type="file" accept=".crt,.pem,.cer" required />
          {certificate.hasPendingRequest && !withKey && (
            <p className="text-xs text-muted-foreground">Hay un pedido esperando: alcanza con el certificado.</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withKey} onChange={(event) => setWithKey(event.target.checked)} />
          Ya tenía el certificado y la clave privada de antes (no generé el pedido acá)
        </label>
        {withKey && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`privateKey-${environment}`}>Clave privada (.key)</Label>
            <Input id={`privateKey-${environment}`} name="privateKey" type="file" accept=".key,.pem" required />
          </div>
        )}
        <Button type="submit" disabled={uploading} className="w-fit">
          {uploading ? "Cargando..." : "Cargar certificado"}
        </Button>
      </form>
      <Message state={state} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Quitar el certificado?"
        description="Mientras no haya otro cargado, no se va a poder facturar en este ambiente. Las facturas ya emitidas no se tocan."
        confirmLabel="Quitar"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            setMessage(await removeCertificateAction(environment));
            setConfirmOpen(false);
          })
        }
      />
    </section>
  );
}

function EnvironmentBlock({ view }: { view: FacturacionView }) {
  const [message, setMessage] = useState<FacturacionState>({});
  const [pending, startTransition] = useTransition();
  const [confirmReal, setConfirmReal] = useState(false);
  const current = view.config.environment;

  function change(environment: Environment) {
    startTransition(async () => {
      setMessage(await setFiscalEnvironment(environment));
      setConfirmReal(false);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Con qué certificado se factura</h2>
      <p className="text-sm text-muted-foreground">
        Ahora: <strong>{ENVIRONMENT_LABEL[current]}</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {current === "PRODUCCION" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => change("HOMOLOGACION")}>
            Pasar a modo de pruebas
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !view.canUseReal}
            onClick={() => setConfirmReal(true)}
          >
            Pasar a modo real
          </Button>
        )}
      </div>
      {current === "HOMOLOGACION" && !view.canUseReal && (
        <p className="text-xs text-muted-foreground">
          El modo real solo se puede activar en el sitio publicado, no en un entorno de desarrollo o de prueba.
        </p>
      )}
      <Message state={message} />
      <ConfirmDialog
        open={confirmReal}
        onOpenChange={setConfirmReal}
        title="¿Facturar con validez fiscal?"
        description="Desde ahora, cada factura que se emita es real y queda informada a ARCA. Las facturas de prueba que ya hiciste no cuentan ni se transforman."
        confirmLabel="Pasar a modo real"
        pending={pending}
        onConfirm={() => change("PRODUCCION")}
      />
    </section>
  );
}

function ConnectionTest() {
  const [state, setState] = useState<FacturacionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Probar la conexión con ARCA</h2>
      <p className="text-sm text-muted-foreground">
        Verifica que el certificado funcione y muestra el último número de factura C. No emite ningún comprobante.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="w-fit"
        onClick={() => {
          setState({});
          startTransition(async () => setState(await testArcaConnection()));
        }}
      >
        {pending ? "Probando..." : "Probar conexión"}
      </Button>
      <Message state={state} />
    </section>
  );
}

/**
 * Pestaña "Facturación" de Configuración (specs/023, RF-1 a RF-4 y RF-2b a RF-2e).
 * La ve quien tiene permiso "ver"; editar y todo lo del certificado es solo del
 * Dueño, y cada acción lo vuelve a validar en el servidor.
 */
export function FacturacionTab({ view, isOwner }: { view: FacturacionView; isOwner: boolean }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <StatusBlock view={view} />
      {!view.hasEncryptionKey && (
        <p role="alert" className="text-sm text-destructive">
          Falta configurar en el servidor la clave que cifra los certificados (ARCA_ENCRYPTION_KEY). Sin ella no se pueden
          cargar certificados ni facturar. Avisale a quien administra el sistema.
        </p>
      )}
      <EmitterForm view={view} isOwner={isOwner} />
      {isOwner && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Certificados digitales</h2>
            <p className="text-sm text-muted-foreground">
              ARCA identifica al sistema con un certificado. El de pruebas permite practicar sin validez fiscal; el real es el
              que emite facturas de verdad. La clave privada se guarda cifrada y nunca se muestra ni se descarga.
            </p>
            <CertificateCard environment="HOMOLOGACION" certificate={view.certificates.HOMOLOGACION} />
            <CertificateCard environment="PRODUCCION" certificate={view.certificates.PRODUCCION} />
          </section>
          <EnvironmentBlock view={view} />
          <ConnectionTest />
        </>
      )}
    </div>
  );
}
