"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

/**
 * onClick para cualquier link/botón que lleve a una ruta que requiere
 * sesión (/jugar, /multijugador...): si hay sesión, deja que el <Link>
 * navegue normal; si no, cancela la navegación y manda a
 * /login?redirect=<destino> en su lugar -- al loguearse (o registrarse)
 * se vuelve directo a esa ruta en vez de al perfil de siempre.
 *
 * Generalizado el 06/08/2026 (antes era useIrAJugar, fijo a "/jugar") al
 * añadir el link de Multijugador al header y a la Home: los dos
 * necesitaban el mismo gate, pero cada uno con su propio destino de
 * vuelta -- con la versión anterior, pulsar "Multijugador" sin sesión
 * habría mandado de vuelta a /jugar tras loguearse, no a /multijugador.
 *
 * Mientras `cargando` es true (todavía no se sabe si hay sesión, justo
 * al cargar la app) se deja pasar la navegación normal -- es una
 * ventana muy corta y de momento no merece la pena bloquear el click
 * con un estado de carga para un caso tan raro de dar.
 */
export function useIrA(destino: string) {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  return function alClicar(e: { preventDefault: () => void }) {
    if (cargando || usuario) return;
    e.preventDefault();
    router.push(`/login?redirect=${destino}`);
  };
}