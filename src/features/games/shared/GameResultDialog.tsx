"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GameButton } from "./GameButton";

type ResultadoJuego = "exito" | "fracaso";

// Opcional -- solo lo pasa el 3x3 por ahora. El botón despliega/pliega
// `contenido` DENTRO de este mismo cartel (a diferencia del viejo popup de
// soluciones por casilla que había en modo debug, que abría uno encima de
// otro). Los demás juegos (Higher/Lower, Top10) simplemente no pasan esta
// prop y el botón no aparece.
type RespuestasCorrectasProps = {
  mostrando: boolean;
  onToggle: () => void;
  contenido: ReactNode;
};

type GameResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultado: ResultadoJuego;
  titulo: string;
  descripcion: ReactNode;
  onJugarDeNuevo: () => void;
  respuestasCorrectas?: RespuestasCorrectasProps;
};

export function GameResultDialog({
  open,
  onOpenChange,
  resultado,
  titulo,
  descripcion,
  onJugarDeNuevo,
  respuestasCorrectas,
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

        {respuestasCorrectas && (
          <div className="flex w-full flex-col items-center gap-2">
            <GameButton variant="secondary" onClick={respuestasCorrectas.onToggle} className="w-full">
              {respuestasCorrectas.mostrando ? "Ocultar respuestas correctas" : "Mostrar respuestas correctas"}
            </GameButton>
            {respuestasCorrectas.mostrando && respuestasCorrectas.contenido}
          </div>
        )}

        <GameButton onClick={onJugarDeNuevo} className="mt-2">
          Volver a jugar
        </GameButton>
      </DialogContent>
    </Dialog>
  );
}