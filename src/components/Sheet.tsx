import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type Snap = 'half' | 'full';

interface SheetCtx {
  close(): void;
  expand(): void;
  snap: Snap;
}

const Ctx = createContext<SheetCtx>({ close() {}, expand() {}, snap: 'full' });
export const useSheet = () => useContext(Ctx);

interface SheetProps {
  snaps: Snap[];
  initial: Snap;
  modal: boolean;
  isTop: boolean;
  depth: number;
  /** Nach der Schließ-Animation */
  onClosed(): void;
  /** Sichtbare Höhe (für den Globus), nur für das oberste Panel */
  onCover?(px: number, full: boolean): void;
  header?: ReactNode;
  children: ReactNode;
  /** Kompakte Höhe statt halber Bildschirm (für kurze Menüs) */
  halfRatio?: number;
  label: string;
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURATION = 480;

function safeTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

export function Sheet({
  snaps,
  initial,
  modal,
  isTop,
  depth,
  onClosed,
  onCover,
  header,
  children,
  halfRatio = 0.52,
  label,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [top] = useState(() => safeTop());
  const [snap, setSnap] = useState<Snap>(initial);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const closingRef = useRef(false);
  const posRef = useRef(0);

  const fullH = Math.max(320, vh - top - 10);
  const halfH = Math.min(fullH, Math.round(vh * halfRatio));
  const offsetOf = useCallback((s: Snap) => (s === 'full' ? 0 : fullH - halfH), [fullH, halfH]);
  const closedOffset = fullH + 60;

  const apply = useCallback(
    (y: number, animate: boolean) => {
      const el = sheetRef.current;
      if (!el) return;
      posRef.current = y;
      el.style.transition = animate ? `transform ${DURATION}ms ${EASE}` : 'none';
      el.style.transform = `translate3d(0, ${y}px, 0)`;
      const bd = backdropRef.current;
      if (bd) {
        const rest = snaps.includes('half') ? fullH - halfH : 0;
        const visible = Math.max(0, Math.min(1, 1 - (y - rest) / (fullH + 60 - rest)));
        bd.style.transition = animate ? `opacity ${DURATION}ms ${EASE}` : 'none';
        bd.style.opacity = String(visible);
      }
    },
    [fullH, halfH, snaps],
  );

  const report = useCallback(
    (s: Snap | 'closed') => {
      if (!isTop || !onCover) return;
      if (s === 'closed') onCover(0, false);
      else onCover(s === 'full' ? fullH : halfH, modal || s === 'full');
    },
    [fullH, halfH, isTop, modal, onCover],
  );

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    apply(closedOffset, true);
    report('closed');
    setTimeout(onClosed, DURATION - 120);
  }, [apply, closedOffset, onClosed, report]);

  const goTo = useCallback(
    (s: Snap) => {
      setSnap(s);
      apply(offsetOf(s), true);
      report(s);
    },
    [apply, offsetOf, report],
  );

  const expand = useCallback(() => {
    if (snaps.includes('full')) goTo('full');
  }, [goTo, snaps]);

  // Einfahren
  useLayoutEffect(() => {
    apply(closedOffset, false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => apply(offsetOf(snapRef.current), true));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Größe/oberstes Panel geändert → neu ausrichten und melden
  useEffect(() => {
    if (!closingRef.current) {
      apply(offsetOf(snapRef.current), true);
      report(snapRef.current);
    }
  }, [vh, isTop, apply, offsetOf, report]);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ------------------------------------------------------------ Ziehen
  const drag = useRef({ active: false, startY: 0, startPos: 0, samples: [] as { y: number; t: number }[] });

  const begin = useCallback((y: number) => {
    drag.current = { active: true, startY: y, startPos: posRef.current, samples: [{ y, t: performance.now() }] };
  }, []);

  const move = useCallback(
    (y: number) => {
      const d = drag.current;
      if (!d.active) return;
      let next = d.startPos + (y - d.startY);
      if (next < 0) next = -Math.pow(-next, 0.72); // Gummiband nach oben
      apply(next, false);
      d.samples.push({ y, t: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
    },
    [apply],
  );

  const end = useCallback(() => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const v = (last.y - first.y) / dt; // px/ms, positiv = nach unten
    const projected = posRef.current + v * 220;
    const lowest = snaps.includes('half') ? offsetOf('half') : offsetOf('full');

    if (projected > lowest + Math.min(140, (closedOffset - lowest) * 0.35) || (v > 1.1 && posRef.current > lowest - 20)) {
      close();
      return;
    }
    let best: Snap = snaps[0];
    for (const s of snaps) if (Math.abs(offsetOf(s) - projected) < Math.abs(offsetOf(best) - projected)) best = s;
    goTo(best);
  }, [close, closedOffset, goTo, offsetOf, snaps]);

  // Griffbereich: Pointer-Events (Maus + Touch)
  const onHandleDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    begin(e.clientY);
  };
  const onHandleMove = (e: React.PointerEvent) => move(e.clientY);
  const onHandleUp = () => {
    const d = drag.current;
    if (d.active && d.samples.length < 3 && Math.abs(posRef.current - d.startPos) < 4) {
      // Antippen des Griffs: zwischen halb und voll wechseln
      d.active = false;
      if (snaps.length > 1) goTo(snapRef.current === 'half' ? 'full' : 'half');
      return;
    }
    end();
  };

  // Inhalt: Touch-Events – oben ziehen bewegt das Panel, sonst normal scrollen
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let mode: 'none' | 'sheet' | 'scroll' = 'none';
    let sx = 0;
    let sy = 0;
    const onStart = (e: TouchEvent) => {
      mode = 'none';
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (mode === 'none') {
        const dx = x - sx;
        const dy = y - sy;
        if (Math.abs(dy) < 7 && Math.abs(dx) < 7) return;
        if (Math.abs(dx) > Math.abs(dy)) mode = 'scroll';
        else if (dy > 0 && el.scrollTop <= 0) mode = 'sheet';
        else if (dy < 0 && snapRef.current === 'half' && snaps.includes('full')) mode = 'sheet';
        else mode = 'scroll';
        if (mode === 'sheet') begin(y);
      }
      if (mode === 'sheet') {
        e.preventDefault();
        move(y);
      }
    };
    const onEnd = () => {
      if (mode === 'sheet') end();
      mode = 'none';
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [begin, move, end, snaps]);

  const hidden = offsetOf(snap);

  return (
    <Ctx.Provider value={{ close, expand, snap }}>
      <div className={`sheet-layer${modal ? ' is-modal' : ''}`} style={{ zIndex: 100 + depth * 2 }}>
        {modal && <div className="sheet-backdrop" ref={backdropRef} onClick={close} />}
        <div
          className={`sheet${snap === 'full' ? ' is-full' : ''}`}
          ref={sheetRef}
          role="dialog"
          aria-label={label}
          style={{ height: fullH }}
        >
          <div
            className="sheet-handle-area"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            <div className="sheet-grabber" />
            {header}
          </div>
          <div
            className="sheet-content"
            ref={contentRef}
            style={{ paddingBottom: `calc(${hidden}px + env(safe-area-inset-bottom, 0px) + 28px)` }}
          >
            {children}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
