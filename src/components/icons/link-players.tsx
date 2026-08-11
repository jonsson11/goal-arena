export function LinkPlayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Eslabón izquierdo */}
      <rect
        x="8"
        y="35"
        width="48"
        height="30"
        rx="15"
        stroke="#1D7A9C"
        strokeWidth="8"
        style={{ filter: "drop-shadow(0 0 6px rgba(29, 122, 156, 0.8))" }}
      />
      {/* Eslabón derecho, superpuesto en el centro para que se vean
          encadenados de verdad, no solo dos formas sueltas al lado. */}
      <rect
        x="44"
        y="35"
        width="48"
        height="30"
        rx="15"
        stroke="#4ADE9A"
        strokeWidth="8"
        style={{ filter: "drop-shadow(0 0 6px rgba(74, 222, 154, 0.8))" }}
      />
    </svg>
  );
}
