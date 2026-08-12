// src/features/games/shared/PlayerSearch.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import type { Jugador } from "./types";
import { obtenerCodigoPais } from "./banderas";
import { normalizarTexto } from "@/lib/normalizacion/normalizarTexto";

interface PlayerSearchProps {
  players?: Jugador[];
  onSearch?: (query: string) => Promise<Jugador[]>;
  onSelect: (jugador: Jugador) => void;
  /** Nombres a marcar como ya usados/colocados. */
  excludeNames?: string[];
  /** Etiqueta que se muestra sobre los jugadores excluidos. */
  excludedLabel?: string;
  /**
   * Si es true, los jugadores de `excludeNames` desaparecen de los
   * resultados en vez de mostrarse en rojo y deshabilitados.
   * Por defecto false (se muestran marcados).
   */
  hideExcluded?: boolean;
  /**
   * Si es true, cada resultado enseña debajo del nombre un resumen de las
   * etapas del jugador (club + años, ej. "Porto (2017-2018) · Man Utd
   * (2018-actualidad)") -- añadido el 12/08/2026 a petición del usuario
   * para LinkPlayers: buscar el siguiente jugador intermedio "a ciegas"
   * (sin ver su carrera) le resultaba muy difícil. Por defecto false para
   * no cambiar el resto de juegos (Top10, Grid) que ya usan este mismo
   * componente. Requiere que `Jugador.equipos[].desde/hasta` vengan
   * rellenos (ver /api/jugadores/buscar) -- si no, simplemente no se
   * enseña nada para ese jugador.
   */
  mostrarEtapas?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  clearOnSelect?: boolean;
  className?: string;
}

// Resumen compacto de las etapas de un jugador para la pista bajo su
// nombre -- no fusiona etapas consecutivas del mismo club como sí hace
// LinkPlayers en las tarjetas de inicio/final (ver grafoJugadores.
// server.ts): aquí es solo una pista rápida mientras se busca, no hace
// falta la misma precisión, y fusionar obligaría a mandar más datos
// crudos (fechas completas) en cada resultado de búsqueda.
function resumenEtapas(jugador: Jugador): string | null {
  const conAnios = jugador.equipos.filter((e) => e.desde);
  if (conAnios.length === 0) return null;
  return conAnios.map((e) => `${e.nombre} (${e.desde}-${e.hasta})`).join(" · ");
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 180;
const MAX_RESULTS = 8;

function esQueryCorta(q: string) {
  return normalizarTexto(q).length < MIN_CHARS;
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + ultima).toUpperCase();
}

// Deja los excluidos al final de la lista, sin tocar el orden relativo
// del resto — así lo primero que ve el usuario son opciones disponibles.
function ordenarExcluidosAlFinal(lista: Jugador[], excludeSet: Set<string>): Jugador[] {
  return [...lista].sort((a, b) => {
    const aExcluido = excludeSet.has(a.nombre) ? 1 : 0;
    const bExcluido = excludeSet.has(b.nombre) ? 1 : 0;
    return aExcluido - bExcluido;
  });
}

/** Avatar del jugador: foto si existe, si no iniciales sobre degradado.
 *  La bandera de nacionalidad va siempre como insignia superpuesta
 *  en la esquina inferior derecha (con imagen real, no solo texto). */
