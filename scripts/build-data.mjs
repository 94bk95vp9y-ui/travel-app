#!/usr/bin/env node
/**
 * Erzeugt die statischen Daten der App aus Natural Earth (gemeinfrei) und
 * dem npm-Paket "world-countries" (ODbL).
 *
 * Ausgabe:
 *   src/data/countries.json      – Länder-Metadaten (deutsch), im JS-Bundle
 *   public/data/world.topo.json  – vereinfachte Ländergrenzen (TopoJSON)
 *   public/data/cities.json      – ca. 7.300 Städte mit deutschen Namen
 *
 * Aufruf: npm run build:data
 * Rohdaten werden nach scripts/.cache heruntergeladen (nicht im Git).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import countries from 'world-countries';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'scripts', '.cache');
mkdirSync(cache, { recursive: true });
mkdirSync(join(root, 'public', 'data'), { recursive: true });
mkdirSync(join(root, 'src', 'data'), { recursive: true });

const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function load(name) {
  const file = join(cache, name);
  if (!existsSync(file)) {
    console.log(`↓ ${name}`);
    const res = await fetch(NE_BASE + name);
    if (!res.ok) throw new Error(`Download fehlgeschlagen: ${name} (${res.status})`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Natural Earth nutzt eigene Codes für einige Gebiete ohne ISO-Code.
const NE_FIX = { SOL: 'SO', CYN: 'CY', KOS: 'XK' };

const byCode = new Map(countries.map((c) => [c.cca2, c]));

// ---------------------------------------------------------------- Polygone
const ne = await load('ne_50m_admin_0_countries.geojson');
const unknownPolys = [];
const polyFeatures = ne.features
  .map((f) => {
    const p = f.properties;
    let code = p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : NE_FIX[p.ADM0_A3] ?? null;
    if (code && !byCode.has(code)) {
      unknownPolys.push(`${p.NAME} (${code})`);
      code = null;
    }
    return { type: 'Feature', properties: { c: code ?? '' }, geometry: f.geometry };
  });
if (unknownPolys.length) console.log('Polygone ohne Länder-Eintrag:', unknownPolys.join(', '));

const tmpGeo = join(cache, 'countries-prepared.geojson');
writeFileSync(tmpGeo, JSON.stringify({ type: 'FeatureCollection', features: polyFeatures }));
const topoOut = join(root, 'public', 'data', 'world.topo.json');
execFileSync(
  'npx',
  [
    'mapshaper', tmpGeo,
    '-simplify', 'percentage=22%', 'keep-shapes', 'planar',
    '-rename-layers', 'countries',
    '-o', topoOut, 'format=topojson', 'quantization=60000', 'force',
  ],
  { stdio: 'inherit', cwd: root },
);

// Nur Länder, deren Umriss die Vereinfachung überlebt hat
const topo = JSON.parse(readFileSync(topoOut, 'utf8'));
const polyCodes = new Set(topo.objects.countries.geometries.map((g) => g.properties?.c).filter(Boolean));

// ---------------------------------------------------------------- Städte
const places = await load('ne_10m_populated_places.geojson');
const fixIso = (p) => (p.ISO_A2 !== '-99' ? p.ISO_A2 : NE_FIX[p.ADM0_A3] ?? null);
const round = (n) => Math.round(n * 1000) / 1000;

const cities = [];
const capitalsDe = new Map(); // ISO2 -> [{en, de}]
for (const f of places.features) {
  const p = f.properties;
  const iso = fixIso(p);
  if (!iso || !byCode.has(iso)) continue;
  const de = (p.NAME_DE || p.NAME).trim();
  const en = (p.NAME_EN || p.NAME).trim();
  const isCapital = /Admin-0 capital/.test(p.FEATURECLA) ? 1 : 0;
  if (isCapital) {
    if (!capitalsDe.has(iso)) capitalsDe.set(iso, []);
    capitalsDe.get(iso).push({ en, de, name: p.NAME });
  }
  // [deutscher Name, englischer Name (leer wenn gleich), Land, Breite, Länge, Einwohner, Hauptstadt]
  cities.push([de, en === de ? '' : en, iso, round(p.LATITUDE), round(p.LONGITUDE), p.POP_MAX || 0, isCapital]);
}
cities.sort((a, b) => b[5] - a[5]);
writeFileSync(join(root, 'public', 'data', 'cities.json'), JSON.stringify(cities));

// ---------------------------------------------------------------- Länder
const langDe = new Intl.DisplayNames(['de'], { type: 'language' });
const curDe = new Intl.DisplayNames(['de'], { type: 'currency' });

const SUBREGION_DE = {
  'Caribbean': 'Karibik',
  'Southern Asia': 'Südasien',
  'Middle Africa': 'Zentralafrika',
  'Northern Europe': 'Nordeuropa',
  'Southeast Europe': 'Südosteuropa',
  'Southern Europe': 'Südeuropa',
  'Western Asia': 'Westasien',
  'South America': 'Südamerika',
  'Polynesia': 'Polynesien',
  'Australia and New Zealand': 'Australien & Neuseeland',
  'Central Europe': 'Mitteleuropa',
  'Eastern Africa': 'Ostafrika',
  'Western Europe': 'Westeuropa',
  'Western Africa': 'Westafrika',
  'Eastern Europe': 'Osteuropa',
  'Central America': 'Mittelamerika',
  'North America': 'Nordamerika',
  'South-Eastern Asia': 'Südostasien',
  'Southern Africa': 'Südliches Afrika',
  'Eastern Asia': 'Ostasien',
  'Northern Africa': 'Nordafrika',
  'Melanesia': 'Melanesien',
  'Micronesia': 'Mikronesien',
  'Central Asia': 'Zentralasien',
};

function continentOf(c) {
  switch (c.region) {
    case 'Europe': return 'EU';
    case 'Africa': return 'AF';
    case 'Asia': return 'AS';
    case 'Oceania': return 'OC';
    case 'Antarctic': return 'AN';
    case 'Americas': return c.subregion === 'South America' ? 'SA' : 'NA';
    default: return 'AN';
  }
}

function capitalDe(c) {
  const en = c.capital?.[0];
  if (!en) return '';
  const caps = capitalsDe.get(c.cca2) ?? [];
  const hit = caps.find((x) => x.en === en || x.name === en);
  return (hit ?? (caps.length === 1 ? caps[0] : null))?.de ?? en;
}

function languageNames(c) {
  return Object.entries(c.languages ?? {}).slice(0, 4).map(([code, en]) => {
    const de = langDe.of(code);
    return de && de !== code ? de : en;
  });
}

function currencyNames(c) {
  return Object.entries(c.currencies ?? {}).slice(0, 3).map(([code, info]) => {
    const de = curDe.of(code);
    return `${de && de !== code ? de : info.name}${info.symbol ? ` (${info.symbol})` : ''}`;
  });
}

const meta = countries
  .map((c) => ({
    code: c.cca2,
    name: c.translations?.deu?.common ?? c.name.common,
    nameEn: c.name.common,
    official: c.translations?.deu?.official ?? c.name.official,
    flag: c.flag,
    continent: continentOf(c),
    subregion: SUBREGION_DE[c.subregion] ?? c.subregion ?? '',
    capital: capitalDe(c),
    languages: languageNames(c),
    currencies: currencyNames(c),
    lat: round(c.latlng[0]),
    lng: round(c.latlng[1]),
    area: Math.round(c.area ?? 0),
    // 193 UN-Mitglieder + Vatikan + Palästina = 195
    // (world-countries führt den Vatikan fälschlich als UN-Mitglied)
    countable: Boolean(c.unMember || c.cca2 === 'PS'),
    hasShape: polyCodes.has(c.cca2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));

const countable = meta.filter((m) => m.countable).length;
if (countable !== 195) throw new Error(`Erwartet 195 zählbare Länder, gefunden ${countable}`);

writeFileSync(join(root, 'src', 'data', 'countries.json'), JSON.stringify(meta));

console.log(`✓ ${meta.length} Länder/Gebiete (${countable} zählbar), ${meta.filter((m) => !m.hasShape).length} ohne Umriss`);
console.log(`✓ ${cities.length} Städte`);
