// scripts/probarImagenJugador.ts
//
// Prueba puntual: pide la imagen de UN título de Wikipedia y muestra
// exactamente qué devuelve la API. No toca la BD.
// Ejecutar con: npx tsx scripts/probarImagenJugador.ts "Titulo Del Jugador"

import "dotenv/config";
import { obtenerImagenWikipedia } from "../src/lib/wikipediaImagen";

async function main() {
  const titulo = process.argv[2];
  if (!titulo) {
    console.error('Uso: npx tsx scripts/probarImagenJugador.ts "Titulo Del Jugador"');
    process.exit(1);
  }

  console.log(`Consultando imagen para: "${titulo}"...`);
  const url = await obtenerImagenWikipedia(titulo);
  console.log("Resultado:", url ?? "null (sin imagen o fallo)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});