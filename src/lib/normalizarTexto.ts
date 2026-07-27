// src/lib/normalizarTexto.ts
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "Mbappé" -> "Mbappe"
    .toLowerCase()
    .trim();
}