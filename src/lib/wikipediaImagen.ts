// src/lib/wikipediaImagen.ts
//
// Obtiene la imagen principal de artículos de en.wikipedia.org vía la
// REST API de "resumen de página" (la misma que usa Wikipedia para las
// vistas previas al pasar el ratón por un enlace). Se cambió desde la
// vieja action=query&prop=pageimages porque, en pruebas reales, esa vía
// devolvía sin imagen a jugadores que claramente sí la tienen (Gavi,
// Koke, Ederson...) sin ningún error explícito -- la REST API resultó
// fiable en las mismas pruebas.
//
// La contrapartida: no admite lotes, es una petición por título -- hay
// que ser cuidadoso con el ritmo para no chocar con el límite de
// peticiones (ya lo hemos visto devolver 429 con Retry-After).

const REST_API_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary";
const PAUSA_ENTRE_PETICIONES_MS = 2500;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type ResultadoImagenPagina = {
  imagenUrl: string | null;
  esDesambiguacion: boolean;
};

export async function obtenerImagenYEstado(titulo: string, reintento = 0): Promise<ResultadoImagenPagina> {
  const url = `${REST_API_BASE}/${encodeURIComponent(titulo.replace(/ /g, "_"))}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "GoalArena/0.1 (proyecto personal de aprendizaje)" },
    });
  } catch (e) {
    console.warn(`    ⚠ Error de red pidiendo imagen de "${titulo}":`, e);
    return { imagenUrl: null, esDesambiguacion: false };
  }

  if (res.status === 404) {
    return { imagenUrl: null, esDesambiguacion: false };
  }

  if (res.status === 429 || res.status >= 500) {
    if (reintento < 4) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const esperaSegundos = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
      const espera =
        esperaSegundos && !Number.isNaN(esperaSegundos) ? esperaSegundos * 1000 : 8000 * (reintento + 1);

      console.warn(
        `    … Wikipedia devolvió ${res.status} para "${titulo}", esperando ${espera / 1000}s y reintentando (${reintento + 1}/4)`
      );
      await esperar(espera);
      return obtenerImagenYEstado(titulo, reintento + 1);
    }
    console.warn(`    ✗ Wikipedia sigue devolviendo ${res.status} para "${titulo}" tras 4 intentos.`);
    return { imagenUrl: null, esDesambiguacion: false };
  }

  if (!res.ok) {
    console.warn(`    ✗ Wikipedia respondió ${res.status} para "${titulo}"`);
    return { imagenUrl: null, esDesambiguacion: false };
  }

  const data = await res.json();

  return {
    imagenUrl: data?.originalimage?.source ?? data?.thumbnail?.source ?? null,
    esDesambiguacion: data?.type === "disambiguation",
  };
}

/** Atajo para wikipediaSync.ts: sincroniza de uno en uno, ya con el título resuelto por las 4 estrategias de búsqueda. */
export async function obtenerImagenWikipedia(titulo: string): Promise<string | null> {
  const resultado = await obtenerImagenYEstado(titulo);
  return resultado.imagenUrl;
}

/** Pide imágenes de una lista de títulos, uno a uno, respetando el ritmo entre peticiones. Usado por el script de backfill. */
export async function obtenerImagenesSecuencial(
  titulos: string[],
  onResultado: (titulo: string, resultado: ResultadoImagenPagina) => void | Promise<void>
): Promise<void> {
  for (let i = 0; i < titulos.length; i++) {
    const resultado = await obtenerImagenYEstado(titulos[i]);
    await onResultado(titulos[i], resultado);
    if (i < titulos.length - 1) await esperar(PAUSA_ENTRE_PETICIONES_MS);
  }
}