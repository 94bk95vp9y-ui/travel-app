import { get, set } from 'idb-keyval';
import type { AppData } from './types';

const KEY = 'fernweh:data:v1';

export type StorageMode = 'indexeddb' | 'localstorage' | 'memory';
let mode: StorageMode = 'indexeddb';

export function storageMode(): StorageMode {
  return mode;
}

export async function loadData(): Promise<AppData | null> {
  try {
    const v = await get<AppData>(KEY);
    mode = 'indexeddb';
    return v ?? null;
  } catch {
    try {
      const raw = localStorage.getItem(KEY);
      mode = 'localstorage';
      return raw ? (JSON.parse(raw) as AppData) : null;
    } catch {
      mode = 'memory';
      return null;
    }
  }
}

async function write(data: AppData): Promise<void> {
  if (mode === 'indexeddb') {
    try {
      await set(KEY, data);
      return;
    } catch {
      mode = 'localstorage';
    }
  }
  if (mode === 'localstorage') {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      mode = 'memory';
    }
  }
}

let pending: AppData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<void> = Promise.resolve();

/** Speichert verzögert (bündelt schnelle Änderungen, z. B. beim Tippen). */
export function scheduleSave(data: AppData, delayMs = 250): void {
  pending = data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushSave, delayMs);
}

export function flushSave(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const data = pending;
  pending = null;
  if (data) chain = chain.then(() => write(data));
  return chain;
}

let flushInstalled = false;
export function installFlushOnHide(): void {
  if (flushInstalled || typeof window === 'undefined') return;
  flushInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
  window.addEventListener('pagehide', () => void flushSave());
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen (falls unterstützt). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
