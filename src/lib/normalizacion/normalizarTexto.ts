// src/lib/normalizacion/normalizarTexto.ts
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
    // Apóstrofes (rectos y curvos), guiones, puntos y espacios -- para que
    // dé igual cómo los escriba (o no) quien busca. Sin esto, "Eto'o" se
    // normalizaba a "eto'o" y buscar "Etoo" (sin apóstrofe, lo más
    // natural al teclear) no encontraba coincidencia -- "eto'o".includes
    // ("etoo") es false por ese único carácter de en medio. Quitar
    // también el espacio resuelve el mismo problema con apellidos con
    // guion: "Alexander-Arnold" y "Alexander Arnold" (con espacio en vez
    // de guion, lo más natural al escribirlo a mano) normalizan ahora
    // los dos a "alexanderarnold".
    .replace(/['\u2019\-.\s]/g, "")
    .toLowerCase()
    .trim();
}