"use client";

// Diálogo de confirmación genérico ("¿Seguro que quieres...?") para
// acciones que se pueden pulsar sin querer y que tienen consecuencia real
// (perder el progreso de la partida, contar como derrota...). Antes estas
// acciones se disparaban directas al primer toque; ahora se interponen
// aquí. Reutilizable por cualquier minijuego -- no tiene nada específico
// de Top10.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GameButton } from "./GameButton";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoConfirmar = "Sí, continuar",
  textoCancelar = "Cancelar",
  onConfirmar,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <GameButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {textoCancelar}
          </GameButton>
          <GameButton
            type="button"
            variant="destructive"
            onClick={() => {
              // Se cierra el diálogo ANTES de disparar la acción -- si se
              // hiciera al revés, un onConfirmar que desmonta este mismo
              // componente (p. ej. cargarRanking reseteando todo el estado
              // del juego) podría dejar el diálogo abierto huérfano.
              onOpenChange(false);
              onConfirmar();
            }}
            className="w-full sm:w-auto"
          >
            {textoConfirmar}
          </GameButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}