"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteSnapshot } from "@/app/actions/snapshots";

type DeleteSnapshotButtonProps = {
  snapshotId: string;
  formattedDate: string;
  positionCount: number;
};

/**
 * Los snapshots no se editan (ADR-0004): un CSV mal importado se corrige
 * borrándolo y volviendo a importar. Por eso la confirmación nombra la fecha y
 * explica cómo seguir.
 */
export function DeleteSnapshotButton({
  snapshotId,
  formattedDate,
  positionCount,
}: DeleteSnapshotButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSnapshot(snapshotId);
      if (result.success) {
        setOpen(false);
        toast.success(`Snapshot del ${formattedDate} eliminado`);
        router.push("/snapshots");
      } else {
        setError(result.error ?? "No se pudo eliminar el snapshot.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" data-icon="inline-start" />
        Eliminar snapshot
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-medium">
              ¿Eliminar el snapshot del {formattedDate}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Se borran sus {positionCount} posiciones y el CCL registrado. No se
              puede deshacer. Si lo eliminás para corregirlo, después volvé a
              importar el CSV de esa fecha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={isPending}>
              Conservar snapshot
            </AlertDialogCancel>
            {/* Button en vez de AlertDialogAction: Action cierra el diálogo al
                click y el error del servidor no llegaría a verse. */}
            <Button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Spinner className="size-3.5" /> : null}
              Eliminar snapshot
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
