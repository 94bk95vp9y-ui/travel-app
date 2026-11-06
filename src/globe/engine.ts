import Globe, { type GlobeInstance } from 'globe.gl';
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  SRGBColorSpace,
  type MeshPhongMaterial,
  type PerspectiveCamera,
} from 'three';
import type { Status } from '../lib/types';
import { drawWorldTexture } from './texture';
import { countryAt, type CountryFeature } from './world';

const POLY = {
  visited: { cap: 'rgba(255, 184, 76, 0.93)', side: 'rgba(255, 138, 61, 0.55)', stroke: 'rgba(255, 232, 186, 0.9)' },
  wishlist: { cap: 'rgba(167, 139, 250, 0.88)', side: 'rgba(124, 92, 255, 0.5)', stroke: 'rgba(228, 220, 255, 0.9)' },
  selected: { cap: 'rgba(205, 220, 255, 0.24)', side: 'rgba(160, 190, 255, 0.22)', stroke: 'rgba(255, 255, 255, 0.95)' },
};

const ALT = { status: 0.007, selected: 0.032 };

interface PolyItem {
  code: string;
  feature: CountryFeature;
}

export interface MarkerInput {
  id: string;
  kind: 'city' | 'tiny';
  lat: number;
  lng: number;
  status: Status;
  label: string;
}

interface MarkerItem extends MarkerInput {
  el: HTMLElement;
}

interface RingItem {
  lat: number;
  lng: number;
  color: string;
}

export interface EngineCallbacks {
  onCountryTap(code: string | null): void;
  onCityTap(id: string): void;
  onReady(): void;
}

const LABEL_ALTITUDE = 1.15;
const AUTO_ROTATE_RESUME_MS = 9000;
const AUTO_ROTATE_MAX_MS = 60000;

/**
 * Kapselt globe.gl. React ruft nur Methoden auf; die Szene wird nie neu aufgebaut.
 *
 * Akku/Leistung: Die Render-Schleife läuft nur, solange sich etwas bewegt
 * (Drehen, Fingerbewegung, Animationen). Danach wird sie pausiert.
 */
export class GlobeEngine {
  private globe: GlobeInstance;
  private world: CountryFeature[] = [];
  private polyItems = new Map<CountryFeature, PolyItem>();
  private statuses = new Map<string, Status>();
  private selected: string | null = null;
  private markers = new Map<string, MarkerItem>();
  private rings: RingItem[] = [];

  private running = true;
  private active = true;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepAt = 0;
  private autoRotateWanted = true;
  private lastInteraction = 0;
  private rotateStartedAt = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private insetTween: number | null = null;
  private insetY = 0;
  private labelsShown = false;
  private destroyed = false;
  private userMovedCamera = false;

