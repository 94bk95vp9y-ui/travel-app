import { describe, expect, it } from 'vitest';
import { COUNTABLE_TOTAL, COUNTRY_BY_CODE } from '../data/countries';
import { createBackup, parseBackup } from './backup';
import { detectPlatform, extractUrl, fallbackTitle } from './links';
import { normalize, searchCityIndex, searchCountries } from './search';
import { computeStats } from './stats';
import { deriveCountries } from './status';
import { emptyData, type AppData, type CityRecord } from './types';

function city(id: string, name: string, cc: string, status: 'visited' | 'wishlist', years: number[] = []): CityRecord {
  return { id, name, countryCode: cc, lat: 1, lng: 1, status, years, note: '', createdAt: 1, updatedAt: 1 };
}

function sample(): AppData {
  const d = emptyData();
  d.countries.FR = { status: 'visited', years: [2019], note: '', updatedAt: 1 };
  d.countries.JP = { status: 'wishlist', years: [], note: 'Kirschblüte', updatedAt: 1 };
  d.countries.HK = { status: 'visited', years: [2023], note: '', updatedAt: 1 };
  d.cities.a = city('a', 'Rom', 'IT', 'visited', [2022, 2018]);
  d.cities.b = city('b', 'Kyoto', 'JP', 'wishlist');
  d.cities.c = city('c', 'Lissabon', 'PT', 'wishlist');
  d.ideas.i1 = {
    id: 'i1', url: 'https://www.tiktok.com/@x/video/1', title: 'Ramen', note: '', category: 'food',
    countryCode: 'JP', cityId: 'b', done: false, createdAt: 1, updatedAt: 1,
  };
  d.ideas.i2 = {
    id: 'i2', url: 'https://example.com', title: '', note: 'irgendwas', category: 'other',
    countryCode: null, cityId: null, done: true, createdAt: 2, updatedAt: 2,
  };
  return d;
}

describe('Länderdaten', () => {
  it('hat genau 195 zählbare Länder', () => {
    expect(COUNTABLE_TOTAL).toBe(195);
    expect(COUNTRY_BY_CODE.get('VA')?.countable).toBe(true);
    expect(COUNTRY_BY_CODE.get('PS')?.countable).toBe(true);
    expect(COUNTRY_BY_CODE.get('XK')?.countable).toBe(false);
    expect(COUNTRY_BY_CODE.get('DE')?.name).toBe('Deutschland');
  });
});

describe('Status-Ableitung', () => {
  const views = deriveCountries(sample());

  it('Land mit besuchter Stadt gilt als besucht (abgeleitet)', () => {
    expect(views.get('IT')?.status).toBe('visited');
    expect(views.get('IT')?.derived).toBe(true);
    expect(views.get('IT')?.years).toEqual([2022, 2018]);
  });

  it('Manueller Status bleibt erhalten', () => {
    expect(views.get('FR')?.status).toBe('visited');
    expect(views.get('FR')?.derived).toBe(false);
    expect(views.get('JP')?.status).toBe('wishlist');
  });

  it('Besucht schlägt Wunsch', () => {
    const d = sample();
    d.cities.x = city('x', 'Tokio', 'JP', 'visited', [2024]);
    const v = deriveCountries(d).get('JP');
    expect(v?.status).toBe('visited');
    expect(v?.years).toEqual([2024]);
  });

  it('Ideen werden dem Land der Stadt zugeordnet', () => {
    expect(views.get('JP')?.ideas.map((i) => i.id)).toEqual(['i1']);
  });
});

describe('Statistik', () => {
  const d = sample();
  const s = computeStats(d, deriveCountries(d));

  it('zählt nur die 195 Länder, Gebiete separat', () => {
    expect(s.visitedCountable).toBe(2); // FR, IT
    expect(s.territoriesVisited).toEqual(['HK']);
    expect(s.worldPercent).toBeCloseTo((2 / 195) * 100);
  });

  it('zählt Wunschziele und Städte', () => {
    expect(s.wishlistCountries).toBe(2); // JP, PT
    expect(s.citiesVisited).toBe(1);
    expect(s.citiesWishlist).toBe(2);
  });

  it('baut die Zeitleiste absteigend', () => {
    expect(s.timeline.map((t) => t.year)).toEqual([2023, 2022, 2019, 2018]);
    expect(s.timeline.find((t) => t.year === 2022)?.countries).toEqual(['IT']);
    expect(s.timeline.find((t) => t.year === 2022)?.cities.map((c) => c.name)).toEqual(['Rom']);
  });

  it('erkennt Kontinente', () => {
    expect(s.continents.find((c) => c.code === 'EU')?.visited).toBe(2);
    expect(s.continents.find((c) => c.code === 'AS')?.reached).toBe(true); // Hongkong
    expect(s.continentsReached).toBe(2);
  });

  it('Ideen-Zahlen stimmen', () => {
    expect(s.ideasTotal).toBe(2);
    expect(s.ideasDone).toBe(1);
    expect(s.ideasUnsorted).toBe(1);
  });

  it('Erfolge', () => {
    expect(s.achievements.find((a) => a.id === 'first')?.unlocked).toBe(true);
    expect(s.achievements.find((a) => a.id === 'five')?.progressLabel).toBe('2/5');
  });
});

