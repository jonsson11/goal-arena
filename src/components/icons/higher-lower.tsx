export function HigherLowerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Flecha izquierda, apuntando hacia arriba */}
      <path
        d="M30 15 L42 40 H36 V85 H24 V40 H18 Z"
        fill="#4ADE9A"
        style={{ filter: "drop-shadow(0 0 6px rgba(74, 222, 154, 0.8))" }}
      />

      {/* Flecha derecha, apuntando hacia abajo */}
      <path
        d="M70 85 L82 60 H76 V15 H64 V60 H58 Z"
        fill="#EF4444"
        style={{ filter: "drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))" }}
      />
    </svg>
  );
}