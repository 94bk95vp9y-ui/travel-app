import type { AppData, CityRecord, IdeaRecord, Status } from './types';

export interface CountryView {
  code: string;
  /** Angezeigter Status (manuell oder aus Städten abgeleitet) */
  status: Status | null;
  /** Manuell gesetzter Status */
  manual: Status | null;
  /** true, wenn der Status nur durch Städte zustande kommt */
  derived: boolean;
  /** Alle Besuchsjahre (Land + besuchte Städte), absteigend */
  years: number[];
  cities: CityRecord[];
  ideas: IdeaRecord[];
  updatedAt: number;
}

const sortDesc = (a: number, b: number) => b - a;

/**
 * Regel: Besucht schlägt Wunsch.
 * - besucht, wenn manuell besucht ODER mindestens eine Stadt besucht
 * - sonst Wunsch, wenn manuell Wunsch ODER mindestens eine Stadt auf der Wunschliste
 */
export function deriveCountries(data: AppData): Map<string, CountryView> {
  const map = new Map<string, CountryView>();
  const get = (code: string): CountryView => {
    let v = map.get(code);
    if (!v) {
      const rec = data.countries[code];
      v = {
        code,
        status: null,
        manual: rec?.status ?? null,
        derived: false,
        years: [],
        cities: [],
        ideas: [],
        updatedAt: rec?.updatedAt ?? 0,
      };
      map.set(code, v);
    }
    return v;
  };

  for (const code of Object.keys(data.countries)) get(code);
  for (const city of Object.values(data.cities)) {
    const v = get(city.countryCode);
    v.cities.push(city);
    v.updatedAt = Math.max(v.updatedAt, city.updatedAt);
  }
  for (const idea of Object.values(data.ideas)) {
    const code = idea.countryCode ?? (idea.cityId ? data.cities[idea.cityId]?.countryCode : null);
    if (code) get(code).ideas.push(idea);
  }

  for (const v of map.values()) {
    const cityVisited = v.cities.some((c) => c.status === 'visited');
    const cityWish = v.cities.some((c) => c.status === 'wishlist');
    if (v.manual === 'visited' || cityVisited) {
      v.status = 'visited';
      v.derived = v.manual !== 'visited';
    } else if (v.manual === 'wishlist' || cityWish) {
      v.status = 'wishlist';
      v.derived = v.manual !== 'wishlist';
    }
    const years = new Set<number>(data.countries[v.code]?.years ?? []);
    for (const c of v.cities) if (c.status === 'visited') c.years.forEach((y) => years.add(y));
    v.years = [...years].sort(sortDesc);
    v.cities.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    v.ideas.sort((a, b) => b.createdAt - a.createdAt);
  }
  return map;
}

export function statusOf(views: Map<string, CountryView>, code: string): Status | null {
  return views.get(code)?.status ?? null;
}
