export const BANDERAS: Record<string, string> = {
  España: "🇪🇸",
  Argentina: "🇦🇷",
  Francia: "🇫🇷",
  Brasil: "🇧🇷",
  Alemania: "🇩🇪",
};

export function obtenerBandera(nacionalidad: string): string {
  return BANDERAS[nacionalidad] ?? "🏳️";
}