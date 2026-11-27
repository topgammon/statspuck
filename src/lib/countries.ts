// NHL feeds use three-letter country codes. These are the names fans expect.

const NAMES: Record<string, string> = {
  CAN: "Canada",
  USA: "USA",
  SWE: "Sweden",
  FIN: "Finland",
  RUS: "Russia",
  CZE: "Czechia",
  SVK: "Slovakia",
  DEU: "Germany",
  GER: "Germany",
  CHE: "Switzerland",
  SUI: "Switzerland",
  BLR: "Belarus",
  LVA: "Latvia",
  LAT: "Latvia",
  DNK: "Denmark",
  DEN: "Denmark",
  NOR: "Norway",
  AUT: "Austria",
  GBR: "Great Britain",
  SVN: "Slovenia",
  SLO: "Slovenia",
  KAZ: "Kazakhstan",
  FRA: "France",
  CHN: "China",
  UKR: "Ukraine",
  POL: "Poland",
  ITA: "Italy",
  NLD: "Netherlands",
  NED: "Netherlands",
  JPN: "Japan",
  KOR: "South Korea",
  AUS: "Australia",
  HUN: "Hungary",
  EST: "Estonia",
  LTU: "Lithuania",
  BRA: "Brazil",
  JAM: "Jamaica",
  NGA: "Nigeria",
  ZAF: "South Africa",
  BHS: "Bahamas",
  HRV: "Croatia",
  SRB: "Serbia",
  KOS: "Kosovo",
  TWN: "Taiwan",
  VEN: "Venezuela",
  BRN: "Brunei",
};

/** NHL / IOC style three-letter code for display: DEU -> GER, CHE -> SUI, LVA -> LAT ... */
const IOC: Record<string, string> = { DEU: "GER", CHE: "SUI", LVA: "LAT", DNK: "DEN", SVN: "SLO", NLD: "NED" };

export function iocCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return IOC[code] ?? code;
}

/** Two-letter ISO code for the flag image. */
const ISO2: Record<string, string> = {
  CAN: "ca", USA: "us", SWE: "se", FIN: "fi", RUS: "ru", CZE: "cz", SVK: "sk", DEU: "de", GER: "de", CHE: "ch", SUI: "ch",
  BLR: "by", LVA: "lv", LAT: "lv", DNK: "dk", DEN: "dk", NOR: "no", AUT: "at", GBR: "gb", SVN: "si", SLO: "si", KAZ: "kz",
  FRA: "fr", CHN: "cn", UKR: "ua", POL: "pl", ITA: "it", NLD: "nl", NED: "nl", JPN: "jp", KOR: "kr", AUS: "au", HUN: "hu",
  EST: "ee", LTU: "lt", BRA: "br", JAM: "jm", NGA: "ng", ZAF: "za", BHS: "bs", HRV: "hr", SRB: "rs", KOS: "xk", TWN: "tw",
  VEN: "ve", BRN: "bn",
};

export function flagUrl(code: string | null | undefined): string | null {
  const iso = code ? ISO2[code] : null;
  return iso ? `https://flagcdn.com/${iso}.svg` : null;
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return NAMES[code] ?? code;
}
