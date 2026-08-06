"use client";

// Stub deliberado, mismo criterio que se usó con Higher or Lower cuando su
// lógica todavía no estaba lista: mejor un aviso claro de "en
// construcción" que dejar que la sala llegue hasta aquí y no pase nada, o
// peor, que crashee. La partida sincronizada de verdad (tablero
// compartido, timer, progreso en vivo del rival...) es la Fase 2 del
// multijugador, pendiente de implementar.

import { use } from "react";
import { useRouter } from "next/navigation";
import { GameButton } from "@/features/games/shared/GameButton";

export default function PartidaMultijugadorPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const router = useRouter();

  async function salir() {
    await fetch(`/api/salas/${codigo}/salir`, { method: "POST" });
    router.push("/multijugador");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
        En construcción
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
        ¡La sala ha empezado!
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        La partida sincronizada en directo (tablero compartido, tiempo compartido y progreso de tus
        rivales en vivo) todavía se está construyendo. Vuelve pronto.
      </p>
      <GameButton onClick={salir} className="mt-2">
        Volver a Multijugador
      </GameButton>
    </div>
  );
}