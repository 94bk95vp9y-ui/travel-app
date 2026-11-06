import raw from './countries.json';

export type ContinentCode = 'EU' | 'AS' | 'AF' | 'NA' | 'SA' | 'OC' | 'AN';

export interface CountryMeta {
  code: string;
  name: string;
  nameEn: string;
  official: string;
  flag: string;
  continent: ContinentCode;
  subregion: string;
  capital: string;
  languages: string[];
  currencies: string[];
  lat: number;
  lng: number;
  /** Fläche in km² */
  area: number;
  /** Zählt zu den 195 Ländern (193 UN-Mitglieder + Vatikan + Palästina) */
  countable: boolean;
  /** Hat einen Umriss auf dem Globus */
  hasShape: boolean;
}

export const COUNTRIES = raw as CountryMeta[];
export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
export const COUNTABLE_TOTAL = COUNTRIES.filter((c) => c.countable).length;

export const CONTINENTS: { code: ContinentCode; name: string }[] = [
  { code: 'EU', name: 'Europa' },
  { code: 'AS', name: 'Asien' },
  { code: 'AF', name: 'Afrika' },
  { code: 'NA', name: 'Nordamerika' },
  { code: 'SA', name: 'Südamerika' },
  { code: 'OC', name: 'Ozeanien' },
  { code: 'AN', name: 'Antarktis' },
];

export const CONTINENT_NAME = Object.fromEntries(CONTINENTS.map((c) => [c.code, c.name])) as Record<
  ContinentCode,
  string
>;

export function getCountry(code: string | null | undefined): CountryMeta | undefined {
  return code ? COUNTRY_BY_CODE.get(code) : undefined;
}

/** Kamerahöhe (in Globusradien), damit ein Land gut ins Bild passt. */
export function altitudeForCountry(c: CountryMeta | undefined): number {
  if (!c) return 1.6;
  const alt = 0.32 + Math.sqrt(Math.max(c.area, 1)) / 2300;
  return Math.min(2.2, Math.max(0.36, alt));
}
