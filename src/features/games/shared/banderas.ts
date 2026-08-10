// Nombres en inglés porque es el idioma en el que guardamos `nacionalidad`
// (viene de Wikidata/infobox de en.wikipedia.org). Antes solo cubría las
// federaciones más habituales -- suficiente para Grid y el Top10
// individual porque casi siempre te tocan jugadores de ligas top5 (pool
// pequeño de nacionalidades). El Top10 de "goleadores selecciones" /
// históricos tira de un pool de jugadores mucho más internacional
// (incluye leyendas retiradas de cualquier federación), así que hacía
// falta ampliar esto de verdad -- si no, la bandera simplemente no
// aparecía para cualquier nacionalidad fuera de esa lista corta (10/08/2026).
export const CODIGOS_PAIS: Record<string, string> = {
  // Europa
  Spain: "es", France: "fr", Germany: "de", Italy: "it", England: "gb-eng",
  Portugal: "pt", Netherlands: "nl", Belgium: "be", Croatia: "hr", Poland: "pl",
  Switzerland: "ch", Austria: "at", Sweden: "se", Norway: "no", Denmark: "dk",
  Finland: "fi", Scotland: "gb-sct", Wales: "gb-wls", Ireland: "ie",
  "Republic of Ireland": "ie",
  "Northern Ireland": "gb-nir", Serbia: "rs", Ukraine: "ua", Russia: "ru",
  "Czech Republic": "cz", Czechia: "cz", Czechoslovakia: "cz",
  Slovakia: "sk", Hungary: "hu", Romania: "ro",
  Bulgaria: "bg", Greece: "gr", Turkey: "tr", "Bosnia and Herzegovina": "ba",
  Slovenia: "si", Montenegro: "me", "North Macedonia": "mk", Macedonia: "mk",
  Albania: "al", Iceland: "is", Georgia: "ge", Armenia: "am", Azerbaijan: "az",
  Kosovo: "xk", Cyprus: "cy", Malta: "mt", Luxembourg: "lu", Estonia: "ee",
  Latvia: "lv", Lithuania: "lt", Belarus: "by", Moldova: "md",
  Liechtenstein: "li", Andorra: "ad", "San Marino": "sm", Monaco: "mc",
  "Vatican City": "va", "United Kingdom": "gb", "Soviet Union": "ru",
  "West Germany": "de", "East Germany": "de", Yugoslavia: "rs",

  // Sudamérica
  Argentina: "ar", Brazil: "br", Uruguay: "uy", Chile: "cl", Colombia: "co",
  Ecuador: "ec", Paraguay: "py", Peru: "pe", Venezuela: "ve", Bolivia: "bo",
  Guyana: "gy", Suriname: "sr",

  // Norte/Centroamérica y Caribe
  Mexico: "mx", "United States": "us", Canada: "ca", "Costa Rica": "cr",
  Jamaica: "jm", Honduras: "hn", Panama: "pa", Guatemala: "gt",
  "El Salvador": "sv", Nicaragua: "ni", Belize: "bz", Cuba: "cu",
  Haiti: "ht", "Dominican Republic": "do", "Trinidad and Tobago": "tt",
  Bahamas: "bs", Barbados: "bb", Grenada: "gd", "Saint Lucia": "lc",
  "Saint Vincent and the Grenadines": "vc", "Saint Kitts and Nevis": "kn",
  Dominica: "dm", "Antigua and Barbuda": "ag", "Puerto Rico": "pr",
  Bermuda: "bm", Curaçao: "cw", Curacao: "cw", Aruba: "aw",

  // África
  Nigeria: "ng", Senegal: "sn", Morocco: "ma", Egypt: "eg", Algeria: "dz",
  Tunisia: "tn", Cameroon: "cm", Ghana: "gh", "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci", "South Africa": "za", Mali: "ml", "DR Congo": "cd",
  "Democratic Republic of the Congo": "cd", Congo: "cg",
  "Republic of the Congo": "cg", Zambia: "zm", Eritrea: "er", Ethiopia: "et",
  Angola: "ao", "Burkina Faso": "bf", Burundi: "bi", Gabon: "ga",
  Guinea: "gn", "Guinea-Bissau": "gw", "Equatorial Guinea": "gq",
  Liberia: "lr", "Sierra Leone": "sl", Gambia: "gm", Mauritania: "mr",
  Niger: "ne", Chad: "td", "Central African Republic": "cf",
  Comoros: "km", Madagascar: "mg", Malawi: "mw", Mozambique: "mz",
  Zimbabwe: "zw", Namibia: "na", Botswana: "bw", Uganda: "ug",
  Kenya: "ke", Tanzania: "tz", Rwanda: "rw", Benin: "bj", Togo: "tg",
  Libya: "ly", Sudan: "sd", "South Sudan": "ss", Somalia: "so",
  Djibouti: "dj", "Cape Verde": "cv", Lesotho: "ls", Eswatini: "sz",
  Swaziland: "sz", "São Tomé and Príncipe": "st",

  // Asia / Oceanía
  Japan: "jp", "South Korea": "kr", "North Korea": "kp", Australia: "au",
  China: "cn", "Saudi Arabia": "sa", Qatar: "qa", Iran: "ir", Iraq: "iq",
  "New Zealand": "nz", India: "in", Indonesia: "id", Thailand: "th",
  Vietnam: "vn", Malaysia: "my", Singapore: "sg", Philippines: "ph",
  Myanmar: "mm", Cambodia: "kh", Laos: "la", Bangladesh: "bd",
  "Sri Lanka": "lk", Nepal: "np", Pakistan: "pk", Afghanistan: "af",
  Bhutan: "bt", Maldives: "mv", Brunei: "bn", "East Timor": "tl",
  "Timor-Leste": "tl", Uzbekistan: "uz", Kazakhstan: "kz",
  Kyrgyzstan: "kg", Tajikistan: "tj", Turkmenistan: "tm",
  Bahrain: "bh", "United Arab Emirates": "ae", Kuwait: "kw", Oman: "om",
  Jordan: "jo", Lebanon: "lb", Syria: "sy", Yemen: "ye", Israel: "il",
  Palestine: "ps", Mongolia: "mn", "Hong Kong": "hk", "Chinese Taipei": "tw",
  Taiwan: "tw", Fiji: "fj", "Papua New Guinea": "pg",
  "Solomon Islands": "sb", Vanuatu: "vu", Samoa: "ws",
  "American Samoa": "as", Tonga: "to", "New Caledonia": "nc",
  Tahiti: "pf", "French Polynesia": "pf",
};

export function obtenerCodigoPais(nacionalidad: string | null | undefined): string | null {
  if (!nacionalidad) return null;
  return CODIGOS_PAIS[nacionalidad] ?? null;
}
