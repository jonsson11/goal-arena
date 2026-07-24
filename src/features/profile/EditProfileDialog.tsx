"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { AVATARES_DISPONIBLES } from "./data";
import type { Usuario } from "./type";

type EditProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: Usuario;
  onGuardar: (nombre: string, avatar: string) => void;
};

export function EditProfileDialog({
  open,
  onOpenChange,
  usuario,
  onGuardar,
}: EditProfileDialogProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [avatar, setAvatar] = useState(usuario.avatar);

  function handleGuardar() {
    if (!nombre.trim()) return;
    onGuardar(nombre.trim(), avatar);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-muted-foreground">
              Nombre de usuario
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-muted-foreground">
              Avatar
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATARES_DISPONIBLES.map((opcion) => (
                <button
                  key={opcion}
                  onClick={() => setAvatar(opcion)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition-all ${
                    avatar === opcion
                      ? "border-primary bg-primary/15 shadow-[0_0_12px_-2px_rgba(74,222,154,0.6)]"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  {opcion}
                </button>
              ))}
            </div>
          </div>

          <GameButton onClick={handleGuardar} className="mt-2">
            Guardar cambios
          </GameButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}