import { Earth, Lightbulb, MapPin, Plus, Trophy, type LucideIcon } from 'lucide-react';
import { useData } from '../store/data';
import { useUI, type Tab } from '../store/ui';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'globe', label: 'Globus', icon: Earth },
  { id: 'places', label: 'Orte', icon: MapPin },
  { id: 'ideas', label: 'Ideen', icon: Lightbulb },
  { id: 'stats', label: 'Statistik', icon: Trophy },
];

export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const openSheet = useUI((s) => s.openSheet);
  const ideas = useData((s) => s.data.ideas);
  const unsorted = Object.values(ideas).filter((i) => !i.countryCode && !i.cityId).length;

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const item = (t: (typeof TABS)[number]) => {
    const Icon = t.icon;
    const on = tab === t.id;
    return (
      <button
        key={t.id}
        type="button"
        className={`tab${on ? ' is-on' : ''}`}
        aria-current={on ? 'page' : undefined}
        onClick={() => {
          if (tab === t.id) {
            // Nochmal tippen: nach oben scrollen bzw. Panels schließen
            useUI.getState().closeAll();
            document.querySelector('.screen.is-active')?.scrollTo({ top: 0, behavior: 'smooth' });
          } else setTab(t.id);
        }}
      >
        <span className="tab-icon">
          <Icon size={23} strokeWidth={on ? 2.4 : 2} />
          {t.id === 'ideas' && unsorted > 0 && <span className="tab-badge">{unsorted > 9 ? '9+' : unsorted}</span>}
        </span>
        <span className="tab-label">{t.label}</span>
      </button>
    );
  };

  return (
    <nav className="tabbar" aria-label="Navigation">
      {left.map(item)}
      <button type="button" className="tab-add" aria-label="Hinzufügen" onClick={() => openSheet({ kind: 'add' })}>
        <Plus size={28} strokeWidth={2.6} />
      </button>
      {right.map(item)}
    </nav>
  );
}
