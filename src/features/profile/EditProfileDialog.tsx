"use client";

import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { AVATARES_DISPONIBLES } from "./data";
import type { TipoAvatar, Usuario } from "./type";

type EditProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: Usuario;
  onGuardar: (nombre: string, avatar: string, avatarTipo: TipoAvatar) => void;
};

export function EditProfileDialog({
  open,
  onOpenChange,
  usuario,
  onGuardar,
}: EditProfileDialogProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [avatar, setAvatar] = useState(usuario.avatar);
  const [avatarTipo, setAvatarTipo] = useState<TipoAvatar>(usuario.avatarTipo);

  function handleSeleccionarEmoji(emoji: string) {
    setAvatar(emoji);
    setAvatarTipo("emoji");
  }

  function handleSubirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Por favor, selecciona un archivo de imagen.");
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      setAvatar(lector.result as string);
      setAvatarTipo("foto");
    };
    lector.readAsDataURL(archivo);
  }

  function handleGuardar() {
    if (!nombre.trim()) return;
    onGuardar(nombre.trim(), avatar, avatarTipo);
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
              Avatar actual
            </label>
            <div className="flex items-center justify-center">
              {avatarTipo === "foto" ? (
                // eslint-disable-next-line @next/next/no-img-element -- previsualización de imagen subida por el usuario (data URL), no un asset estático
                <img
                  src={avatar}
                  alt="Vista previa del avatar"
                  className="h-20 w-20 rounded-full border-2 border-primary object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-4xl">
                  {avatar}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-muted-foreground">
              Subir una foto
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleSubirFoto}
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground file:transition-opacity hover:file:opacity-90"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-muted-foreground">
              O elige un emoji
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATARES_DISPONIBLES.map((opcion) => (
                <button
                  key={opcion}
                  onClick={() => handleSeleccionarEmoji(opcion)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition-all ${
                    avatarTipo === "emoji" && avatar === opcion
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