import { create } from 'zustand';
import { deriveCountries, type CountryView } from '../lib/status';
import { emptyData, type AppData, type CityRecord, type IdeaRecord, type Settings, type Status } from '../lib/types';
import { flushSave, installFlushOnHide, loadData, requestPersistence, scheduleSave } from '../lib/persist';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface NewCity {
  name: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  status: Status;
  years?: number[];
}

export type NewIdea = Pick<IdeaRecord, 'url' | 'title' | 'note' | 'category' | 'countryCode' | 'cityId'>;

interface DataState {
  data: AppData;
  views: Map<string, CountryView>;
  hydrated: boolean;

  hydrate(): Promise<void>;
  setCountryStatus(code: string, status: Status | null): void;
  toggleCountryYear(code: string, year: number): void;
  setCountryNote(code: string, note: string): void;
  addCity(input: NewCity): string;
  updateCity(id: string, patch: Partial<Omit<CityRecord, 'id' | 'createdAt'>>): void;
  toggleCityYear(id: string, year: number): void;
  deleteCity(id: string): void;
  /** Rückgängig: Stadt und ihre Ideen-Verknüpfungen wiederherstellen */
  restoreCity(city: CityRecord, ideaIds: string[]): void;
  addIdea(input: NewIdea): string;
  updateIdea(id: string, patch: Partial<Omit<IdeaRecord, 'id' | 'createdAt'>>): void;
  deleteIdea(id: string): void;
  restoreIdea(idea: IdeaRecord): void;
  updateSettings(patch: Partial<Settings>): void;
  replaceAll(data: AppData): void;
  restore(snapshot: AppData): void;
  resetAll(): void;
}

const toggle = (list: number[], y: number) =>
  (list.includes(y) ? list.filter((x) => x !== y) : [...list, y]).sort((a, b) => b - a);

/** Leere Länder-Einträge entfernen, damit die Daten sauber bleiben. */
function pruneCountry(data: AppData, code: string): AppData {
  const rec = data.countries[code];
  if (rec && !rec.status && rec.years.length === 0 && !rec.note.trim()) {
    const countries = { ...data.countries };
    delete countries[code];
    return { ...data, countries };
  }
  return data;
}

