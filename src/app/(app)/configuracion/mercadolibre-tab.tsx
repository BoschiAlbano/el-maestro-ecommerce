"use client";

import { useActionState, useState, useTransition } from "react";
import {
  disconnectMercadoLibre,
  fetchMissedNotifications,
  startMercadoLibreConnection,
  type MlActionState,
} from "./mercadolibre-actions";
import type { MlConnectionView } from "@/lib/mercadolibre/connection";
import { ML_RESULTS, type MlConnectResult } from "@/lib/mercadolibre/connection-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { OrdersStartDate } from "./orders-start-date";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Tucuman",
});

const initialState: MlActionState = {};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="text-sm text-muted-foreground sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ConnectButton({ label, variant }: { label: string; variant?: "default" | "outline" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      className="w-fit"
      onClick={() => startTransition(() => startMercadoLibreConnection())}
    >
      {pending ? "Abriendo Mercado Libre..." : label}
    </Button>
  );
}

/**
 * Pestaña "Mercado Libre" de Configuración (specs/019, RF-1 a RF-8). La ve
 * quien tiene permiso "ver"; conectar y desconectar son solo del Dueño. Los
 * permisos se validan otra vez en el servidor: acá solo se oculta.
 */
export function MercadoLibreTab({
  view,
  isOwner,
  canEdit,
  result,
  ordersStartDate,
}: {
  view: MlConnectionView;
  isOwner: boolean;
  /** Permiso "editar" en Configuración: puede buscar avisos pendientes. */
  canEdit: boolean;
  /** Resultado del retorno desde Mercado Libre, si se acaba de volver. */
  result: MlConnectResult | null;
  /** Desde qué día se registran las compras (specs/022, RF-9b). */
  ordersStartDate: string | null;
}) {
  const [disconnectState, disconnectAction, disconnecting] = useActionState(disconnectMercadoLibre, initialState);
  const [fetchState, fetchAction, fetching] = useActionState(fetchMissedNotifications, initialState);
  // Lo último que se hizo en la pantalla: el mensaje más reciente manda.
  const state = fetchState.success || fetchState.error ? fetchState : disconnectState;
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { connection } = view;
  const resultInfo = result ? ML_RESULTS[result] : null;
  const needsReconnect = connection?.status === "NEEDS_RECONNECT";

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {resultInfo && !state.success && !state.error && (
        <p role="status" className={resultInfo.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
          {resultInfo.text}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.success}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {!view.configured && (
        <p className="text-sm text-destructive">
          Falta configurar Mercado Libre en el servidor. Hasta entonces no se puede conectar ninguna cuenta.
        </p>
      )}

      {!connection && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            No hay ninguna cuenta de Mercado Libre conectada. Al conectar vas a ir a Mercado Libre para iniciar sesión
            y autorizar al sistema, y después volvés a esta pantalla.
          </p>
          {isOwner ? (
            view.configured && <ConnectButton label="Conectar con Mercado Libre" />
          ) : (
            <p className="text-sm text-muted-foreground">Solo el Dueño puede conectar la cuenta.</p>
          )}
        </div>
      )}

      {connection && (
        <>
          <dl className="flex flex-col gap-2">
            <Row label="Cuenta">
              <span className="font-medium">{connection.nickname}</span>
            </Row>
            <Row label="Estado">
              {needsReconnect ? (
                <Badge variant="destructive">Requiere reconexión</Badge>
              ) : (
                <Badge variant="secondary">Conectada</Badge>
              )}
            </Row>
            <Row label="Conectada desde">{dateFormat.format(connection.connectedAt)}</Row>
            <Row label="Último aviso recibido">
              {connection.lastNotificationAt ? dateFormat.format(connection.lastNotificationAt) : "Todavía ninguno"}
            </Row>
            <Row label="Avisos por procesar">
              {view.pendingNotifications} pendientes, {view.failedNotifications} fallidos
            </Row>
          </dl>

          {needsReconnect && (
            <p className="text-sm text-destructive">
              {connection.statusReason ?? "Se perdió la conexión con Mercado Libre."} Hasta volver a conectar, el
              sistema no puede consultar ni actualizar nada en Mercado Libre.
            </p>
          )}

          {canEdit && (
            <form action={fetchAction}>
              <Button type="submit" variant="outline" disabled={fetching} className="w-fit">
                {fetching ? "Buscando..." : "Buscar avisos pendientes"}
              </Button>
            </form>
          )}

          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              {needsReconnect && view.configured && <ConnectButton label="Volver a conectar" />}
              <Button
                type="button"
                variant="outline"
                disabled={disconnecting}
                className="w-fit"
                onClick={() => setConfirmOpen(true)}
              >
                Desconectar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Solo el Dueño puede conectar o desconectar la cuenta.</p>
          )}

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`¿Desconectar la cuenta ${connection.nickname}?`}
            description="El sistema deja de tener acceso a Mercado Libre y se descartan los avisos que quedaban por procesar. Lo que ya está registrado en el sistema no se borra. Para volver a usar Mercado Libre vas a tener que conectar la cuenta de nuevo."
            confirmLabel={disconnecting ? "Desconectando..." : "Desconectar"}
            pending={disconnecting}
            onConfirm={() => {
              startTransition(() => {
                disconnectAction();
                setConfirmOpen(false);
              });
            }}
          />
        </>
      )}

      <OrdersStartDate value={ordersStartDate} canEdit={canEdit} />
    </div>
  );
}
