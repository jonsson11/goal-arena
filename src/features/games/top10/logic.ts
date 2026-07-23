import type { EntradaTop10 } from "./type";

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obtenerAliasesValidos(nombreCompleto: string): string[] {
  const partes = nombreCompleto.split(" ");
  const apellido = partes.slice(1).join(" "); // todo menos la primera palabra

  const aliases = [nombreCompleto];
  if (apellido) aliases.push(apellido);

  return aliases.map(normalizar);
}

export function coincideConEntrada(entrada: EntradaTop10, textoEscrito: string): boolean {
  const aliasesValidos = obtenerAliasesValidos(entrada.nombre);
  return aliasesValidos.includes(normalizar(textoEscrito));
}

export function buscarEntradaCoincidente(
  respuestas: EntradaTop10[],
  textoEscrito: string
): EntradaTop10 | null {
  return respuestas.find((entrada) => coincideConEntrada(entrada, textoEscrito)) ?? null;
}