function AvatarJugador({ jugador, apagado }: { jugador: Jugador; apagado: boolean }) {
  const codigoPais = obtenerCodigoPais(jugador.nacionalidad);
  const [errorImagen, setErrorImagen] = useState(false);
  const mostrarFoto = jugador.imagenUrl && !errorImagen;

  return (
    <div className="relative h-9 w-9 shrink-0">
      <div
        className={`h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/10 ${
          apagado ? "grayscale opacity-50" : ""
        } ${mostrarFoto ? "bg-secondary" : "bg-gradient-to-br from-secondary to-primary/60"}`}
      >
        {mostrarFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={jugador.imagenUrl!}
            alt=""
            className="h-full w-full object-cover object-top"
            onError={() => setErrorImagen(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-secondary-foreground">
            {iniciales(jugador.nombre)}
          </span>
        )}
      </div>

      {codigoPais && (
        <span
          className={`fi fi-${codigoPais} absolute -bottom-0.5 -right-0.5 h-3.5 w-5 rounded-[3px] shadow-[0_0_0_2px_var(--popover)] ${
            apagado ? "opacity-50 grayscale" : ""
          }`}
          title={jugador.nacionalidad}
        />
      )}
    </div>
  );
}

export function PlayerSearch({
  players,
  onSearch,
  onSelect,
  excludeNames = [],
  excludedLabel = "Ya colocado",
  hideExcluded = false,
  mostrarEtapas = false,
  placeholder = "Buscar jugador...",
  disabled = false,
  autoFocus = false,
  clearOnSelect = true,
  className = "",
}: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Jugador[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const excludeSet = useMemo(() => new Set(excludeNames), [excludeNames]);

  const searchLocal = useCallback(
    (q: string): Jugador[] => {
      if (!players) return [];
      const nq = normalizarTexto(q);
      const coincidencias = players.filter((j) => normalizarTexto(j.nombre).includes(nq));
      const visibles = hideExcluded
        ? coincidencias.filter((j) => !excludeSet.has(j.nombre))
        : coincidencias;
      return ordenarExcluidosAlFinal(visibles, excludeSet).slice(0, MAX_RESULTS);
    },
    [players, excludeSet, hideExcluded]
  );

  function cancelarBusquedaPendiente() {
    requestIdRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsLoading(false);
  }

  function ejecutarBusqueda(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!onSearch) {
      setResults(searchLocal(q));
      setHighlightedIndex(0);
      return;
    }

    setIsLoading(true);
    const currentRequestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await onSearch(q);
        if (currentRequestId !== requestIdRef.current) return;
        const visibles = hideExcluded
          ? data.filter((j) => !excludeSet.has(j.nombre))
          : data;
        setResults(ordenarExcluidosAlFinal(visibles, excludeSet).slice(0, MAX_RESULTS));
        setHighlightedIndex(0);
      } catch (err) {
        console.error("PlayerSearch: fallo al buscar jugadores", err);
        if (currentRequestId === requestIdRef.current) setResults([]);
      } finally {
        if (currentRequestId === requestIdRef.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setIsOpen(true);

    if (esQueryCorta(value)) {
      cancelarBusquedaPendiente();
      setResults([]);
      setHighlightedIndex(0);
      return;
    }

    ejecutarBusqueda(value.trim());
  }

  function handleClear() {
    cancelarBusquedaPendiente();
    setQuery("");
    setResults([]);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }

  function handleSelect(jugador: Jugador) {
    onSelect(jugador);
    setIsOpen(false);
    if (clearOnSelect) {
      cancelarBusquedaPendiente();
      setQuery("");
      setResults([]);
      setHighlightedIndex(0);
    }
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const jugador = results[highlightedIndex];
      if (jugador && !excludeSet.has(jugador.nombre)) handleSelect(jugador);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleClickOutside(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
      setIsFocused(false);
    }
  }

  const showDropdown = isOpen && !esQueryCorta(query);

  return (
    <div ref={containerRef} onBlur={handleClickOutside} className={`relative w-full ${className}`}>
      <div
        className={`relative rounded-2xl transition-shadow duration-300 ${
          isFocused
            ? "shadow-[0_0_0_3px_rgba(74,222,154,0.18),0_8px_30px_-12px_rgba(74,222,154,0.35)]"
            : "shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)]"
        }`}
      >
        <Search
          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
            isFocused ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="player-search-listbox"
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            setIsFocused(true);
          }}
          onKeyDown={handleKeyDown}
          className={`h-12 w-full rounded-2xl border bg-card/60 pl-11 pr-10 text-base text-foreground placeholder:text-muted-foreground outline-none backdrop-blur-md transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${
            isFocused ? "border-primary/60" : "border-white/10 hover:border-white/20"
          }`}
        />
        {isLoading ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        ) : (
          query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {showDropdown && (
        <ul
          id="player-search-listbox"
          role="listbox"
          className="animate-in fade-in slide-in-from-top-2 absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-white/10 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl duration-150"
        >
          {isLoading && (
            <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Buscando...
            </li>
          )}

          {!isLoading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No se encontraron jugadores.
            </li>
          )}

          {!isLoading &&
            results.map((jugador, index) => {
              const yaColocado = excludeSet.has(jugador.nombre);
              const etapasTexto = mostrarEtapas && !yaColocado ? resumenEtapas(jugador) : null;

              return (
                <li
                  key={jugador.nombre}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  aria-disabled={yaColocado}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (yaColocado) return;
                    handleSelect(jugador);
                  }}
                  className={`flex gap-3 rounded-xl px-2.5 py-2 transition-colors ${
                    etapasTexto ? "items-start" : "items-center"
                  } ${
                    yaColocado
                      ? "cursor-not-allowed opacity-80"
                      : `cursor-pointer ${
                          index === highlightedIndex
                            ? "bg-primary/10 ring-1 ring-primary/25"
                            : "hover:bg-white/5"
                        }`
                  }`}
                >
                  <AvatarJugador jugador={jugador} apagado={yaColocado} />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        yaColocado ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {jugador.nombre}
                    </p>
                    {yaColocado && (
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-destructive">
                        {excludedLabel}
                      </p>
                    )}
                    {etapasTexto && (
                      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{etapasTexto}</p>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}