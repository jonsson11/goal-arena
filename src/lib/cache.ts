// src/lib/cache.ts
//
// SOLO SERVIDOR. Caché en memoria muy simple, con caducidad por tiempo --
// pensada para datos que cambian poco (el catálogo de jugadores/equipos,
// básicamente estático salvo cuando se ejecuta un script de sync) pero se
// piden mucho (una vez por cada tecla en el buscador, una vez por cada
// casilla que se marca en el 3x3). Sin esto, cada una de esas peticiones
// iba a la base de datos entera desde cero -- era la causa principal de
// la lentitud reportada tanto en el buscador como al colocar un jugador
// en el tablero (07/08/2026).
//
// OJO: esta caché vive en la memoria del proceso de Node -- en un entorno
// serverless (Vercel) cada "función" puede tener su propia instancia, así
// que no es una caché compartida de verdad entre todas las peticiones del
// mundo, pero SÍ evita repetir el trabajo dentro de una misma instancia
// caliente (que en la práctica es la mayoría de peticiones seguidas de un
// mismo usuario jugando). Si algún día hace falta invalidar al instante
// de verdad (p. ej. justo después de ejecutar un script de sync), hay que
// pasar a algo compartido de verdad (Redis) -- de momento basta con
// esperar a que caduque el TTL, los datos de jugadores no cambian tan a
// menudo como para que importe un margen de unos minutos.

const cache = new Map<string, { valor: unknown; expiraEn: number }>();

export async function conCache<T>(clave: string, ttlMs: number, construir: () => Promise<T>): Promise<T> {
  const entrada = cache.get(clave);
  if (entrada && entrada.expiraEn > Date.now()) {
    return entrada.valor as T;
  }

  const valor = await construir();
  cache.set(clave, { valor, expiraEn: Date.now() + ttlMs });
  return valor;
}