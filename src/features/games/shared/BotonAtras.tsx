// src/features/games/shared/BotonAtras.tsx
//
// Mismo estilo visual que el botón "Atrás" de GameLauncher.tsx (que a su
// vez copia el botón "Iniciar sesión" del navbar) -- un solo estilo de
// botón "volver" reconocible en toda la app. Vivía en features/multijugador
// (donde nació, 06/08/2026), movido aquí el mismo día al empezar a
// usarse también en /jugar -- ya no es propio del multijugador, es
// genérico para cualquier pantalla de juego. No se reutiliza el de
// GameLauncher directamente porque ese lleva enganchada su animación de
// entrada escalonada (launcher-entrada + conRetraso), específica de esa
// pantalla.
//
// Sin margen propio a propósito (antes tenía mb-4/mb-8): ahora lo usa
// sobre todo TituloPagina.tsx, que lo posiciona con `absolute` en la
// misma fila que el título -- un margen aquí no haría nada útil ahí y
// solo estorbaría si algún día se usa suelto en otro sitio.
//
// Círculo sin texto en móvil, píldora "< Atrás" a partir de `sm:`
// (07/08/2026) -- la versión con texto, al vivir pegada al margen
// izquierdo justo a la altura del título (ver TituloPagina.tsx), en
// pantallas estrechas llegaba a solaparse con el propio título si este
// era largo. Un círculo pequeño con solo la flecha ocupa mucho menos
// ancho y es un patrón de vuelta-atrás igual de reconocible en móvil
// (el `aria-label` mantiene el texto "Atrás" para lectores de pantalla,
// aunque visualmente ya no aparezca).
//
// OJO con `inline-flex` (no `flex` a secas): el círculo usa `w-9`
// (ancho fijo) en móvil, pero en `sm:` pasa a `w-auto` para que la
// píldora se ajuste a su propio texto -- con `flex` normal, un elemento
// de ancho automático que además está en flujo normal (no absoluto) se
// ESTIRA para ocupar todo el ancho disponible del contenedor (es una
// caja de bloque por debajo), así que en escritorio salía una barra
// verde de pantalla completa en vez de una píldora pequeña. `inline-flex`
// se ajusta a su contenido igual que cualquier elemento en línea. Este
// mismo bug se coló también en GameLauncher.tsx, que tiene su propia
// copia de este botón -- corregido ahí también (07/08/2026).

import Link from "next/link";

export function BotonAtras({ href, className = "" }: { href: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label="Atrás"
      className={`z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-md sm:px-4 sm:py-2 sm:text-sm sm:font-semibold ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">Atrás</span>
    </Link>
  );
}