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
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  clearOnSelect?: boolean;
  className?: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 180;
const MAX_RESULTS = 8;


function esQueryCorta(q: string) {
  return normalizarTexto(q).length < MIN_CHARS;
}

function clubActual(jugador: Jugador) {
  return jugador.equipos[jugador.equipos.length - 1];
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

export function PlayerSearch({
  players,
  onSearch,
  onSelect,
  excludeNames = [],
  excludedLabel = "Ya colocado",
  hideExcluded = false,
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
    }
  }

  const showDropdown = isOpen && !esQueryCorta(query);

  return (
    <div ref={containerRef} onBlur={handleClickOutside} className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id="player-search-listbox"
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-popover shadow-lg"
        >
          {isLoading && (
            <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
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
              const codigoPais = obtenerCodigoPais(jugador.nacionalidad);
              const club = clubActual(jugador);
              const yaColocado = excludeSet.has(jugador.nombre);

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
                  className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                    yaColocado
                      ? "cursor-not-allowed opacity-80"
                      : `cursor-pointer ${index === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/50"}`
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                      yaColocado ? "bg-destructive/15" : "bg-secondary"
                    }`}
                  >
                    {club?.escudo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={club.escudo}
                        alt=""
                        className={`h-5 w-5 object-contain ${yaColocado ? "opacity-50 grayscale" : ""}`}
                      />
                    ) : codigoPais ? (
                      <span className={`fi fi-${codigoPais} ${yaColocado ? "opacity-50 grayscale" : ""}`} />
                    ) : (
                      <span className="text-xs font-semibold text-secondary-foreground">
                        {jugador.nombre[0]}
                      </span>
                    )}
                  </div>
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
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}