  constructor(
    private container: HTMLElement,
    private cb: EngineCallbacks,
  ) {
    this.globe = new Globe(container, {
      animateIn: true,
      waitForGlobeReady: true,
      rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' },
    });
    const g = this.globe;

    g.backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#5d8dff')
      .atmosphereAltitude(0.2)
      .showGraticules(false)
      .globeCurvatureResolution(3)
      .pointOfView({ lat: 28, lng: 14, altitude: 2.35 })
      // Länder mit Status
      .polygonsData([])
      .polygonGeoJsonGeometry((d) => (d as PolyItem).feature.geometry as never)
      .polygonCapCurvatureResolution(3)
      .polygonsTransitionDuration(450)
      .onPolygonClick((d) => this.handleCountry((d as PolyItem).code))
      .onGlobeClick(({ lat, lng }) => {
        const alt = this.globe.pointOfView().altitude;
        this.handleCountry(countryAt(this.world, lat, lng, alt));
      })
      // Städte & Kleinstaaten als HTML-Marker
      .htmlElementsData([])
      .htmlLat((d) => (d as MarkerItem).lat)
      .htmlLng((d) => (d as MarkerItem).lng)
      .htmlAltitude(0.004)
      .htmlElement((d) => (d as MarkerItem).el)
      .htmlElementVisibilityModifier((el, visible) => {
        el.classList.toggle('gm--hidden', !visible);
      })
      .htmlTransitionDuration(0)
      // Ring-Effekt beim Markieren
      .ringsData([])
      .ringColor((d: object) => {
        const c = new Color((d as RingItem).color);
        const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
        return (t: number) => `rgba(${rgb}, ${Math.max(0, 1 - t)})`;
      })
      .ringMaxRadius(7)
      .ringPropagationSpeed(5)
      .ringRepeatPeriod(650)
      .ringAltitude(0.012)
      .onZoom((pov) => this.updateLabels(pov.altitude))
      .onGlobeReady(() => this.cb.onReady());

    this.applyPolygonStyles();

    // Beleuchtung: weiches Grundlicht + Licht von links oben relativ zur Kamera
    const camera = g.camera();
    const scene = g.scene();
    g.lights([new AmbientLight(0xffffff, 2.1)]);
    const key = new DirectionalLight(0xdfe8ff, 1.9);
    key.position.set(-1.4, 1.1, 1.6);
    camera.add(key);
    scene.add(camera);

    // Globus-Material: Textur folgt, sobald die Karte geladen ist
    const mat = g.globeMaterial() as MeshPhongMaterial;
    mat.color = new Color('#16233f');
    mat.specular = new Color('#203a7a');
    mat.shininess = 14;

    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.42;
    controls.minDistance = 100 * 1.08; // nicht unter ~8 % des Radius zoomen
    const rect = container.getBoundingClientRect();
    this.applyFit(rect.width || window.innerWidth, rect.height || window.innerHeight, true);
    controls.addEventListener('start', () => this.onUserStart());
    controls.addEventListener('end', () => this.onUserEnd());

    // Jede Berührung weckt die Render-Schleife sofort auf
    const wakeNow = () => this.wake(1400);
    container.addEventListener('pointerdown', wakeNow, { capture: true, passive: true });
    container.addEventListener('pointermove', (e) => e.buttons && this.wake(1400), { capture: true, passive: true });
    container.addEventListener('wheel', wakeNow, { capture: true, passive: true });
    container.addEventListener('touchstart', wakeNow, { capture: true, passive: true });

    // Tipp ins All (neben den Globus) schließt das Panel – globe.gl meldet dafür kein Ereignis
    let down: { x: number; y: number; t: number; id: number } | null = null;
    container.addEventListener(
      'pointerdown',
      (e) => {
        down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
      },
      { capture: true, passive: true },
    );
    container.addEventListener(
      'pointerup',
      (e) => {
        const d = down;
        down = null;
        if (!d || d.id !== e.pointerId) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
        const rect = container.getBoundingClientRect();
        if (!this.globe.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top)) this.handleCountry(null);
      },
      { capture: true, passive: true },
    );

