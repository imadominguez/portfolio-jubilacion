"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { AssetDialog, type AssetRow } from "./asset-dialog";
import { deleteAsset } from "@/app/actions/assets";

interface AssetsTableClientProps {
  assets: AssetRow[];
}

export function AssetsTableClient({ assets }: AssetsTableClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteAsset(deleteTarget.id);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
          Catálogo de CEDEARs
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-3" data-icon="inline-start" />
          Nuevo activo
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Sin activos registrados</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Registrá los CEDEARs de tu portfolio con sus ratios para habilitar
            los cálculos en USD.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 gap-2 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3" data-icon="inline-start" />
            Agregar primer activo
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-fade-up">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/40">
                <TableHead className="pl-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                  Ticker
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
                  Instrumento
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Ratio
                </TableHead>
                <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 hidden md:table-cell h-9">
                  Descripción
                </TableHead>
                <TableHead className="pr-5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id} className="border-border hover:bg-muted/30">
                  <TableCell className="pl-5 py-3.5">
                    <span className="text-sm font-medium font-mono text-foreground">
                      {asset.ticker}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="text-sm text-muted-foreground">
                      {asset.instrumentName ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      {Number(asset.cedearRatio).toFixed(
                        Number(asset.cedearRatio) % 1 === 0 ? 0 : 4
                      )}
                      :1
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                      {asset.description ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        onClick={() => setEditAsset(asset)}
                        title="Editar"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0"
                        onClick={() => setDeleteTarget(asset)}
                        title="Eliminar"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <AssetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        asset={null}
      />

      {/* Edit dialog */}
      <AssetDialog
        open={!!editAsset}
        onOpenChange={(open) => { if (!open) setEditAsset(null); }}
        asset={editAsset}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-medium">
              Eliminar {deleteTarget?.ticker}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. El activo{" "}
              <span className="font-medium font-mono text-foreground">
                {deleteTarget?.ticker}
              </span>{" "}
              será eliminado del catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
