// src/lib/normalizarTexto.ts
//
// Letras que NO se descomponen en "base + diacrítico combinable" vía
// NFD -- a diferencia de "é" (que sí es "e" + acento y por eso el NFD de
// abajo lo resuelve solo), estas son letras propias en Unicode, sin
// forma descompuesta. Sin este mapa, "Sørloth" nunca aparecería
// buscando "Sorloth", ni "Đorđević" buscando "Dordevic".
//
// Las letras con caron (Č, Ć, Š, Ž, Ř...) NO hace falta incluirlas aquí
// -- esas sí se descomponen bien con NFD, ya funcionaban antes.
const SUSTITUCIONES_MANUALES: Record<string, string> = {
  ø: "o", Ø: "O",
  æ: "ae", Æ: "AE",
  œ: "oe", Œ: "OE",
  đ: "d", Đ: "D",
  ð: "d", Ð: "D",
  þ: "th", Þ: "TH",
  ł: "l", Ł: "L",
  ß: "ss",
  ı: "i", İ: "I",
};

function aplicarSustitucionesManuales(texto: string): string {
  return [...texto].map((c) => SUSTITUCIONES_MANUALES[c] ?? c).join("");
}

export function normalizarTexto(texto: string): string {
  return aplicarSustitucionesManuales(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "Mbappé" -> "Mbappe"
    .toLowerCase()
    .trim();
}