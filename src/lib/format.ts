export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
}

export function formatPercent(p: number): string {
  if (p > 0 && p < 1) return `${p.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
  return `${Math.round(p).toLocaleString('de-DE')} %`;
}

export function formatArea(km2: number): string {
  return `${km2.toLocaleString('de-DE')} km²`;
}

export function relativeDays(ts: number | null): string {
  if (!ts) return 'noch nie';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'vor einem Monat' : `vor ${months} Monaten`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'vor einem Jahr' : `vor ${years} Jahren`;
}

export function yearsLabel(years: number[]): string {
  if (!years.length) return '';
  const sorted = [...years].sort((a, b) => b - a);
  if (sorted.length <= 3) return sorted.join(', ');
  return `${sorted.slice(0, 2).join(', ')} +${sorted.length - 2}`;
}
