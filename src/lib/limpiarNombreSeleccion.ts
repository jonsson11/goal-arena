// src/lib/limpiarNombreSeleccion.ts
//
// Quita sufijos de categoría juvenil/olímpica de un nombre de selección,
// para quedarnos solo con el país. Cubre tanto el nombre oficial largo
// ("Italy national under-20 football team") como los alias abreviados
// que Wikipedia suele usar como texto visible del wikilink ("Italy U20",
// "Italy Under-20", "Italy Sub 20", "Italy Olympic"...).
export function limpiarNombreSeleccion(display: string): string {
  let resultado = display
    .replace(/\s+women'?s national (?:under-\d+ )?football team$/i, "")
    .replace(/\s+national under-\d+ football team$/i, "")
    .replace(/\s+national football team$/i, "")
    .trim();

  resultado = resultado
    .replace(/\s+u-?\d{1,2}$/i, "")
    .replace(/\s+under-?\s?\d{1,2}$/i, "")
    .replace(/\s+sub-?\s?\d{1,2}$/i, "")
    .replace(/\s+olympic(?:\s+team)?$/i, "")
    .trim();

  return resultado;
}