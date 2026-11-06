export type Status = 'visited' | 'wishlist';

export interface CountryRecord {
  /** Manuell gesetzter Status. Der angezeigte Status wird zusätzlich aus Städten abgeleitet. */
  status: Status | null;
  years: number[];
  note: string;
  updatedAt: number;
}

export interface CityRecord {
  id: string;
  name: string;
  countryCode: string;
  /** null = ohne Koordinaten (manuell angelegt), erscheint dann nicht auf dem Globus */
  lat: number | null;
  lng: number | null;
  status: Status;
  years: number[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type IdeaCategory = 'food' | 'sight' | 'nature' | 'stay' | 'activity' | 'nightlife' | 'other';

export interface IdeaRecord {
  id: string;
  url: string;
  title: string;
  note: string;
  category: IdeaCategory;
  countryCode: string | null;
  cityId: string | null;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  autoRotate: boolean;
  showCities: boolean;
  lastBackupAt: number | null;
  onboardingDone: boolean;
}

export interface AppData {
  version: 1;
  countries: Record<string, CountryRecord>;
  cities: Record<string, CityRecord>;
  ideas: Record<string, IdeaRecord>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  autoRotate: true,
  showCities: true,
  lastBackupAt: null,
  onboardingDone: false,
};

export function emptyData(): AppData {
  return { version: 1, countries: {}, cities: {}, ideas: {}, settings: { ...DEFAULT_SETTINGS } };
}
