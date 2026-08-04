// src/lib/moderacionNombre.ts
//
// Validación del nombre de usuario compartida entre el registro
// (POST /api/auth/register) y el cambio de nombre desde el perfil
// (PATCH /api/perfil) -- un único sitio para no acabar con dos listas de
// palabras prohibidas desincronizadas entre los dos endpoints.
//
// La comprobación no es solo "¿coincide exactamente con una palabra de la
// lista?" -- eso se salta con cualquier tontería ("p.u.t.a", "put4",
// "P U T A"). En vez de eso, se NORMALIZA el nombre (minúsculas, sin
// acentos, sin espacios/símbolos, sustituyendo los "leetspeak" más
// típicos: 4->a, 3->e, 1->i, 0->o, 5->s, @->a) y se busca la palabra
// prohibida DENTRO de ese texto normalizado. No es infalible (ningún
// filtro de palabras lo es), pero pilla la inmensa mayoría de los
// intentos obvios de saltárselo.

/** Nombres reservados: nadie puede registrarse ni cambiarse el nombre a
 * uno de estos, para que no se puedan hacer pasar por el equipo de Goal
 * Arena o por un puesto de autoridad dentro de la propia app. */
const PALABRAS_RESERVADAS = [
  "admin",
  "administrador",
  "administrators",
  "administrator",
  "moderador",
  "moderator",
  "mod",
  "goalarena",
  "goal-arena",
  "goal_arena",
  "soporte",
  "support",
  "staff",
  "root",
  "sistema",
  "system",
  "oficial",
  "official",
  "null",
  "undefined",
];

/** Insultos, palabrotas y términos de odio más habituales a bloquear en un
 * nombre de usuario. No pretende ser exhaustiva -- es una primera pasada
 * con lo más común en español (con algo de latino) e inglés; se amplía
 * añadiendo una palabra por línea, en minúsculas y sin acentos (la
 * normalización ya se encarga de quitarle los acentos al nombre real
 * antes de comparar, así que aquí no hacen falta). */
const PALABRAS_PROHIBIDAS = [
  // Malsonantes / sexuales
  "puta",
  "puto",
  "putos",
  "putas",
  "hijoputa",
  "hijueputa",
  "hdp",
  "gilipollas",
  "gilipoyas",
  "cabron",
  "cabrona",
  "coño",
  "cono",
  "polla",
  "pollas",
  "verga",
  "chingar",
  "chingada",
  "mamahuevo",
  "mamaguevo",
  "follar",
  "folladores",
  "mierda",
  "mierdas",
  "joder",
  "capullo",
  "pendejo",
  "pendeja",
  "culero",
  "cabronazo",
  // Insultos / capacidad
  "subnormal",
  "retrasado",
  "retrasada",
  "imbecil",
  "gilipollo",
  "maricon",
  "marica",
  "zorra",
  "guarra",
  "putona",
  // Odio / discriminación (formas más comunes)
  "sudaca",
  "negrata",
  "puto moro",
  "muerteajudios",
  "nazi",
  "hitler",
  // Inglés, por si acaso
  "fuck",
  "fucker",
  "shit",
  "bitch",
  "asshole",
  "nigger",
  "nigga",
  "faggot",
  "cunt",
  "whore",
];

const SUSTITUCIONES_LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

/** minúsculas, sin acentos, sin espacios/símbolos, con el leetspeak más
 * típico revertido -- así "P.4pu7@" y "papu-ta" normalizan igual que
 * "paputa" y se comparan sin sorpresas. */
function normalizar(texto: string): string {
  const sinAcentos = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const sinLeet = sinAcentos
    .split("")
    .map((caracter) => SUSTITUCIONES_LEET[caracter] ?? caracter)
    .join("");

  return sinLeet.replace(/[^a-z0-9]/g, "");
}

export type ResultadoValidacionNombre = { valido: true } | { valido: false; error: string };

/** Valida un nombre de usuario: longitud razonable y ausencia de palabras
 * reservadas/prohibidas (con la normalización de arriba). No valida
 * unicidad -- eso sigue siendo cosa de cada endpoint, que sí tiene acceso
 * a la base de datos. */
export function validarNombreUsuario(nombreCrudo: string): ResultadoValidacionNombre {
  const nombre = nombreCrudo.trim();

  if (nombre.length < 3) {
    return { valido: false, error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }
  if (nombre.length > 20) {
    return { valido: false, error: "El nombre de usuario no puede tener más de 20 caracteres." };
  }

  const normalizado = normalizar(nombre);

  for (const palabra of PALABRAS_RESERVADAS) {
    if (normalizado === normalizar(palabra)) {
      return { valido: false, error: "Ese nombre de usuario está reservado y no se puede usar." };
    }
  }

  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (normalizado.includes(normalizar(palabra))) {
      return { valido: false, error: "Ese nombre de usuario no está permitido." };
    }
  }

  return { valido: true };
}