export const useData = create<DataState>()((set, get) => {
  /** Zentrale Änderungsfunktion: neue Daten setzen, Ansichten neu ableiten, speichern. */
  const commit = (next: AppData) => {
    set({ data: next, views: deriveCountries(next) });
    scheduleSave(next);
    if (!persistAsked) {
      persistAsked = true;
      void requestPersistence();
    }
  };
  let persistAsked = false;

  const countryRec = (code: string) =>
    get().data.countries[code] ?? { status: null, years: [], note: '', updatedAt: Date.now() };

  return {
    data: emptyData(),
    views: new Map(),
    hydrated: false,

    async hydrate() {
      installFlushOnHide();
      const loaded = await loadData();
      const data = loaded && loaded.version === 1 ? { ...emptyData(), ...loaded, settings: { ...emptyData().settings, ...loaded.settings } } : emptyData();
      set({ data, views: deriveCountries(data), hydrated: true });
    },

    setCountryStatus(code, status) {
      const { data } = get();
      const rec = { ...countryRec(code), status, updatedAt: Date.now() };
      // Beim Entfernen des Status auch die Jahre des Landes entfernen
      if (status === null) rec.years = [];
      commit(pruneCountry({ ...data, countries: { ...data.countries, [code]: rec } }, code));
    },

    toggleCountryYear(code, year) {
      const { data } = get();
      const cur = countryRec(code);
      const rec = { ...cur, years: toggle(cur.years, year), updatedAt: Date.now() };
      commit(pruneCountry({ ...data, countries: { ...data.countries, [code]: rec } }, code));
    },

    setCountryNote(code, note) {
      const { data } = get();
      const rec = { ...countryRec(code), note, updatedAt: Date.now() };
      commit(pruneCountry({ ...data, countries: { ...data.countries, [code]: rec } }, code));
    },

    addCity(input) {
      const { data } = get();
      // Gleiche Stadt im gleichen Land nicht doppelt anlegen
      const existing = Object.values(data.cities).find(
        (c) => c.countryCode === input.countryCode && c.name.toLowerCase() === input.name.trim().toLowerCase(),
      );
      if (existing) return existing.id;
      const now = Date.now();
      const city: CityRecord = {
        id: newId(),
        name: input.name.trim(),
        countryCode: input.countryCode,
        lat: input.lat,
        lng: input.lng,
        status: input.status,
        years: input.years ?? [],
        note: '',
        createdAt: now,
        updatedAt: now,
      };
      commit({ ...data, cities: { ...data.cities, [city.id]: city } });
      return city.id;
    },

    updateCity(id, patch) {
      const { data } = get();
      const cur = data.cities[id];
      if (!cur) return;
      const next: CityRecord = { ...cur, ...patch, updatedAt: Date.now() };
      if (next.status === 'wishlist') next.years = [];
      commit({ ...data, cities: { ...data.cities, [id]: next } });
    },

    toggleCityYear(id, year) {
      const cur = get().data.cities[id];
      if (cur) get().updateCity(id, { years: toggle(cur.years, year) });
    },

    deleteCity(id) {
      const { data } = get();
      if (!data.cities[id]) return;
      const cities = { ...data.cities };
      delete cities[id];
      // Ideen bleiben erhalten und hängen danach am Land
      const ideas = Object.fromEntries(
        Object.entries(data.ideas).map(([k, i]) => [k, i.cityId === id ? { ...i, cityId: null } : i]),
      );
      commit({ ...data, cities, ideas });
    },

    restoreCity(city, ideaIds) {
      const { data } = get();
      const ideas = { ...data.ideas };
      for (const iid of ideaIds) if (ideas[iid]) ideas[iid] = { ...ideas[iid], cityId: city.id, countryCode: city.countryCode };
      commit({ ...data, cities: { ...data.cities, [city.id]: city }, ideas });
    },

    addIdea(input) {
      const { data } = get();
      const now = Date.now();
      const cityCountry = input.cityId ? data.cities[input.cityId]?.countryCode : null;
      const idea: IdeaRecord = {
        id: newId(),
        url: input.url.trim(),
        title: input.title.trim(),
        note: input.note.trim(),
        category: input.category,
        countryCode: cityCountry ?? input.countryCode,
        cityId: cityCountry ? input.cityId : null,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      commit({ ...data, ideas: { ...data.ideas, [idea.id]: idea } });
      return idea.id;
    },

    updateIdea(id, patch) {
      const { data } = get();
      const cur = data.ideas[id];
      if (!cur) return;
      const next: IdeaRecord = { ...cur, ...patch, updatedAt: Date.now() };
      if (next.cityId) next.countryCode = data.cities[next.cityId]?.countryCode ?? next.countryCode;
      commit({ ...data, ideas: { ...data.ideas, [id]: next } });
    },

    deleteIdea(id) {
      const { data } = get();
      if (!data.ideas[id]) return;
      const ideas = { ...data.ideas };
      delete ideas[id];
      commit({ ...data, ideas });
    },

    restoreIdea(idea) {
      const { data } = get();
      commit({ ...data, ideas: { ...data.ideas, [idea.id]: idea } });
    },

    updateSettings(patch) {
      const { data } = get();
      commit({ ...data, settings: { ...data.settings, ...patch } });
    },

    replaceAll(next) {
      commit(next);
      void flushSave();
    },

    restore(snapshot) {
      commit(snapshot);
    },

    resetAll() {
      const fresh = emptyData();
      fresh.settings.onboardingDone = true;
      commit(fresh);
      void flushSave();
    },
  };
});
