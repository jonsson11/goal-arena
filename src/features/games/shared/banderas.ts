export const CODIGOS_PAIS: Record<string, string> = {
  España: "es",
  Argentina: "ar",
  Francia: "fr",
  Brasil: "br",
  Alemania: "de",
};

export function obtenerCodigoPais(nacionalidad: string): string | null {
  return CODIGOS_PAIS[nacionalidad] ?? null;
}