    this.rotateStartedAt = performance.now();
    this.wake(2500);
  }

  // ------------------------------------------------------------ Daten

  setWorld(world: CountryFeature[]): void {
    this.world = world;
    for (const f of world) if (f.properties.c) this.polyItems.set(f, { code: f.properties.c, feature: f });

    const renderer = this.globe.renderer();
    const canvas = drawWorldTexture(world, renderer.capabilities.maxTextureSize);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = this.globe.globeMaterial() as MeshPhongMaterial;
    mat.map = tex;
    mat.color = new Color('#ffffff');
    mat.needsUpdate = true;
    this.refreshPolygons();
    this.wake(1200);
  }

  setStatuses(statuses: Map<string, Status>, selected: string | null): void {
    this.statuses = statuses;
    this.selected = selected;
    this.refreshPolygons();
    this.updateAutoRotate();
    this.wake(900);
  }

  setMarkers(inputs: MarkerInput[]): void {
    const next = new Map<string, MarkerItem>();
    for (const m of inputs) {
      const key = `${m.kind}:${m.id}`;
      let item = this.markers.get(key);
      if (!item) item = { ...m, el: this.createMarkerEl(m) };
      else if (item.status !== m.status || item.label !== m.label || item.lat !== m.lat || item.lng !== m.lng) {
        Object.assign(item, m);
        this.styleMarkerEl(item.el, m);
      }
      next.set(key, item);
    }
    this.markers = next;
    this.globe.htmlElementsData([...next.values()]);
    this.wake(600);
  }

  // ------------------------------------------------------------ Kamera

  flyTo(lat: number, lng: number, altitude: number, ms = 1100): void {
    this.userMovedCamera = true;
    this.globe.pointOfView({ lat, lng, altitude }, ms);
    this.markInteraction();
    this.wake(ms + 400);
  }

  /** Nach dem Schließen eines Panels sanft herauszoomen (Überblick zurück). */
  zoomOutIfClose(): void {
    const pov = this.globe.pointOfView();
    const rect = this.container.getBoundingClientRect();
    const target = Math.min(this.fitAltitude(rect.width || window.innerWidth, rect.height || window.innerHeight), 2.6);
    if (pov.altitude < target * 0.7) this.flyTo(pov.lat, pov.lng, Math.max(pov.altitude, target * 0.8), 1000);
  }

  burst(lat: number, lng: number, color: string): void {
    const ring: RingItem = { lat, lng, color };
    this.rings = [...this.rings, ring];
    this.globe.ringsData(this.rings);
    this.wake(2300);
    setTimeout(() => {
      if (this.destroyed) return;
      this.rings = this.rings.filter((r) => r !== ring);
      this.globe.ringsData(this.rings);
      this.wake(300);
    }, 1900);
  }

  /** Schiebt den Globus nach oben, wenn unten ein Panel offen ist. */
  setInset(px: number): void {
    const target = -px / 2;
    if (this.insetTween) cancelAnimationFrame(this.insetTween);
    const from = this.insetY;
    if (Math.abs(target - from) < 1) return;
    const start = performance.now();
    const dur = 480;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.insetY = from + (target - from) * e;
      this.globe.globeOffset([0, this.insetY]);
      if (t < 1) this.insetTween = requestAnimationFrame(step);
      else this.insetTween = null;
    };
    this.wake(dur + 300);
    this.insetTween = requestAnimationFrame(step);
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotateWanted = enabled;
    this.rotateStartedAt = performance.now();
    this.updateAutoRotate();
    this.wake(800);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.sleep();
    else {
      this.rotateStartedAt = performance.now();
      this.updateAutoRotate();
      this.wake(1200);
    }
  }

  resize(w: number, h: number): void {
    this.globe.width(w).height(h);
    this.applyFit(w, h, !this.userMovedCamera);
    this.wake(400);
  }

  /** Kamerahöhe, bei der der ganze Globus (mit etwas Rand) ins Bild passt – auch im Hochformat. */
  private fitAltitude(w: number, h: number): number {
    const cam = this.globe.camera() as PerspectiveCamera;
    const vHalf = ((cam.fov || 50) * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (w / h));
    const half = Math.min(vHalf, hHalf);
    return 1 / Math.sin(half * 0.9) - 1;
  }

  private applyFit(w: number, h: number, moveCamera: boolean): void {
    const fit = this.fitAltitude(w, h);
    this.globe.controls().maxDistance = 100 * (fit + 1.6);
    if (moveCamera) {
      const pov = this.globe.pointOfView();
      this.globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: fit });
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.globe.pauseAnimation();
    this.globe._destructor();
    this.container.innerHTML = '';
  }

  currentAltitude(): number {
    return this.globe.pointOfView().altitude;
  }

  /** Für Tests: Bildschirmposition eines Ortes */
  screenCoords(lat: number, lng: number): { x: number; y: number } {
    return this.globe.getScreenCoords(lat, lng);
  }

  /** Für Tests/Diagnose: Anzahl Draw-Calls im letzten Frame */
  debugInfo() {
    const info = this.globe.renderer().info;
    return { calls: info.render.calls, triangles: info.render.triangles, running: this.running };
  }

  // ------------------------------------------------------------ intern

  private handleCountry(code: string | null): void {
    this.markInteraction();
    this.cb.onCountryTap(code);
  }

  private refreshPolygons(): void {
    const items: PolyItem[] = [];
    for (const item of this.polyItems.values()) {
      if (this.statuses.has(item.code) || item.code === this.selected) items.push(item);
    }
    this.globe.polygonsData(items);
    this.applyPolygonStyles();
  }

  private applyPolygonStyles(): void {
    const style = (code: string) => {
      const s = this.statuses.get(code);
      return s ? POLY[s] : POLY.selected;
    };
    this.globe
      .polygonCapColor((d) => style((d as PolyItem).code).cap)
      .polygonSideColor((d) => style((d as PolyItem).code).side)
      .polygonStrokeColor((d) => {
        const code = (d as PolyItem).code;
        return code === this.selected ? POLY.selected.stroke : style(code).stroke;
      })
      .polygonAltitude((d) => ((d as PolyItem).code === this.selected ? ALT.selected : ALT.status));
  }

  private createMarkerEl(m: MarkerInput): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = '<span class="gm-pulse"></span><span class="gm-dot"></span><span class="gm-label"></span>';
    this.styleMarkerEl(el, m);
    el.style.pointerEvents = 'auto';
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = [...this.markers.values()].find((x) => x.el === el);
      if (!item) return;
      this.markInteraction();
      if (item.kind === 'city') this.cb.onCityTap(item.id);
      else this.cb.onCountryTap(item.id);
    });
    return el;
  }

  private styleMarkerEl(el: HTMLElement, m: MarkerInput): void {
    el.className = `gm gm--${m.kind} gm--${m.status}${el.classList.contains('gm--hidden') ? ' gm--hidden' : ''}`;
    const label = el.querySelector('.gm-label');
    if (label) label.textContent = m.label;
  }

  private updateLabels(altitude: number): void {
    const show = altitude < LABEL_ALTITUDE;
    if (show !== this.labelsShown) {
      this.labelsShown = show;
      this.container.classList.toggle('show-labels', show);
    }
  }

  private markInteraction(): void {
    this.lastInteraction = performance.now();
    this.updateAutoRotate();
    this.scheduleRotateResume();
  }

  private onUserStart(): void {
    this.userMovedCamera = true;
    this.markInteraction();
    this.wake(1500);
  }

  private onUserEnd(): void {
    this.markInteraction();
    this.wake(1500); // Nachlaufen (Damping) noch rendern
  }

  private scheduleRotateResume(): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.rotateStartedAt = performance.now();
      this.updateAutoRotate();
      this.wake(800);
    }, AUTO_ROTATE_RESUME_MS);
  }

  private shouldRotate(): boolean {
    const now = performance.now();
    return (
      this.active &&
      this.autoRotateWanted &&
      !this.selected &&
      now - this.lastInteraction > AUTO_ROTATE_RESUME_MS - 50 &&
      now - this.rotateStartedAt < AUTO_ROTATE_MAX_MS
    );
  }

  private updateAutoRotate(): void {
    this.globe.controls().autoRotate = this.shouldRotate();
  }

  /**
   * Render-Schleife (wieder) starten und frühestens nach `ms` pausieren.
   * Eine kürzere Anfrage verkürzt nie eine laufende längere (z. B. Kameraflug).
   */
  private wake(ms: number): void {
    if (this.destroyed || !this.active || document.visibilityState === 'hidden') return;
    if (!this.running) {
      this.running = true;
      this.globe.resumeAnimation();
    }
    const at = performance.now() + ms;
    if (this.sleepTimer && at <= this.sleepAt) return;
    this.sleepAt = at;
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => this.trySleep(), ms);
  }

  private trySleep(): void {
    this.updateAutoRotate();
    if (this.globe.controls().autoRotate || this.rings.length || this.insetTween) {
      // Dreht noch → später erneut prüfen (stoppt spätestens nach AUTO_ROTATE_MAX_MS)
      this.sleepAt = performance.now() + 1000;
      this.sleepTimer = setTimeout(() => this.trySleep(), 1000);
      return;
    }
    this.sleep();
  }

  private sleep(): void {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null;
    this.sleepAt = 0;
    if (this.running) {
      this.running = false;
      this.globe.pauseAnimation();
    }
  }

  handleVisibility(): void {
    if (document.visibilityState === 'hidden') this.sleep();
    else this.wake(1000);
  }
}
