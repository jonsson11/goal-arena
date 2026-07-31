"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

/**
 * onClick para cualquier link/botón que lleve a "/jugar": si hay sesión,
 * deja que el <Link> navegue normal; si no, cancela la navegación y
 * manda a /login?redirect=/jugar en su lugar -- al loguearse (o
 * registrarse) se vuelve directo a /jugar en vez de al perfil de
 * siempre. Se usa tanto en el botón "Jugar ahora" de la Home
 * (HeroSection.tsx) como en el link "Jugar" del header (NavLinks.tsx).
 *
 * Mientras `cargando` es true (todavía no se sabe si hay sesión, justo
 * al cargar la app) se deja pasar la navegación normal -- es una
 * ventana muy corta y de momento no merece la pena bloquear el click
 * con un estado de carga para un caso tan raro de dar.
 */
export function useIrAJugar() {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  return function alClicarJugar(e: { preventDefault: () => void }) {
    if (cargando || usuario) return;
    e.preventDefault();
    router.push("/login?redirect=/jugar");
  };
}
