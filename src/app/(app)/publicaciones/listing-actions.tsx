"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { MlListingStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  activateListing,
  closeListing,
  pauseListing,
  retryPendingSync,
  unlinkListing,
  type ListingActionState,
} from "./actions";

type Confirm = "close" | "unlink" | null;

/** Acciones de una publicación vinculada (specs/020, RF-9, RF-16, RF-17). */
export function ListingActions({
  listingId,
  productName,
  status,
  canEdit,
  canVoid,
}: {
  listingId: string;
  productName: string;
  status: MlListingStatus;
  canEdit: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);

  function run(action: () => Promise<ListingActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else if (result.success) toast.success(result.success);
      setConfirm(null);
      router.refresh();
    });
  }

  const canPause = canEdit && (status === "ACTIVE" || status === "PAUSED_NO_STOCK");
  const canActivate = canEdit && status === "PAUSED";
  if (!canPause && !canActivate && !canVoid) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" disabled={pending} aria-label={`Acciones de ${productName}`}>
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {canPause && <DropdownMenuItem onClick={() => run(() => pauseListing(listingId))}>Pausar</DropdownMenuItem>}
          {canActivate && (
            <DropdownMenuItem onClick={() => run(() => activateListing(listingId))}>Reactivar</DropdownMenuItem>
          )}
          {canVoid && <DropdownMenuItem onClick={() => setConfirm("unlink")}>Deshacer vínculo</DropdownMenuItem>}
          {canVoid && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm("close")}>
              Finalizar publicación
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "close" ? "¿Finalizar la publicación?" : "¿Deshacer el vínculo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "close"
                ? `La publicación de «${productName}» se termina en Mercado Libre y no se puede volver a activar. Para venderlo otra vez hay que crear una publicación nueva en Mercado Libre y vincularla.`
                : `La publicación de «${productName}» sigue en Mercado Libre tal como está, pero el sistema deja de administrarla: sus ventas no van a descontar stock.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "close" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => run(() => (confirm === "close" ? closeListing(listingId) : unlinkListing(listingId)))}
            >
              {pending ? "Un momento..." : confirm === "close" ? "Finalizar" : "Deshacer vínculo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Reintenta los envíos pendientes de precio y pausa (RF-13). */
export function RetryPendingButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await retryPendingSync();
          if (result.error) toast.error(result.error);
          else if (result.success) toast.success(result.success);
          router.refresh();
        })
      }
    >
      {pending ? "Enviando..." : `Reintentar envíos (${count})`}
    </Button>
  );
}
