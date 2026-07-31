// scripts/equipos/listaEquiposElegibles.ts
//
// Solo datos: la lista de nombres de equipos "elegibles" para el
// generador del 3x3. Vive en su propio archivo (sin lógica ni conexión
// a la BD) a propósito, para poder importarla desde varios scripts
// (marcarEquiposElegibles.ts, sync-escudos-equipos.ts...) sin que
// importar la lista dispare por accidente la ejecución de otro script.

export const EQUIPOS_ELEGIBLES: string[] = [
  // --- LaLiga ---
  "Real Madrid CF",
  "Barcelona FC",
  "Club Atlético de Madrid",
  "Sevilla FC",
  "Real Betis",
  "Valencia CF",
  "Athletic Club",
  "Real Sociedad",
  "Villarreal",
  "Getafe",
  "Celta de Vigo",
  "Girona FC",
  "Valladolid",

  // --- Premier League ---
  "Manchester United",
  "Manchester City",
  "Liverpool",
  "Chelsea",
  "Arsenal",
  "Tottenham Hotspur",
  "Newcastle United",
  "Aston Villa",
  "West Ham United",
  "Everton",
  "Fulham",
  "Crystal Palace",

  // --- Serie A ---
  "Juventus",
  "Inter Milan",
  "AC Milan",
  "Napoli",
  "Roma",
  "Lazio",
  "Atalanta",
  "Fiorentina",
  "Genoa",
  "Udinese",
  "Como",

  // --- Bundesliga ---
  "Bayern Munich",
  "Borussia Dortmund",
  "RB Leipzig",
  "Bayer Leverkusen",
  "Schalke 04",
  "Werder Bremen",
  "Vfb Stuttgart",
  "Vfl Wolfsburg",
  "TSG Hoffenheim",
  "Borussia Mönchengladbach",

  // --- Ligue 1 ---
  "Paris Saint-Germain",
  "Marseille",
  "Lyon",
  "Monaco",
  "Lille",
  "Rennes",
  "Nice",

  // --- Otros grandes conocidos ---
  "Ajax",
  "PSV",
  "Feyenoord",
  "Porto",
  "Benfica",
  "Sporting CP",
  "Celtic",
  "Rangers",
  "Galatasaray",
];