import { COUNTRY_BY_CODE } from '../data/countries';
import {
  DEFAULT_SETTINGS,
  emptyData,
  type AppData,
  type CityRecord,
  type CountryRecord,
  type IdeaCategory,
  type IdeaRecord,
  type Status,
} from './types';

const CATEGORIES: IdeaCategory[] = ['food', 'sight', 'nature', 'stay', 'activity', 'nightlife', 'other'];

export interface BackupFile {
  app: 'fernweh';
  exportedAt: string;
  data: AppData;
}

export function createBackup(data: AppData): BackupFile {
  return { app: 'fernweh', exportedAt: new Date().toISOString(), data };
}

export function backupFileName(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `fernweh-backup-${d}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const status = (v: unknown): Status | null => (v === 'visited' || v === 'wishlist' ? v : null);
const years = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((y): y is number => Number.isInteger(y) && y >= 1900 && y <= 2200))].sort((a, b) => b - a)
    : [];
const coord = (v: unknown, lim: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null;

export class BackupError extends Error {}

/**
 * Prüft und bereinigt eine Backup-Datei. Unbekannte Felder werden verworfen,
 * kaputte Einträge übersprungen. Wirft BackupError, wenn die Datei gar nicht passt.
 */
export function parseBackup(text: string): { data: AppData; skipped: number } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('Die Datei ist kein gültiges JSON.');
  }
  const root = isObj(json) && json.app === 'fernweh' && isObj(json.data) ? json.data : json;
  if (!isObj(root) || root.version !== 1 || !isObj(root.countries) || !isObj(root.cities) || !isObj(root.ideas)) {
    throw new BackupError('Das ist keine Fernweh-Sicherung (oder eine unbekannte Version).');
  }

  const out = emptyData();
  let skipped = 0;
  const now = Date.now();

  for (const [code, raw] of Object.entries(root.countries)) {
    if (!COUNTRY_BY_CODE.has(code) || !isObj(raw)) {
      skipped++;
      continue;
    }
    const rec: CountryRecord = {
      status: status(raw.status),
      years: years(raw.years),
      note: str(raw.note),
      updatedAt: num(raw.updatedAt, now),
    };
    out.countries[code] = rec;
  }

  for (const [id, raw] of Object.entries(root.cities)) {
    if (!isObj(raw) || !str(raw.name).trim() || !COUNTRY_BY_CODE.has(str(raw.countryCode)) || !status(raw.status)) {
      skipped++;
      continue;
    }
    const lat = coord(raw.lat, 90);
    const lng = coord(raw.lng, 180);
    const rec: CityRecord = {
      id,
      name: str(raw.name, 120).trim(),
      countryCode: str(raw.countryCode),
      lat: lat !== null && lng !== null ? lat : null,
      lng: lat !== null && lng !== null ? lng : null,
      status: status(raw.status) as Status,
      years: years(raw.years),
      note: str(raw.note),
      createdAt: num(raw.createdAt, now),
      updatedAt: num(raw.updatedAt, now),
    };
    out.cities[id] = rec;
  }

  for (const [id, raw] of Object.entries(root.ideas)) {
    if (!isObj(raw)) {
      skipped++;
      continue;
    }
    const cityId = str(raw.cityId);
    const city = cityId ? out.cities[cityId] : undefined;
    const countryCode = city?.countryCode ?? (COUNTRY_BY_CODE.has(str(raw.countryCode)) ? str(raw.countryCode) : null);
    const category = CATEGORIES.includes(raw.category as IdeaCategory) ? (raw.category as IdeaCategory) : 'other';
    const rec: IdeaRecord = {
      id,
      url: str(raw.url, 2000),
      title: str(raw.title, 200),
      note: str(raw.note),
      category,
      countryCode,
      cityId: city ? cityId : null,
      done: raw.done === true,
      createdAt: num(raw.createdAt, now),
      updatedAt: num(raw.updatedAt, now),
    };
    if (!rec.url && !rec.title && !rec.note) {
      skipped++;
      continue;
    }
    out.ideas[id] = rec;
  }

  const s = isObj(root.settings) ? root.settings : {};
  out.settings = {
    ...DEFAULT_SETTINGS,
    autoRotate: typeof s.autoRotate === 'boolean' ? s.autoRotate : DEFAULT_SETTINGS.autoRotate,
    showCities: typeof s.showCities === 'boolean' ? s.showCities : DEFAULT_SETTINGS.showCities,
    lastBackupAt: typeof s.lastBackupAt === 'number' ? s.lastBackupAt : null,
    onboardingDone: true,
  };

  return { data: out, skipped };
}
