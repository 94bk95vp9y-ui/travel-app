import { geoArea, geoBounds, geoContains, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { COUNTRIES } from '../data/countries';

export interface CountryFeature extends Feature<Polygon | MultiPolygon, { c: string }> {
  /** [[west, south], [east, north]] */
  bbox2: [[number, number], [number, number]];
}

let worldPromise: Promise<CountryFeature[]> | null = null;

/** Lädt die Ländergrenzen einmalig (werden vom Service Worker offline vorgehalten). */
export function loadWorld(): Promise<CountryFeature[]> {
  if (!worldPromise) {
    worldPromise = fetch(`${import.meta.env.BASE_URL}data/world.topo.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Weltkarte konnte nicht geladen werden (${r.status})`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { c: string }>;
        return fc.features
          .filter((f): f is Feature<Polygon | MultiPolygon, { c: string }> =>
            f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
          )
          .map((f) => {
            const fixed = fixWinding(f);
            return Object.assign(fixed, { bbox2: geoBounds(fixed) as CountryFeature['bbox2'] });
          });
      })
      .catch((e) => {
        worldPromise = null;
        throw e;
      });
  }
  return worldPromise;
}

/**
 * d3 erwartet Außenringe im Uhrzeigersinn. Ist ein Polygon „falsch herum“,
 * deckt es rechnerisch die ganze restliche Erde ab – dann Ringe umdrehen.
 */
function fixWinding<T extends Feature<Polygon | MultiPolygon, { c: string }>>(f: T): T {
  if (geoArea(f) <= 2 * Math.PI) return f;
  const g = f.geometry;
  const rev = (rings: number[][][]) => rings.map((r) => [...r].reverse());
  const geometry =
    g.type === 'Polygon'
      ? { ...g, coordinates: rev(g.coordinates) }
      : { ...g, coordinates: g.coordinates.map(rev) };
  return { ...f, geometry } as T;
}

function inBbox(b: CountryFeature['bbox2'], lng: number, lat: number): boolean {
  const [[w, s], [e, n]] = b;
  if (lat < s || lat > n) return false;
  return w <= e ? lng >= w && lng <= e : lng >= w || lng <= e; // über die Datumsgrenze
}

const TINY = COUNTRIES.filter((c) => !c.hasShape || c.area < 2500);

/**
 * Welches Land liegt an dieser Stelle? Für sehr kleine Länder gibt es
 * eine Toleranz, die mit der Zoomstufe wächst (sonst trifft man sie kaum).
 */
export function countryAt(world: CountryFeature[], lat: number, lng: number, altitude: number): string | null {
  for (const f of world) {
    if (!f.properties.c || !inBbox(f.bbox2, lng, lat)) continue;
    if (geoContains(f, [lng, lat])) return f.properties.c;
  }
  const maxDeg = Math.min(3, Math.max(0.25, altitude * 1.2));
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of TINY) {
    const d = (geoDistance([lng, lat], [c.lng, c.lat]) * 180) / Math.PI;
    if (d < maxDeg && d < bestD) {
      best = c.code;
      bestD = d;
    }
  }
  return best;
}
