// scripts/jugadores/syncPlayers.ts
//
// Sincroniza una lista de jugadores concreta, escrita a mano.
// Ejecutar con: npx tsx scripts/jugadores/syncPlayers.ts
//
// Cada entrada de JUGADORES_INICIALES puede ser:
//   - un string con el nombre  -> búsqueda automática con las 4 estrategias
//   - un objeto { nombre, url } -> va directo a esa URL de Wikipedia,
//     sin búsqueda. Usar cuando el nombre no se detecta automáticamente.
//     La URL debe ser de en.wikipedia.org (ver aviso en wikipediaSync.ts).
//
// Antes de sincronizar cada entrada, comprueba si el jugador YA está en
// la BD y, si es así, lo salta sin gastar peticiones de red:
//   - Si la entrada tiene `url`: comprueba por externalId exacto
//     (derivado de esa URL) -- fiable al 100%.
//   - Si la entrada es solo un nombre: comprueba por `nombre` exacto en
//     la BD -- funciona bien en el caso normal, pero si ese jugador se
//     guardó bajo un título distinto al que escribes aquí (por
//     desambiguación), no lo detectará como existente y lo volverá a
//     sincronizar. No hace daño (el upsert lo actualiza, no lo duplica),
//     solo gasta una llamada de más.

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../../src/lib/scraping/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type EntradaJugador = string | { nombre: string; url: string };

//
//  { nombre: "", url: "" },
const JUGADORES_INICIALES: EntradaJugador[] = [
  "Sébastien Corchia",
  {nombre:"Júlio César", url:"https://en.wikipedia.org/wiki/J%C3%BAlio_C%C3%A9sar_(football_goalkeeper,_born_1979)"},
  "Nicolás Gaitán",
  "Tiago Mendes",
  "Morgan De Sanctis",
  "José Sosa",
  "Christian Ziege",
  "Samir Nasri",
  "Stefan Savić",
  "Alan Ball",
  "Gordon Banks",
  "Geoff Hurst",
  "Nobby Stiles",
  "Martin Peters",
  "Uwe Seeler",
  "Wolfgang Overath",
  "Gianni Rivera",
  "Sandro Mazzola",
  "Giacinto Facchetti",
  "Tarcisio Burgnich",
  "Amancio Amaro",
  "Lev Yashin",
  "Josip Skoblar",
  "Ademir da Guia",
  "Johnny Rep",
  "Wim Suurbier",
  "Ruud Krol",
  "Piet Keizer",
  "Arie Haan",
  "Rob Rensenbrink",
  "Roberto Boninsegna",
  "Fabio Capello",
  "Romeo Benetti",
  "Marco Tardelli",
  "Bruno Conti",
  "Antonio Cabrini",
  "Claudio Gentile",
  "Gaetano Scirea",
  "Roberto Bettega",
  "Franco Causio",
  "Zbigniew Boniek",
  "Bernard Lacombe",
  "Didier Six",
  "Hans-Georg Schwarzenbeck",
  "Bernd Hölzenbein",
  "Berti Vogts",
  "Rainer Bonhof",
  "Horst Hrubesch",
  "Pierre Littbarski",
  "Felix Magath",
  "Klaus Allofs",
  "Thomas Häßler",
  "Ulf Kirsten",
  "Sebastian Deisler",
  "Michel Salgado",
  "Rafael Alkorta",
  "Abelardo Fernández",
  "Miguel Ángel Nadal",
  "José Mari Bakero",
  "Txiki Begiristain",
  "Julen Guerrero",
  "Gaizka Mendieta",
  "Iván Campo",
  "Mikel Lasa",
  "Joseba Etxeberria",
  "Ismael Urzaiz",
  "José Mari Romero",
  "Antonio López",
  "Roberto Ríos",
  "Rubén Baraja",
  "Phillip Cocu",
  "Dirk Kuyt",
  "Khalid Boulahrouz",
  "Brian Laudrup",
  "Preben Elkjær",
  "Morten Olsen",
  "Allan Simonsen",
  "Frank Arnesen",
  "Jesper Olsen",
  "Brian Steen Nielsen",
  "Marc Rieper",
  "Daniel Agger",
  "Kasper Schmeichel",
  "Fredrik Ljungberg",
  "Tomas Brolin",
  "Martin Dahlin",
  "Kennet Andersson",
  "Jonas Thern",
  "Stefan Schwarz",
  "Patrik Andersson",
  "Olof Mellberg",
  "Kim Källström",
  "Rasmus Elm",
  "Andreas Granqvist",
  "Benedikt Höwedes",
  "Grzegorz Lato",
  "Kazimierz Deyna",
  "Andrzej Szarmach",
  "Robert Gadocha",
  "Jakub Błaszczykowski",
  "Kamil Glik",
  "Krzysztof Piątek",
  "László Kubala",
  "Sándor Kocsis",
  "Zoltán Czibor",
  "József Bozsik",
  "Flórián Albert",
  "Gyula Grosics",
  "Iosif Vician",
  "Ilie Dumitrescu",
  "Marius Lăcătuș",
  "Adrian Mutu",
  "Cosmin Contra",
  "Ionuț Lupescu",
  "Emil Kostadinov",
  "Trifon Ivanov",
  "Martin Petrov",
  "Georgi Kinkladze",
  "Levan Kobiashvili",
  "Oleg Blokhin",
  "Anatoliy Tymoshchuk",
  "Andriy Voronin",
  "Ruslan Rotan",
  "Yevhen Konoplyanka",
  "Sergei Yuran",
  "Igor Kolyvanov",
  "Valeri Karpin",
  "Dmitri Alenichev",
  "Aleksandr Mostovoi",
  "Andrei Kanchelskis",
  "Igor Shalimov",
  "Andrei Arshavin",
  "Aleksandr Kerzhakov",
  "Igor Denisov",
  "Konstantin Zyryanov",
  "Denis Glushakov",
  "Fyodor Smolov",
  "Robert Prosinečki",
  "Zvonimir Boban",
  "Aljoša Asanović",
  "Slaven Bilić",
  "Igor Štimac",
  "Goran Vlaović",
  "Robert Kovač",
  "Josip Šimunić",
  "Ivica Olić",
  "Niko Kranjčar",
  "Vedran Ćorluka",
  "Darijo Srna",
  "Eduardo da Silva",
  "Domagoj Vida",
  "Dejan Lovren",
  "Dejan Savićević",
  "Sinisa Mihajlović",
  "Dragan Stojković",
  "Darko Pančev",
  "Dragan Džajić",
  "Ilija Petković",
  "Rajko Mitić",
  "Branislav Ivanović",
  "Zoran Đorđević",
  "Dušan Tadić",
  "Emre Belözoğlu",
  "Arda Turan",
  "Burak Yılmaz",
  "Cenk Tosun",
  "Caner Erkin",
  "Alex de Souza",
  "Fatih Terim",
  "Tayfun Korkut",
  "Ridvan Dilmen",
  "Metin Oktay",
  "Keisuke Honda",
  "Maya Yoshida",
  "Ahmed Hassan",
  "Mohamed Aboutrika",
  "Roger Milla",
  "Patrick Mboma",
  "Marc-Vivien Foé",
  "Kalu Uche",
  "Nwankwo Kanu",
  "Taribo West",
  "Obafemi Martins",
  "Emmanuel Emenike",
  "Abedi Pele",
  "Anthony Yeboah",
  "Sulley Muntari",
  "Andre Ayew",
  "Emmanuel Eboué",
  "Mahamadou Diarra",
  "Frédéric Kanouté",
  "Papiss Cissé",
  "Aliou Cissé",
  "Christian Karembeu",
  "Alain Boghossian",
  "Djibril Cissé",
  "Éric Abidal",
  "Presnel Kimpembe",
  "Stuart Pearce",
  "Peter Shilton",
  "Des Walker",
  "Terry Butcher",
  "Bryan Robson",
  "Glenn Hoddle",
  "Chris Sutton",
  "Stan Collymore",
  "Matthew Le Tissier",
  "David Platt",
  "Wes Brown",
  "Theo Walcott",
  "Jack Wilshere",
];


