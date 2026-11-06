import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, altitudeForCountry, getCountry } from '../data/countries';
import { GlobeEngine, type MarkerInput } from '../globe/engine';
import { drawStarfield } from '../globe/texture';
import { loadWorld } from '../globe/world';
import { focusCity } from '../lib/actions';
import type { Status } from '../lib/types';
import { useData } from '../store/data';
import { selectedCountryOf, useUI } from '../store/ui';

const TINY_CODES = new Set(COUNTRIES.filter((c) => !c.hasShape || c.area < 2500).map((c) => c.code));

export function GlobeView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const views = useData((s) => s.views);
  const cities = useData((s) => s.data.cities);
  const showCities = useData((s) => s.data.settings.showCities);
  const autoRotate = useData((s) => s.data.settings.autoRotate);
  const tab = useUI((s) => s.tab);
  const sheets = useUI((s) => s.sheets);
  const fly = useUI((s) => s.fly);
  const burst = useUI((s) => s.burst);
  const inset = useUI((s) => s.globeInset);
  const coverFull = useUI((s) => s.coverFull);

  const selected = tab === 'globe' ? selectedCountryOf(sheets) : null;
  const active = tab === 'globe' && !coverFull;

  // ---------------------------------------------------------- Aufbau (einmalig)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: GlobeEngine;
    try {
      engine = new GlobeEngine(host, {
        onReady: () => setReady(true),
        onCityTap: (id) => focusCity(id),
        onCountryTap: (code) => {
          const ui = useUI.getState();
          if (!code) {
            const top = ui.sheets[ui.sheets.length - 1];
            if (top && (top.spec.kind === 'country' || top.spec.kind === 'city')) ui.closeTop();
            return;
          }
          ui.showDetail({ kind: 'country', code });
          const c = getCountry(code);
          if (c) {
            const current = engine.currentAltitude();
            ui.flyTo(c.lat, c.lng, Math.max(0.36, Math.min(current, altitudeForCountry(c))));
          }
        },
      });
    } catch (e) {
      setError('3D-Grafik (WebGL) ist auf diesem Gerät nicht verfügbar.');
      console.error(e);
      return;
    }
    engineRef.current = engine;
    (window as unknown as { __globe?: GlobeEngine }).__globe = engine;

    loadWorld()
      .then((world) => engine.setWorld(world))
      .catch(() => setError('Weltkarte konnte nicht geladen werden.'));

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) engine.resize(width, height);
    });
    ro.observe(host);

    const onVis = () => engine.handleVisibility();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sternenhimmel einmal pro Größe zeichnen
  useEffect(() => {
    const paint = () => {
      if (!bgRef.current) return;
      const url = drawStarfield(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
      bgRef.current.style.setProperty('--stars', url ? `url(${url})` : 'none');
    };
    paint();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(paint, 300);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---------------------------------------------------------- Daten → Globus
  const statusMap = useMemo(() => {
    const m = new Map<string, Status>();
    for (const v of views.values()) if (v.status) m.set(v.code, v.status);
    return m;
  }, [views]);

  useEffect(() => {
    engineRef.current?.setStatuses(statusMap, selected);
  }, [statusMap, selected]);

  const markers = useMemo<MarkerInput[]>(() => {
    const out: MarkerInput[] = [];
    if (showCities) {
      for (const c of Object.values(cities)) {
        if (c.lat === null || c.lng === null) continue;
        out.push({ id: c.id, kind: 'city', lat: c.lat, lng: c.lng, status: c.status, label: c.name });
      }
    }
    for (const [code, status] of statusMap) {
      if (!TINY_CODES.has(code)) continue;
      const meta = getCountry(code);
      if (meta) out.push({ id: code, kind: 'tiny', lat: meta.lat, lng: meta.lng, status, label: meta.name });
    }
    return out;
  }, [cities, showCities, statusMap]);

  useEffect(() => {
    engineRef.current?.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    if (fly) engineRef.current?.flyTo(fly.lat, fly.lng, fly.altitude);
  }, [fly]);

  useEffect(() => {
    if (burst) engineRef.current?.burst(burst.lat, burst.lng, burst.color);
  }, [burst]);

  useEffect(() => {
    engineRef.current?.setInset(tab === 'globe' ? inset : 0);
  }, [inset, tab]);

  useEffect(() => {
    engineRef.current?.setActive(active);
  }, [active]);

  // Alle Panels geschlossen → wieder etwas herauszoomen
  const prevSheets = useRef(sheets.length);
  useEffect(() => {
    if (tab === 'globe' && prevSheets.current > 0 && sheets.length === 0) engineRef.current?.zoomOutIfClose();
    prevSheets.current = sheets.length;
  }, [sheets.length, tab]);

  useEffect(() => {
    engineRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  return (
    <div className={`globe-bg${ready ? ' is-ready' : ''}`} ref={bgRef}>
      <div className="globe-host" ref={hostRef} />
      {error && (
        <div className="globe-error">
          <p>{error}</p>
          <p className="muted">Du kannst die App trotzdem über „Orte“ nutzen.</p>
        </div>
      )}
    </div>
  );
}
