"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicProfileView } from "@/features/social/PublicProfileView";
import type { Amigo } from "@/features/social/type";

export default function PerfilPublicoPage() {
  const params = useParams<{ usuario: string }>();
  const [amigo, setAmigo] = useState<Amigo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/usuarios/${encodeURIComponent(params.usuario)}`)
      .then((res) => res.json())
      .then((datos) => setAmigo(datos.usuario ?? null))
      .catch(() => setAmigo(null))
      .finally(() => setCargando(false));
  }, [params.usuario]);

  if (cargando) {
    return <p className="p-10 text-center text-muted-foreground">Cargando...</p>;
  }

  if (!amigo) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        No se ha encontrado a ese usuario.
      </p>
    );
  }

  return <PublicProfileView amigo={amigo} />;
}