// Deriva el externalId ("wiki:Titulo Con Espacios") a partir de una URL
// de en.wikipedia.org, sin tocar wikipediaSync.ts -- misma lógica que
// extraerTituloDeUrlWikipedia allí, duplicada aquí a propósito porque es
// muy pequeña y así no hace falta exportar nada nuevo de ese archivo.
function externalIdDesdeUrl(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match) return null;
  const titulo = decodeURIComponent(match[1]).replace(/_/g, " ");
  return `wiki:${titulo}`;
}

async function yaExisteEnBD(entrada: EntradaJugador): Promise<boolean> {
  if (typeof entrada === "string") {
    const existente = await prisma.player.findFirst({ where: { nombre: entrada } });
    return !!existente;
  }

  const externalId = externalIdDesdeUrl(entrada.url);
  if (!externalId) return false;

  const existente = await prisma.player.findUnique({ where: { externalId } });
  return !!existente;
}

async function main() {
  const fallos: { nombre: string; motivo: string }[] = [];
  const renombrados: { buscado: string; encontrado: string }[] = [];
  const saltados: string[] = [];
  let exitos = 0;

  for (const entrada of JUGADORES_INICIALES) {
    const nombre = typeof entrada === "string" ? entrada : entrada.nombre;
    const urlManual = typeof entrada === "string" ? undefined : entrada.url;

    if (await yaExisteEnBD(entrada)) {
      console.log(`\n→ ${nombre}...`);
      console.log(`  — Ya está en la BD, se salta.`);
      saltados.push(nombre);
      continue;
    }

    console.log(`\n→ Sincronizando ${nombre}${urlManual ? " (vía URL manual)" : ""}...`);
    const resultado = await syncJugadorDesdeWikipedia(prisma, nombre, urlManual);

    if (resultado.ok) {
      exitos++;
      if (resultado.renombrado) {
        renombrados.push({ buscado: nombre, encontrado: resultado.nombreUsado });
      }
      const aviso = resultado.renombrado
        ? `  (encontrado como "${resultado.nombreUsado}", revisa que sea correcto)`
        : "";
      console.log(
        `  ✓ ${resultado.etapas} etapas guardadas (${resultado.goles} goles, ${resultado.partidos} partidos totales)${aviso}`
      );
    } else {
      fallos.push({ nombre, motivo: resultado.motivo });
      console.warn(`  ✗ Fallo: ${resultado.motivo}`);
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  await prisma.$disconnect();

  console.log(`\n=== Resumen ===`);
  console.log(`Sincronizados con éxito: ${exitos}`);
  console.log(`Ya existían (saltados): ${saltados.length}`);
  console.log(`Fallos: ${fallos.length}`);
  console.log(`Renombrados (revisar): ${renombrados.length}`);

  const lineasFallos = fallos.map((f) => `${f.nombre} — ${f.motivo}`).join("\n");
  await writeFile("data/jugadores/sync-fallos.txt", lineasFallos, "utf-8");

  const lineasRenombrados = renombrados
    .map((r) => `${r.buscado} -> ${r.encontrado}`)
    .join("\n");
  await writeFile("data/jugadores/sync-renombrados.txt", lineasRenombrados, "utf-8");

  console.log(`\nGuardado: data/jugadores/sync-fallos.txt y data/jugadores/sync-renombrados.txt`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});