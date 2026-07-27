"use client";

import { PlayerSearch } from "@/features/games/shared/PlayerSearch";

export default function TestSearchPage() {
  return (
    <div className="max-w-md p-8">
      <PlayerSearch
        onSearch={async (query) => {
          const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Error al buscar jugadores");
          return res.json();
        }}
        onSelect={(jugador) => console.log("Seleccionado:", jugador)}
      />
    </div>
  );
}