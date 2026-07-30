"use client";

import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";
import { AVATARES_DISPONIBLES } from "./data";
import type { TipoAvatar, Usuario } from "./type";

type EditProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: Usuario;
  onGuardar: (nombre: string, avatar: string, avatarTipo: TipoAvatar) => Promise<boolean>;
};

const NOMBRE_BUCKET = "avatars";
const LADO_MAXIMO_PX = 512; // no hace falta guardar selfies a resolución completa

/** Redimensiona una imagen en el navegador (canvas) antes de subirla, para
 * no gastar de más en Storage ni tardar en cargar el avatar en ningún sitio. */
function redimensionarImagen(archivo: File, ladoMaximo: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
        const ancho = Math.round(img.width * escala);
        const alto = Math.round(img.height * escala);

        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen."));
          return;
        }
        ctx.drawImage(img, 0, 0, ancho, alto);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen."))),
          "image/jpeg",
          0.85
        );
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}

export function EditProfileDialog({
  open,
  onOpenChange,
  usuario,
  onGuardar,
}: EditProfileDialogProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [avatar, setAvatar] = useState(usuario.avatar);
  const [avatarTipo, setAvatarTipo] = useState<TipoAvatar>(usuario.avatarTipo);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  function handleSeleccionarEmoji(emoji: string) {
    setAvatar(emoji);
    setAvatarTipo("emoji");
  }

  async function handleSubirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si hace falta reintentar
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Por favor, selecciona un archivo de imagen.");
      return;
    }

    setSubiendoFoto(true);
    try {
      const imagenRedimensionada = await redimensionarImagen(archivo, LADO_MAXIMO_PX);

      const supabase = crearClienteSupabaseNavegador();
      // Un archivo por usuario (sobreescribe siempre el mismo), en una
      // "carpeta" con su propio id -- así las políticas de Storage pueden
      // comprobar que cada uno solo toca la suya (ver el SQL que te paso).
      const ruta = `${usuario.id}/avatar.jpg`;
      const { error: errorSubida } = await supabase.storage
        .from(NOMBRE_BUCKET)
        .upload(ruta, imagenRedimensionada, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (errorSubida) {
        alert(`No se pudo subir la foto: ${errorSubida.message}`);
        return;
      }

      const { data } = supabase.storage.from(NOMBRE_BUCKET).getPublicUrl(ruta);
      // Cache-bust: si ya tenías una foto, el navegador podría seguir
      // mostrando la vieja porque la URL es la misma de siempre.
      setAvatar(`${data.publicUrl}?v=${Date.now()}`);
      setAvatarTipo("foto");
    } catch (e) {
      const error = e as Error;
      alert(`No se pudo procesar la foto: ${error.message}`);
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleGuardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const ok = await onGuardar(nombre.trim(), avatar, avatarTipo);
    setGuardando(false);
    if (ok) onOpenChange(false);
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
                // eslint-disable-next-line @next/next/no-img-element -- previsualización de imagen subida por el usuario (URL de Supabase Storage), no un asset estático
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
              disabled={subiendoFoto}
              onChange={handleSubirFoto}
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground file:transition-opacity hover:file:opacity-90 disabled:opacity-50"
            />
            {subiendoFoto && (
              <p className="mt-1 text-xs text-muted-foreground">Subiendo foto...</p>
            )}
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

          <GameButton onClick={handleGuardar} disabled={guardando || subiendoFoto} className="mt-2">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </GameButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
