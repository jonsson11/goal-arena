"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ResultadoJuego = "exito" | "fracaso";

type GameResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultado: ResultadoJuego;
  titulo: string;
  descripcion: ReactNode;
  onJugarDeNuevo: () => void;
};

export function GameResultDialog({
  open,
  onOpenChange,
  resultado,
  titulo,
  descripcion,
  onJugarDeNuevo,
}: GameResultDialogProps) {
  const esExito = resultado === "exito";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`bg-card text-center sm:max-w-md ${
          esExito ? "border-primary/30" : "border-destructive/30"
        }`}
      >
        <DialogHeader className="items-center gap-3">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
              esExito ? "bg-primary/15" : "bg-destructive/15"
            }`}
          >
            {esExito ? "🏆" : "🏳️"}
          </div>
          <DialogTitle
            className={`text-4xl font-extrabold tracking-tight ${
              esExito ? "text-primary" : "text-destructive"
            }`}
          >
            {titulo}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {descripcion}
          </DialogDescription>
        </DialogHeader>

        <button
          onClick={onJugarDeNuevo}
          className="mt-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Volver a jugar
        </button>
      </DialogContent>
    </Dialog>
  );
}