import { CONTINENTS, COUNTRIES, COUNTRY_BY_CODE, COUNTABLE_TOTAL, type ContinentCode } from '../data/countries';
import type { CountryView } from './status';
import type { AppData, CityRecord } from './types';

export interface ContinentStat {
  code: ContinentCode;
  name: string;
  visited: number;
  total: number;
  /** Mindestens ein Land/Gebiet auf diesem Kontinent besucht */
  reached: boolean;
}

export interface YearEntry {
  year: number;
  countries: string[];
  cities: CityRecord[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** 0..1 */
  progress: number;
  progressLabel: string;
}

export interface Stats {
  visitedCountable: number;
  visitedAll: number;
  territoriesVisited: string[];
  wishlistCountries: number;
  worldPercent: number;
  areaPercent: number;
  continents: ContinentStat[];
  continentsReached: number;
  citiesVisited: number;
  citiesWishlist: number;
  ideasTotal: number;
  ideasOpen: number;
  ideasDone: number;
  ideasUnsorted: number;
  timeline: YearEntry[];
  achievements: Achievement[];
}

const TOTAL_AREA = COUNTRIES.filter((c) => c.continent !== 'AN').reduce((s, c) => s + c.area, 0);

const CONTINENT_TOTALS = Object.fromEntries(
  CONTINENTS.map((k) => [k.code, COUNTRIES.filter((c) => c.countable && c.continent === k.code).length]),
) as Record<ContinentCode, number>;

export function computeStats(data: AppData, views: Map<string, CountryView>): Stats {
  const visited = [...views.values()].filter((v) => v.status === 'visited');
  const visitedMeta = visited.map((v) => COUNTRY_BY_CODE.get(v.code)).filter((m) => m !== undefined);
  const visitedCountable = visitedMeta.filter((m) => m.countable).length;
  const territoriesVisited = visitedMeta.filter((m) => !m.countable).map((m) => m.code);
  const wishlistCountries = [...views.values()].filter((v) => v.status === 'wishlist').length;

  const visitedArea = visitedMeta.filter((m) => m.continent !== 'AN').reduce((s, m) => s + m.area, 0);

  const continents: ContinentStat[] = CONTINENTS.map((k) => {
    const inCont = visitedMeta.filter((m) => m.continent === k.code);
    return {
      code: k.code,
      name: k.name,
      visited: inCont.filter((m) => m.countable).length,
      total: CONTINENT_TOTALS[k.code],
      reached: inCont.length > 0,
    };
  });
  const continentsReached = continents.filter((c) => c.reached).length;

  const cities = Object.values(data.cities);
  const citiesVisited = cities.filter((c) => c.status === 'visited').length;
  const citiesWishlist = cities.length - citiesVisited;

  const ideas = Object.values(data.ideas);
  const ideasDone = ideas.filter((i) => i.done).length;
  const ideasUnsorted = ideas.filter((i) => !i.countryCode && !i.cityId).length;

  // Zeitleiste: Jahr -> Länder (über Land oder Stadt) und Städte
  const byYear = new Map<number, { countries: Set<string>; cities: CityRecord[] }>();
  const bucket = (y: number) => {
    let b = byYear.get(y);
    if (!b) byYear.set(y, (b = { countries: new Set(), cities: [] }));
    return b;
  };
  for (const v of visited) for (const y of v.years) bucket(y).countries.add(v.code);
  for (const c of cities) {
    if (c.status !== 'visited') continue;
    for (const y of c.years) bucket(y).cities.push(c);
  }
  const timeline: YearEntry[] = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, b]) => ({
      year,
      countries: [...b.countries].sort((x, y) =>
        (COUNTRY_BY_CODE.get(x)?.name ?? x).localeCompare(COUNTRY_BY_CODE.get(y)?.name ?? y, 'de'),
      ),
      cities: b.cities.sort((x, y) => x.name.localeCompare(y.name, 'de')),
    }));

  const stats: Omit<Stats, 'achievements'> = {
    visitedCountable,
    visitedAll: visited.length,
    territoriesVisited,
    wishlistCountries,
    worldPercent: (visitedCountable / COUNTABLE_TOTAL) * 100,
    areaPercent: TOTAL_AREA ? (visitedArea / TOTAL_AREA) * 100 : 0,
    continents,
    continentsReached,
    citiesVisited,
    citiesWishlist,
    ideasTotal: ideas.length,
    ideasOpen: ideas.length - ideasDone,
    ideasDone,
    ideasUnsorted,
    timeline,
  };
  return { ...stats, achievements: computeAchievements(stats) };
}

function goal(id: string, title: string, description: string, value: number, target: number): Achievement {
  return {
    id,
    title,
    description,
    unlocked: value >= target,
    progress: Math.min(1, value / target),
    progressLabel: `${Math.min(value, target)}/${target}`,
  };
}

function computeAchievements(s: Omit<Stats, 'achievements'>): Achievement[] {
  const inhabited = s.continents.filter((c) => c.code !== 'AN' && c.reached).length;
  return [
    goal('first', 'Erster Stempel', 'Dein erstes Land', s.visitedCountable, 1),
    goal('five', 'High Five', '5 Länder besucht', s.visitedCountable, 5),
    goal('ten', 'Zweistellig', '10 Länder besucht', s.visitedCountable, 10),
    goal('25', 'Vierteljahrhundert', '25 Länder besucht', s.visitedCountable, 25),
    goal('50', 'Halbes Hundert', '50 Länder besucht', s.visitedCountable, 50),
    goal('100', 'Dreistellig', '100 Länder besucht', s.visitedCountable, 100),
    goal('cont3', 'Kontinent-Hopping', '3 Kontinente erreicht', s.continentsReached, 3),
    goal('cont6', 'Alle sechs', 'Alle bewohnten Kontinente', inhabited, 6),
    goal('cont7', 'Bis ans Ende der Welt', 'Alle 7 Kontinente', s.continentsReached, 7),
    goal('cities10', 'Städtesammlung', '10 Städte besucht', s.citiesVisited, 10),
    goal('dream10', 'Fernweh', '10 Wunschziele', s.wishlistCountries + s.citiesWishlist, 10),
    goal('ideas25', 'Inspiriert', '25 Ideen gesammelt', s.ideasTotal, 25),
  ];
}
