import { Check, ChevronRight, Heart, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STATUS_LABEL } from '../lib/colors';
import type { Status } from '../lib/types';
import { useSheet } from './Sheet';

export function Flag({ emoji, size = 20 }: { emoji: string; size?: number }) {
  return (
    <span className="flag" style={{ fontSize: size }} aria-hidden="true">
      {emoji}
    </span>
  );
}

export function StatusPill({ status, small }: { status: Status | null; small?: boolean }) {
  if (!status) return null;
  return (
    <span className={`status-pill status-pill--${status}${small ? ' is-small' : ''}`}>
      {status === 'visited' ? <Check size={small ? 11 : 13} strokeWidth={3} /> : <Heart size={small ? 11 : 13} strokeWidth={2.6} />}
      {!small && STATUS_LABEL[status]}
    </span>
  );
}

/** Zwei große Umschalter: Besucht / Will hin. Erneutes Tippen entfernt den Status (wenn erlaubt). */
export function StatusToggle({
  value,
  onChange,
  allowClear = true,
}: {
  value: Status | null;
  onChange(s: Status | null): void;
  allowClear?: boolean;
}) {
  const press = (s: Status) => {
    if (value === s) {
      if (allowClear) onChange(null);
    } else onChange(s);
  };
  return (
    <div className="status-toggle" role="group" aria-label="Status">
      <button
        type="button"
        className={`status-btn status-btn--visited${value === 'visited' ? ' is-on' : ''}`}
        onClick={() => press('visited')}
        aria-pressed={value === 'visited'}
      >
        <span className="status-btn-icon">
          <Check size={18} strokeWidth={3} />
        </span>
        <span>Besucht</span>
      </button>
      <button
        type="button"
        className={`status-btn status-btn--wishlist${value === 'wishlist' ? ' is-on' : ''}`}
        onClick={() => press('wishlist')}
        aria-pressed={value === 'wishlist'}
      >
        <span className="status-btn-icon">
          <Heart size={18} strokeWidth={2.6} />
        </span>
        <span>Will hin</span>
      </button>
    </div>
  );
}

/** Jahr-Auswahl: horizontale Chips, Mehrfachauswahl, ältere Jahre über „Älter…“. */
export function YearPicker({ selected, onToggle }: { selected: number[]; onToggle(y: number): void }) {
  const current = new Date().getFullYear();
  const recent = Array.from({ length: 12 }, (_, i) => current - i);
  const older = selected.filter((y) => !recent.includes(y)).sort((a, b) => b - a);
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = () => {
    const y = Number.parseInt(val, 10);
    if (Number.isInteger(y) && y >= 1900 && y <= current + 5 && !selected.includes(y)) onToggle(y);
    setVal('');
    setAdding(false);
  };

  return (
    <div className="year-picker">
      <div className="chip-row">
        {[...recent, ...older].map((y) => (
          <button
            key={y}
            type="button"
            className={`chip chip--year${selected.includes(y) ? ' is-on' : ''}`}
            onClick={() => onToggle(y)}
          >
            {y}
          </button>
        ))}
        {adding ? (
          <form
            className="chip chip--input"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={inputRef}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="Jahr"
              value={val}
              onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
              onBlur={submit}
            />
          </form>
        ) : (
          <button type="button" className="chip chip--ghost" onClick={() => setAdding(true)}>
            Älter…
          </button>
        )}
      </div>
    </div>
  );
}

/** Notizfeld, speichert verzögert beim Tippen und sofort beim Verlassen. */
export function NoteField({
  value,
  onSave,
  placeholder = 'Notizen, Tipps, Erinnerungen…',
}: {
  value: string;
  onSave(v: string): void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value);
    latest.current = value;
  }, [value]);

  const autoSize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(320, el.scrollHeight + 2)}px`;
  };
  useEffect(autoSize, [text]);

  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v !== latest.current) {
      latest.current = v;
      onSave(v);
    }
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <textarea
      ref={ref}
      className="input textarea"
      value={text}
      rows={3}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(v), 600);
      }}
      onBlur={() => commit(text)}
    />
  );
}

export function SheetHeader({
  title,
  subtitle,
  leading,
  trailing,
  onClose,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClose?: () => void;
}) {
  const sheet = useSheet();
  return (
    <div className="sheet-header">
      {leading && <div className="sheet-header-leading">{leading}</div>}
      <div className="sheet-header-text">
        <h2 className="sheet-title">{title}</h2>
        {subtitle && <div className="sheet-subtitle">{subtitle}</div>}
      </div>
      <div className="sheet-header-actions">
        {trailing}
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Schließen" onClick={onClose ?? sheet.close}>
          <X size={18} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">
          {title}
          {count !== undefined && count > 0 && <span className="section-count">{count}</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AddRow({ label, onClick, icon }: { label: string; onClick(): void; icon?: ReactNode }) {
  return (
    <button type="button" className="add-row" onClick={onClick}>
      <span className="add-row-icon">{icon ?? <Plus size={16} strokeWidth={2.8} />}</span>
      <span>{label}</span>
    </button>
  );
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  chevron = true,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  return (
    <button type="button" className="list-row" onClick={onClick} disabled={!onClick}>
      {leading && <span className="list-row-leading">{leading}</span>}
      <span className="list-row-text">
        <span className="list-row-title">{title}</span>
        {subtitle && <span className="list-row-subtitle">{subtitle}</span>}
      </span>
      {trailing && <span className="list-row-trailing">{trailing}</span>}
      {chevron && onClick && <ChevronRight className="list-row-chevron" size={18} />}
    </button>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: NoInfer<T>; label: ReactNode }[];
  onChange(v: NoInfer<T>): void;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="segmented" style={{ ['--seg-count' as string]: options.length, ['--seg-index' as string]: idx }}>
      <span className="segmented-thumb" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented-btn${o.value === value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 168,
  stroke = 14,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd27a" />
            <stop offset="100%" stopColor="#ff7a3d" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(shown, shown > 0 ? 0.012 : 0))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setV(Math.round(from + (target - from) * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