describe('Links', () => {
  it('holt die URL aus geteiltem Text', () => {
    const r = extractUrl('Schau dir das an! https://vm.tiktok.com/ZMabc123/ #travel');
    expect(r.url).toBe('https://vm.tiktok.com/ZMabc123/');
    expect(r.rest).toBe('Schau dir das an! #travel');
  });

  it('ergänzt https bei www-Adressen', () => {
    expect(extractUrl('www.beispiel.de/seite').url).toBe('https://www.beispiel.de/seite');
  });

  it('erkennt Plattformen', () => {
    expect(detectPlatform('https://www.tiktok.com/@a/video/1').id).toBe('tiktok');
    expect(detectPlatform('https://vm.tiktok.com/xyz').id).toBe('tiktok');
    expect(detectPlatform('https://www.instagram.com/reel/abc').id).toBe('instagram');
    expect(detectPlatform('https://youtu.be/abc').id).toBe('youtube');
    expect(detectPlatform('https://maps.app.goo.gl/abc').id).toBe('gmaps');
    expect(detectPlatform('https://www.google.com/maps/place/x').id).toBe('gmaps');
    expect(detectPlatform('https://maps.apple.com/?q=x').id).toBe('amaps');
    expect(detectPlatform('https://blog.de/x').id).toBe('web');
    expect(detectPlatform('').id).toBe('none');
  });

  it('liefert sinnvolle Platzhalter-Titel', () => {
    expect(fallbackTitle('https://www.instagram.com/reel/abc')).toBe('Instagram-Reel');
    expect(fallbackTitle('https://www.reiseblog.de/x')).toBe('reiseblog.de');
  });
});

describe('Suche', () => {
  it('normalisiert Umlaute und ß', () => {
    expect(normalize('Österreich')).toBe('osterreich');
    expect(normalize('Straße')).toBe('strasse');
  });

  it('findet Länder deutsch, englisch und per Code', () => {
    expect(searchCountries('deutsch')[0].code).toBe('DE');
    expect(searchCountries('germany')[0].code).toBe('DE');
    expect(searchCountries('jp')[0].code).toBe('JP');
    expect(searchCountries('oster')[0].code).toBe('AT');
  });

  it('liefert keine Nicht-Treffer', () => {
    const codes = searchCountries('par', 10).map((c) => c.code);
    expect(codes[0]).toBe('PY');
    expect(codes).not.toContain('AF');
    expect(codes).not.toContain('YT');
    expect(searchCountries('xyzq')).toEqual([]);
  });

  it('findet Städte nach Präfix, größere zuerst', () => {
    const idx = [
      { key: '1', name: 'Rom', nameEn: 'Rome', countryCode: 'IT', lat: 0, lng: 0, population: 3000000, capital: true, source: 'atlas' as const, n: 'rom', ne: 'rome' },
      { key: '2', name: 'Roma', nameEn: 'Roma', countryCode: 'AU', lat: 0, lng: 0, population: 6000, capital: false, source: 'atlas' as const, n: 'roma', ne: '' },
      { key: '3', name: 'München', nameEn: 'Munich', countryCode: 'DE', lat: 0, lng: 0, population: 1500000, capital: false, source: 'atlas' as const, n: 'munchen', ne: 'munich' },
    ];
    expect(searchCityIndex(idx, 'ro').map((c) => c.key)).toEqual(['1', '2']);
    expect(searchCityIndex(idx, 'munich')[0].name).toBe('München');
    expect(searchCityIndex(idx, 'mun', { countryCode: 'IT' })).toEqual([]);
  });
});

describe('Backup', () => {
  it('Export → Import ergibt dieselben Daten', () => {
    const d = sample();
    const { data, skipped } = parseBackup(JSON.stringify(createBackup(d)));
    expect(skipped).toBe(0);
    expect(data.countries).toEqual(d.countries);
    expect(data.cities).toEqual(d.cities);
    expect(data.ideas).toEqual(d.ideas);
  });

  it('verwirft kaputte Einträge', () => {
    const d = sample() as unknown as Record<string, Record<string, unknown>>;
    d.countries.ZZ = { status: 'visited', years: [] };
    d.cities.bad = { name: '', countryCode: 'DE', status: 'visited' };
    const { data, skipped } = parseBackup(JSON.stringify(d));
    expect(skipped).toBe(2);
    expect(data.countries.ZZ).toBeUndefined();
    expect(data.cities.bad).toBeUndefined();
  });

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow();
    expect(() => parseBackup('kein json')).toThrow();
  });
});
