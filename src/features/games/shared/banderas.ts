// Nombres en inglés porque es el idioma en el que guardamos `nacionalidad`
// (viene de Wikidata/infobox de en.wikipedia.org). Cubre las federaciones
// más habituales en fútbol -- amplía si te sale una nacionalidad que no
// está aquí y quieres que muestre bandera.
export const CODIGOS_PAIS: Record<string, string> = {
  // Europa
  Spain: "es", France: "fr", Germany: "de", Italy: "it", England: "gb-eng",
  Portugal: "pt", Netherlands: "nl", Belgium: "be", Croatia: "hr", Poland: "pl",
  Switzerland: "ch", Austria: "at", Sweden: "se", Norway: "no", Denmark: "dk",
  Finland: "fi", Scotland: "gb-sct", Wales: "gb-wls", Ireland: "ie",
  "Northern Ireland": "gb-nir", Serbia: "rs", Ukraine: "ua", Russia: "ru",
  "Czech Republic": "cz", Slovakia: "sk", Hungary: "hu", Romania: "ro",
  Bulgaria: "bg", Greece: "gr", Turkey: "tr", "Bosnia and Herzegovina": "ba",
  Slovenia: "si", Montenegro: "me", "North Macedonia": "mk", Albania: "al",
  Iceland: "is", Georgia: "ge", Armenia: "am", Azerbaijan: "az", Kosovo: "xk",

  // Sudamérica
  Argentina: "ar", Brazil: "br", Uruguay: "uy", Chile: "cl", Colombia: "co",
  Ecuador: "ec", Paraguay: "py", Peru: "pe", Venezuela: "ve", Bolivia: "bo",

  // Norte/Centroamérica y Caribe
  Mexico: "mx", "United States": "us", Canada: "ca", "Costa Rica": "cr",
  Jamaica: "jm", Honduras: "hn", Panama: "pa",

  // África
  Nigeria: "ng", Senegal: "sn", Morocco: "ma", Egypt: "eg", Algeria: "dz",
  Tunisia: "tn", Cameroon: "cm", Ghana: "gh", "Ivory Coast": "ci",
  "South Africa": "za", Mali: "ml", "DR Congo": "cd", Zambia: "zm",
  Eritrea: "er", Ethiopia: "et",

  // Asia / Oceanía
  Japan: "jp", "South Korea": "kr", Australia: "au", China: "cn",
  "Saudi Arabia": "sa", Qatar: "qa", Iran: "ir", Iraq: "iq",
  "New Zealand": "nz", India: "in",
};

export function obtenerCodigoPais(nacionalidad: string): string | null {
  return CODIGOS_PAIS[nacionalidad] ?? null;
}