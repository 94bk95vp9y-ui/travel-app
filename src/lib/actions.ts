import { altitudeForCountry, getCountry } from '../data/countries';
import { STATUS_COLORS } from './colors';
import { useData } from '../store/data';
import { useUI } from '../store/ui';
import type { Status } from './types';

/** Land öffnen und auf dem Globus anfliegen. */
export function focusCountry(code: string, opts: { push?: boolean; fly?: boolean } = {}): void {
  const ui = useUI.getState();
  if (opts.push) ui.pushDetail({ kind: 'country', code });
  else ui.showDetail({ kind: 'country', code });
  if (opts.fly !== false) flyToCountry(code);
}

export function flyToCountry(code: string): void {
  const c = getCountry(code);
  if (!c) return;
  const ui = useUI.getState();
  const target = altitudeForCountry(c);
  ui.flyTo(c.lat, c.lng, target);
}

export function focusCity(id: string, opts: { push?: boolean } = {}): void {
  const city = useData.getState().data.cities[id];
  if (!city) return;
  const ui = useUI.getState();
  if (opts.push) ui.pushDetail({ kind: 'city', id });
  else ui.showDetail({ kind: 'city', id });
  if (city.lat !== null && city.lng !== null) ui.flyTo(city.lat, city.lng, 0.55);
  else flyToCountry(city.countryCode);
}

/** Status eines Landes setzen – mit kleinem Ring-Effekt auf dem Globus. */
export function markCountry(code: string, status: Status | null): void {
  const data = useData.getState();
  const before = data.views.get(code)?.status ?? null;
  data.setCountryStatus(code, status);
  const after = useData.getState().views.get(code)?.status ?? null;
  if (after && after !== before) {
    const c = getCountry(code);
    if (c) useUI.getState().celebrate(c.lat, c.lng, STATUS_COLORS[after]);
    vibrate();
  }
}

export function celebrateCity(id: string): void {
  const city = useData.getState().data.cities[id];
  if (city?.lat != null && city.lng != null) {
    useUI.getState().celebrate(city.lat, city.lng, STATUS_COLORS[city.status]);
  }
  vibrate();
}

/** Zufälliges Wunschziel (Land oder Stadt) */
export function randomDestination(): { kind: 'country'; code: string } | { kind: 'city'; id: string } | null {
  const { data, views } = useData.getState();
  const pool: ({ kind: 'country'; code: string } | { kind: 'city'; id: string })[] = [];
  for (const v of views.values()) if (v.status === 'wishlist') pool.push({ kind: 'country', code: v.code });
  for (const c of Object.values(data.cities)) if (c.status === 'wishlist') pool.push({ kind: 'city', id: c.id });
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Kurzes haptisches Feedback, wo der Browser es kann (iOS Safari: nicht unterstützt). */
export function vibrate(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* egal */
  }
}

/**
 * iOS zeigt die Tastatur nur, wenn ein Eingabefeld direkt im Tipp-Ereignis fokussiert wird.
 * Wir fokussieren daher sofort ein unsichtbares Feld; das echte Feld übernimmt den Fokus,
 * sobald es erscheint – die Tastatur bleibt offen.
 */
export function primeKeyboard(): void {
  const el = document.createElement('input');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;height:0;width:0;font-size:16px;pointer-events:none;';
  document.body.appendChild(el);
  el.focus();
  setTimeout(() => el.remove(), 1200);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
