import { COUNTRIES, COUNTRY_BY_CODE, type CountryMeta } from '../data/countries';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** 0 = kein Treffer, höher = besser */
function score(haystack: string, q: string): number {
  if (!haystack || !q) return 0;
  if (haystack === q) return 100;
  if (haystack.startsWith(q)) return 80;
  if (haystack.includes(` ${q}`)) return 60;
  if (q.length >= 3 && haystack.includes(q)) return 30;
  return 0;
}

interface IndexedCountry {
  meta: CountryMeta;
  keys: string[];
}

const COUNTRY_INDEX: IndexedCountry[] = COUNTRIES.map((meta) => ({
  meta,
  keys: [normalize(meta.name), normalize(meta.nameEn), normalize(meta.official), meta.code.toLowerCase()],
}));

export function searchCountries(query: string, limit = 8): CountryMeta[] {
  const q = normalize(query);
  if (!q) return [];
  const out: { meta: CountryMeta; s: number }[] = [];
  for (const c of COUNTRY_INDEX) {
    const [name, nameEn, official, code] = c.keys;
    const officialScore = score(official, q);
    const s = Math.max(
      score(name, q),
      score(nameEn, q) - 2,
      officialScore >= 60 ? officialScore - 4 : 0, // amtlicher Name nur bei Wortanfang
      q.length === 2 && code === q ? 90 : 0,
    );
    if (s <= 0) continue;
    out.push({ meta: c.meta, s: s + (c.meta.countable ? 1 : 0) });
  }
  return out
    .sort((a, b) => b.s - a.s || a.meta.name.localeCompare(b.meta.name, 'de'))
    .slice(0, limit)
    .map((r) => r.meta);
}

// ------------------------------------------------------------------ Städte

/** [deutscher Name, englischer Name, Land, Breite, Länge, Einwohner, Hauptstadt] */
type RawCity = [string, string, string, number, number, number, number];

export interface CityHit {
  key: string;
  name: string;
  nameEn: string;
  countryCode: string;
  lat: number;
  lng: number;
  population: number;
  capital: boolean;
  source: 'atlas' | 'online';
}

interface IndexedCity extends CityHit {
  n: string;
  ne: string;
}

let cityIndex: IndexedCity[] | null = null;
let loading: Promise<IndexedCity[]> | null = null;

export function loadCities(): Promise<IndexedCity[]> {
  if (cityIndex) return Promise.resolve(cityIndex);
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/cities.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Städte konnten nicht geladen werden (${r.status})`);
        return r.json() as Promise<RawCity[]>;
      })
      .then((rows) => {
        cityIndex = rows.map(([name, en, cc, lat, lng, pop, cap]) => ({
          key: `${cc}:${name}:${lat}:${lng}`,
          name,
          nameEn: en || name,
          countryCode: cc,
          lat,
          lng,
          population: pop,
          capital: cap === 1,
          source: 'atlas' as const,
          n: normalize(name),
          ne: en ? normalize(en) : '',
        }));
        return cityIndex;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export function searchCityIndex(
  index: IndexedCity[],
  query: string,
  opts: { countryCode?: string; limit?: number } = {},
): CityHit[] {
  const q = normalize(query);
  const limit = opts.limit ?? 12;
  const pool = opts.countryCode ? index.filter((c) => c.countryCode === opts.countryCode) : index;
  if (!q) {
    // Ohne Suchbegriff: die größten Städte (z. B. eines Landes)
    return opts.countryCode ? pool.slice(0, limit) : [];
  }
  const out: { c: IndexedCity; s: number }[] = [];
  for (const c of pool) {
    const s = Math.max(score(c.n, q), c.ne ? score(c.ne, q) - 1 : 0);
    if (s > 0) out.push({ c, s });
  }
  // Index ist nach Einwohnern sortiert → bei gleichem Score gewinnt die größere Stadt
  out.sort((a, b) => b.s - a.s || b.c.population - a.c.population);
  return out.slice(0, limit).map(({ c }) => c);
}

/**
 * Online-Suche für kleinere Orte über Photon (komoot, Daten © OpenStreetMap-Mitwirkende).
 * Braucht Internet. Fehler werden an den Aufrufer weitergegeben.
 */
export async function searchOnline(query: string, opts: { countryCode?: string; signal?: AbortSignal } = {}): Promise<CityHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=15`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Online-Suche fehlgeschlagen (${res.status})`);
  const json = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: { name?: string; countrycode?: string; osm_key?: string; osm_value?: string; state?: string };
    }[];
  };
  const PLACE_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'locality', 'island', 'suburb', 'quarter', 'borough']);
  const seen = new Set<string>();
  const hits: CityHit[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    const cc = (p.countrycode ?? '').toUpperCase();
    if (!p.name || !coords || !COUNTRY_BY_CODE.has(cc)) continue;
    if (p.osm_key !== 'place' || !PLACE_TYPES.has(p.osm_value ?? '')) continue;
    if (opts.countryCode && cc !== opts.countryCode) continue;
    const key = `${cc}:${normalize(p.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      key: `online:${cc}:${p.name}:${coords[1]}:${coords[0]}`,
      name: p.name,
      nameEn: p.state ?? '',
      countryCode: cc,
      lat: Math.round(coords[1] * 1000) / 1000,
      lng: Math.round(coords[0] * 1000) / 1000,
      population: 0,
      capital: false,
      source: 'online',
    });
  }
  return hits;
}

export function formatPopulation(n: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. Einw.`;
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('de-DE')} Tsd. Einw.`;
  return `${n} Einw.`;
}
