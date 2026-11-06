import { create } from 'zustand';
import type { IdeaRecord, Status } from '../lib/types';

export type Tab = 'globe' | 'places' | 'ideas' | 'stats';

export type SheetSpec =
  | { kind: 'country'; code: string }
  | { kind: 'city'; id: string }
  | { kind: 'idea'; id?: string; prefill?: Partial<IdeaRecord> }
  | { kind: 'add' }
  | {
      kind: 'search';
      /** any = Länder + Städte; country/city = nur das */
      mode: 'any' | 'country' | 'city';
      countryCode?: string;
      status?: Status;
    }
  | { kind: 'settings' };

export type DetailSpec = Extract<SheetSpec, { kind: 'country' } | { kind: 'city' }>;

export interface SheetEntry {
  key: string;
  spec: SheetSpec;
}

export interface FlyTarget {
  lat: number;
  lng: number;
  altitude: number;
  nonce: number;
}

export interface Burst {
  lat: number;
  lng: number;
  color: string;
  nonce: number;
}

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

interface UIState {
  tab: Tab;
  sheets: SheetEntry[];
  fly: FlyTarget | null;
  burst: Burst | null;
  toast: Toast | null;
  /** Höhe des Panels über dem Globus (für das Verschieben des Globus) */
  globeInset: number;
  /** Ein Panel verdeckt den Globus vollständig → Globus pausieren */
  coverFull: boolean;

  setTab(tab: Tab): void;
  openSheet(spec: SheetSpec, opts?: { replaceTop?: boolean }): void;
  /** Detail anzeigen: ersetzt ein offenes Detail-Panel (z. B. Tippen auf dem Globus) */
  showDetail(spec: DetailSpec): void;
  /** Detail obendrauf legen (Navigation innerhalb eines Panels) */
  pushDetail(spec: DetailSpec): void;
  closeTop(): void;
  closeSheet(key: string): void;
  closeAll(): void;
  flyTo(lat: number, lng: number, altitude: number): void;
  celebrate(lat: number, lng: number, color: string): void;
  showToast(message: string, actionLabel?: string, action?: () => void): void;
  hideToast(id: number): void;
  setCover(px: number, full: boolean): void;
}

let seq = 0;
const key = () => `s${++seq}`;

export const useUI = create<UIState>()((set, get) => ({
  tab: 'globe',
  sheets: [],
  fly: null,
  burst: null,
  toast: null,
  globeInset: 0,
  coverFull: false,

  setTab(tab) {
    set({ tab, sheets: [] });
  },

  openSheet(spec, opts) {
    const { sheets } = get();
    if (opts?.replaceTop && sheets.length) {
      set({ sheets: [...sheets.slice(0, -1), { key: key(), spec }] });
    } else {
      set({ sheets: [...sheets, { key: key(), spec }] });
    }
  },

  showDetail(spec) {
    const sheets = get().sheets.filter((s) => !isTransient(s.spec));
    const top = sheets[sheets.length - 1];
    if (top && isDetail(top.spec)) {
      if (sameDetail(top.spec, spec)) return set({ sheets });
      // Gleichen Schlüssel behalten: Das Panel bleibt stehen, nur der Inhalt wechselt
      return set({ sheets: [...sheets.slice(0, -1), { key: top.key, spec }] });
    }
    set({ sheets: [...sheets, { key: key(), spec }] });
  },

  pushDetail(spec) {
    const sheets = get().sheets.filter((s) => !isTransient(s.spec));
    const top = sheets[sheets.length - 1];
    if (top && sameDetail(top.spec, spec)) return set({ sheets });
    set({ sheets: [...sheets, { key: key(), spec }] });
  },

  closeTop() {
    set({ sheets: get().sheets.slice(0, -1) });
  },

  closeSheet(k) {
    set({ sheets: get().sheets.filter((s) => s.key !== k) });
  },

  closeAll() {
    set({ sheets: [] });
  },

  flyTo(lat, lng, altitude) {
    set({ fly: { lat, lng, altitude, nonce: Date.now() + Math.random() } });
  },

  celebrate(lat, lng, color) {
    set({ burst: { lat, lng, color, nonce: Date.now() + Math.random() } });
  },

  showToast(message, actionLabel, action) {
    const id = Date.now() + Math.random();
    set({ toast: { id, message, actionLabel, action } });
    setTimeout(() => get().hideToast(id), actionLabel ? 5000 : 2600);
  },

  hideToast(id) {
    if (get().toast?.id === id) set({ toast: null });
  },

  setCover(px, full) {
    const cur = get();
    if (Math.abs(cur.globeInset - px) > 1 || cur.coverFull !== full) set({ globeInset: px, coverFull: full });
  },
}));

const isTransient = (s: SheetSpec) => s.kind === 'search' || s.kind === 'add';
const isDetail = (s: SheetSpec) => s.kind === 'country' || s.kind === 'city';

function sameDetail(a: SheetSpec, b: SheetSpec): boolean {
  if (a.kind === 'country' && b.kind === 'country') return a.code === b.code;
  if (a.kind === 'city' && b.kind === 'city') return a.id === b.id;
  return false;
}

/** Ausgewähltes Land für die Hervorhebung auf dem Globus */
export function selectedCountryOf(sheets: SheetEntry[]): string | null {
  for (let i = sheets.length - 1; i >= 0; i--) {
    const s = sheets[i].spec;
    if (s.kind === 'country') return s.code;
    if (s.kind === 'city') return null;
  }
  return null;
}
