export type PlatformId = 'tiktok' | 'instagram' | 'youtube' | 'gmaps' | 'amaps' | 'web' | 'none';

export interface Platform {
  id: PlatformId;
  label: string;
  /** CSS-Hintergrund für das Plattform-Badge */
  color: string;
}

const PLATFORMS: Record<PlatformId, Platform> = {
  tiktok: { id: 'tiktok', label: 'TikTok', color: 'linear-gradient(135deg, #25f4ee 0%, #111 45%, #111 55%, #fe2c55 100%)' },
  instagram: { id: 'instagram', label: 'Instagram', color: 'linear-gradient(45deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)' },
  youtube: { id: 'youtube', label: 'YouTube', color: 'linear-gradient(135deg, #ff4d4d, #c4000b)' },
  gmaps: { id: 'gmaps', label: 'Google Maps', color: 'linear-gradient(135deg, #34a853, #4285f4)' },
  amaps: { id: 'amaps', label: 'Apple Karten', color: 'linear-gradient(135deg, #5ac8fa, #34c759)' },
  web: { id: 'web', label: 'Web', color: 'linear-gradient(135deg, #5b6b93, #2c3654)' },
  none: { id: 'none', label: 'Notiz', color: 'linear-gradient(135deg, #8a7bff, #4d3fb8)' },
};

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** Holt die erste URL aus einem geteilten Text (TikTok & Co. teilen oft „Text + Link“). */
export function extractUrl(text: string): { url: string; rest: string } {
  const trimmed = text.trim();
  const m = trimmed.match(URL_RE);
  if (!m) {
    // „www.beispiel.de“ ohne Protokoll
    const www = trimmed.match(/(^|\s)(www\.[^\s]+\.[a-z]{2,}[^\s]*)/i);
    if (www) return { url: `https://${www[2]}`, rest: trimmed.replace(www[2], '').trim() };
    return { url: '', rest: trimmed };
  }
  const url = m[0].replace(/[),.;!?]+$/, '');
  const rest = trimmed.replace(m[0], '').replace(/\s+/g, ' ').trim();
  return { url, rest };
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function detectPlatform(url: string): Platform {
  if (!url) return PLATFORMS.none;
  const host = hostOf(url);
  if (!host) return PLATFORMS.web;
  if (/(^|\.)tiktok\.com$/.test(host)) return PLATFORMS.tiktok;
  if (/(^|\.)instagram\.com$/.test(host) || host === 'instagr.am') return PLATFORMS.instagram;
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return PLATFORMS.youtube;
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || /^maps\.google\./.test(host) || (/(^|\.)google\.[a-z.]+$/.test(host) && url.includes('/maps')))
    return PLATFORMS.gmaps;
  if (host === 'maps.apple.com' || host === 'maps.apple') return PLATFORMS.amaps;
  return PLATFORMS.web;
}

export function platformById(id: PlatformId): Platform {
  return PLATFORMS[id];
}

/** Platzhalter-Titel, wenn der Nutzer keinen eingibt. */
export function fallbackTitle(url: string): string {
  const p = detectPlatform(url);
  switch (p.id) {
    case 'tiktok': return 'TikTok-Video';
    case 'instagram': return url.includes('/reel') ? 'Instagram-Reel' : 'Instagram-Beitrag';
    case 'youtube': return 'YouTube-Video';
    case 'gmaps': return 'Ort in Google Maps';
    case 'amaps': return 'Ort in Apple Karten';
    case 'none': return 'Notiz';
    default: return hostOf(url) || 'Link';
  }
}

/**
 * Versucht, den Titel eines Videos über die öffentliche oEmbed-Schnittstelle zu holen.
 * Best effort: Funktioniert nur, wenn der Anbieter Browser-Anfragen (CORS) erlaubt.
 * Schlägt still fehl – der Link wird trotzdem gespeichert.
 */
export async function fetchLinkTitle(url: string, timeoutMs = 4000): Promise<string | null> {
  const p = detectPlatform(url);
  let endpoint: string | null = null;
  if (p.id === 'tiktok') endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  else if (p.id === 'youtube') endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (!endpoint || typeof fetch === 'undefined') return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: unknown };
    const title = typeof json.title === 'string' ? json.title.trim() : '';
    if (!title) return null;
    return title.length > 120 ? `${title.slice(0, 117)}…` : title;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
