import { geoEquirectangular, geoGraticule, geoPath } from 'd3-geo';
import type { CountryFeature } from './world';

export const GLOBE_COLORS = {
  oceanTop: '#0b1a3d',
  oceanMid: '#0a1838',
  oceanBottom: '#081431',
  graticule: 'rgba(130, 165, 255, 0.07)',
  land: '#1d2a49',
  landAntarctica: '#24335a',
  border: 'rgba(155, 185, 245, 0.30)',
  coastGlow: 'rgba(110, 150, 255, 0.10)',
};

/**
 * Zeichnet die Weltkarte einmalig in eine Canvas (equirektangulär).
 * Der Globus nutzt sie als Textur: ein einziger Draw-Call für alle Länder.
 * Nur Länder mit Status werden zusätzlich als 3D-Flächen gezeichnet.
 */
export function drawWorldTexture(world: CountryFeature[], maxTextureSize: number): HTMLCanvasElement {
  const width = Math.min(4096, maxTextureSize || 4096);
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
    .precision(0.2);
  const path = geoPath(projection, ctx);
  const px = width / 4096; // Strichstärken relativ zur Auflösung

  // Ozean mit leichtem Verlauf
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, GLOBE_COLORS.oceanTop);
  ocean.addColorStop(0.5, GLOBE_COLORS.oceanMid);
  ocean.addColorStop(1, GLOBE_COLORS.oceanBottom);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  // Gradnetz
  ctx.beginPath();
  path(geoGraticule().step([15, 15])());
  ctx.strokeStyle = GLOBE_COLORS.graticule;
  ctx.lineWidth = 1.4 * px;
  ctx.stroke();

  // Küsten-Schein (breite, sehr transparente Linie unter dem Land)
  ctx.beginPath();
  for (const f of world) path(f);
  ctx.strokeStyle = GLOBE_COLORS.coastGlow;
  ctx.lineWidth = 7 * px;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Landflächen
  for (const f of world) {
    ctx.beginPath();
    path(f);
    ctx.fillStyle = f.properties.c === 'AQ' ? GLOBE_COLORS.landAntarctica : GLOBE_COLORS.land;
    ctx.fill();
  }

  // Grenzen
  ctx.beginPath();
  for (const f of world) path(f);
  ctx.strokeStyle = GLOBE_COLORS.border;
  ctx.lineWidth = 1.5 * px;
  ctx.stroke();

  return canvas;
}

/** Statischer Sternenhimmel als Hintergrundbild (einmal erzeugt, kostet danach nichts). */
export function drawStarfield(w: number, h: number, dpr: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(dpr, dpr);
  // deterministischer Zufall, damit der Himmel immer gleich aussieht
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const count = Math.round((w * h) / 2600);
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rnd() < 0.92 ? rnd() * 0.7 + 0.25 : rnd() * 1.1 + 0.8;
    const a = rnd() * 0.55 + 0.15;
    const tint = rnd();
    ctx.fillStyle = tint < 0.15 ? `rgba(255, 214, 170, ${a})` : tint < 0.35 ? `rgba(180, 200, 255, ${a})` : `rgba(255, 255, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}
