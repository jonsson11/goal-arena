// src/lib/wikipediaImagen.ts
//
// Obtiene la imagen principal de artículos de en.wikipedia.org vía la
// API de "pageimages" -- no hay que parsear el nombre de fichero del
// infobox a mano ni construir URLs de Wikimedia Commons, esta API ya
// resuelve todo eso y devuelve una URL directa y estable.
//
// Soporta lote (hasta 50 títulos por llamada, límite de la propia API),
// para no gastar una petición de red por jugador al hacer el backfill.

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const MAX_TITULOS_POR_LOTE = 50;

function trocear<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano));
  }
  return lotes;
}

type PaginaWikipedia = {
  title?: string;
  original?: { source?: string };
};

async function obtenerLote(titulos: string[]): Promise<Map<string, string>> {
  const url = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(
    titulos.join("|")
  )}&prop=pageimages&piprop=original&format=json&origin=*`;

  const res = await fetch(url, {
    headers: { "User-Agent": "GoalArena/0.1 (proyecto personal de aprendizaje)" },
  });
  if (!res.ok) return new Map();

  const data = await res.json();
  const paginas = data?.query?.pages as Record<string, PaginaWikipedia> | undefined;
  if (!paginas) return new Map();

  const resultado = new Map<string, string>();
  for (const pagina of Object.values(paginas)) {
    const titulo = pagina?.title;
    const src = pagina?.original?.source;
    if (titulo && src) resultado.set(titulo, src);
  }
  return resultado;
}

/**
 * Dado un array de títulos de en.wikipedia.org, devuelve un Map de
 * título -> URL de imagen, solo para los que tienen imagen. Los que no
 * tienen (o fallan) simplemente no aparecen en el Map.
 */
export async function obtenerImagenesWikipedia(titulos: string[]): Promise<Map<string, string>> {
  const lotes = trocear(titulos, MAX_TITULOS_POR_LOTE);
  const resultado = new Map<string, string>();

  for (const lote of lotes) {
    const parcial = await obtenerLote(lote);
    for (const [titulo, url] of parcial) resultado.set(titulo, url);
  }

  return resultado;
}

/** Atajo para un único título -- lo usa wikipediaSync.ts al sincronizar de uno en uno. */
export async function obtenerImagenWikipedia(titulo: string): Promise<string | null> {
  const mapa = await obtenerImagenesWikipedia([titulo]);
  return mapa.get(titulo) ?? null;
}