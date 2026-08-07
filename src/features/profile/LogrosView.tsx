// src/features/profile/LogrosView.tsx
//
// Pestaña "Logros" del Perfil. Agrupa el catálogo por categoría (mismo
// orden en que aparecen en LOGROS -- ya vienen agrupados de ahí, así que
// basta con recorrer y detectar cuándo cambia la categoría) y pinta cada
// logro como una insignia tocable -- tocarla abre LogroDetailDialog con
// el detalle real y, si toca, el botón de reclamar.

"use client";

import { useEffect, useState } from "react";
import {
  Star, UserPlus, Swords, Grid3x3, ListOrdered, Flame, Zap, Target, Trophy, Compass, Medal,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useLogrosReclamables } from "./LogrosReclamablesContext";
import { LogroInsignia } from "./LogroInsignia";
import { LogroDetailDialog } from "./LogroDetailDialog";
import { NOMBRE_CATEGORIA, ICONO_POR_CATEGORIA, type CategoriaLogro, type LogroConProgreso } from "@/lib/logros";
import type { RespuestaPartida } from "@/lib/experiencia";

const COMPONENTE_POR_ICONO: Record<string, LucideIcon> = {
  Star, UserPlus, Swords, Grid3x3, ListOrdered, Flame, Zap, Target, Trophy, Compass, Medal,
};

function agruparPorCategoria(logros: LogroConProgreso[]): { categoria: CategoriaLogro; logros: LogroConProgreso[] }[] {
  const grupos: { categoria: CategoriaLogro; logros: LogroConProgreso[] }[] = [];
  for (const logro of logros) {
    const grupoActual = grupos[grupos.length - 1];
    if (grupoActual?.categoria === logro.categoria) {
      grupoActual.logros.push(logro);
    } else {
      grupos.push({ categoria: logro.categoria, logros: [logro] });
    }
  }
  return grupos;
}

export function LogrosView() {
  const { refrescarUsuario } = useAuth();
  const { setCount: setLogrosReclamables } = useLogrosReclamables();
  const [logros, setLogros] = useState<LogroConProgreso[] | null>(null);
  const [logroAbierto, setLogroAbierto] = useState<LogroConProgreso | null>(null);

  useEffect(() => {
    fetch("/api/perfil/logros")
      .then((res) => (res.ok ? res.json() : null))
      .then((datos) => setLogros(datos?.logros ?? []))
      .catch(() => setLogros([]));
  }, []);

  function alReclamar(logroId: string, respuesta: RespuestaPartida) {
    setLogros((actuales) =>
      (actuales ?? []).map((l) =>
        l.id === logroId
          ? { ...l, estado: "reclamado", expGanada: respuesta.expGanada, reclamadoEn: new Date().toISOString() }
          : l
      )
    );
    refrescarUsuario();
    setLogrosReclamables((n) => n - 1);
  }

  useEffect(() => {
    if (!logroAbierto || !logros) return;
    const actualizado = logros.find((l) => l.id === logroAbierto.id);
    if (actualizado && actualizado.estado !== logroAbierto.estado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el diálogo abierto con la lista tras reclamar, patrón esperado
      setLogroAbierto(actualizado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logros]);

  if (logros === null) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando logros...</p>;
  }

  const grupos = agruparPorCategoria(logros);
  const totalReclamados = logros.filter((l) => l.estado === "reclamado").length;

  return (
    <div className="flex flex-col gap-7">
      <p className="text-center text-sm text-muted-foreground">
        {totalReclamados} / {logros.length} logros reclamados
      </p>

      {grupos.map((grupo) => {
        const IconoCategoria = COMPONENTE_POR_ICONO[ICONO_POR_CATEGORIA[grupo.categoria]] ?? Star;
        return (
          <div key={grupo.categoria} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <IconoCategoria className="h-4 w-4 text-muted-foreground" />
              {NOMBRE_CATEGORIA[grupo.categoria]}
            </h3>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {grupo.logros.map((logro) => (
                <button
                  key={logro.id}
                  onClick={() => setLogroAbierto(logro)}
                  title={logro.nombre}
                  className="shrink-0 touch-manipulation transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <LogroInsignia logro={logro} />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <LogroDetailDialog
        logro={logroAbierto}
        onOpenChange={(open) => !open && setLogroAbierto(null)}
        onReclamado={alReclamar}
      />
    </div>
  );
}