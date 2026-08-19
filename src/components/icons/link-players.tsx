// Antes cada eslabón llevaba un color fijo a fuego (#1D7A9C / #4ADE9A) en
// vez de `currentColor` -- se veía bien suelto sobre el fondo oscuro
// original, pero en cuanto el icono empezó a colocarse dentro de una
// insignia de color sólido (la cabecera de las tarjetas de /jugar tras
// el rediseño "lomo de color", o el selector de /multijugador/crear) el
// eslabón teal quedaba prácticamente invisible sobre un fondo... teal
// (mismo color encima de sí mismo). `currentColor` en los dos + una
// opacidad distinta entre eslabones (para que se sigan viendo como dos
// aros encadenados, no una sola forma) hace que el icono se adapte
// siempre al color de texto de donde se use -- igual que ya hacían
// GridIcon y PodiumIcon.
export function LinkPlayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Eslabón izquierdo */}
      <rect x="8" y="35" width="48" height="30" rx="15" stroke="currentColor" strokeWidth="8" opacity="0.55" />
      {/* Eslabón derecho, superpuesto en el centro para que se vean
          encadenados de verdad, no solo dos formas sueltas al lado. */}
      <rect x="44" y="35" width="48" height="30" rx="15" stroke="currentColor" strokeWidth="8" />
    </svg>
  );
}
