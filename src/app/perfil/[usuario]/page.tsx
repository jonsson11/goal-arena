"use client";

import { useParams } from "next/navigation";
import { amigosIniciales } from "@/features/social/data";
import { PublicProfileView } from "@/features/social/PublicProfileView";

export default function PerfilPublicoPage() {
  const params = useParams<{ usuario: string }>();

  const amigo = amigosIniciales.find(
    (a) => a.nombre.toLowerCase() === params.usuario.toLowerCase()
  );

  if (!amigo) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        No se ha encontrado a ese usuario.
      </p>
    );
  }

  return <PublicProfileView amigo={amigo} />;
}