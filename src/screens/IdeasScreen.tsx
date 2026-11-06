import { Inbox, Lightbulb, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getCountry } from '../data/countries';
import { CATEGORIES } from '../lib/categories';
import type { IdeaCategory, IdeaRecord } from '../lib/types';
import { IdeaCard } from '../components/IdeaCard';
import { EmptyState } from '../components/ui';
import { useData } from '../store/data';
import { useUI } from '../store/ui';

type Filter = 'open' | 'inbox' | 'done' | 'all';

export function IdeasScreen() {
  const ideas = useData((s) => s.data.ideas);
  const cities = useData((s) => s.data.cities);
  const openSheet = useUI((s) => s.openSheet);
  const [filter, setFilter] = useState<Filter>('open');
  const [cat, setCat] = useState<IdeaCategory | null>(null);

  const all = useMemo(() => Object.values(ideas).sort((a, b) => b.createdAt - a.createdAt), [ideas]);
  const inboxCount = all.filter((i) => !i.countryCode && !i.cityId).length;

  const list = useMemo(
    () =>
      all.filter((i) => {
        if (filter === 'open' && i.done) return false;
        if (filter === 'done' && !i.done) return false;
        if (filter === 'inbox' && (i.countryCode || i.cityId)) return false;
        if (cat && i.category !== cat) return false;
        return true;
      }),
    [all, filter, cat],
  );

  // Nach Land gruppieren (Sammelbox zuerst)
  const groups = useMemo(() => {
    const by = new Map<string, IdeaRecord[]>();
    for (const i of list) {
      const code = i.countryCode ?? (i.cityId ? cities[i.cityId]?.countryCode : null) ?? '__inbox';
      const arr = by.get(code) ?? [];
      arr.push(i);
      by.set(code, arr);
    }
    return [...by.entries()]
      .map(([code, items]) => ({ code, meta: code === '__inbox' ? undefined : getCountry(code), items }))
      .sort((a, b) => {
        if (a.code === '__inbox') return -1;
        if (b.code === '__inbox') return 1;
        return (a.meta?.name ?? '').localeCompare(b.meta?.name ?? '', 'de');
      });
  }, [list, cities]);

  const usedCats = new Set(all.map((i) => i.category));

  return (
    <div className="screen-inner">
      <header className="screen-header screen-header--row">
        <div>
          <h1 className="screen-title">Ideen</h1>
          <p className="screen-sub">
            {all.length} gesammelt · {all.filter((i) => i.done).length} erledigt
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn--accent" aria-label="Neue Idee" onClick={() => openSheet({ kind: 'idea' })}>
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </header>

      <div className="sticky-bar">
        <div className="filter-row">
          {(
            [
              ['open', 'Offen'],
              ['inbox', `Sammelbox${inboxCount ? ` · ${inboxCount}` : ''}`],
              ['done', 'Erledigt'],
              ['all', 'Alle'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} type="button" className={`chip chip--filter${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        {usedCats.size > 1 && (
          <div className="chip-row chip-row--cats">
            {CATEGORIES.filter((c) => usedCats.has(c.id)).map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`cat-chip cat-chip--sm${cat === c.id ? ' is-on' : ''}`}
                  style={{ ['--cat' as string]: c.color }}
                  onClick={() => setCat(cat === c.id ? null : c.id)}
                >
                  <Icon size={14} strokeWidth={2.4} /> {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={filter === 'inbox' ? <Inbox size={30} /> : <Lightbulb size={30} />}
          title={
            all.length === 0
              ? 'Sammle deine Reise-Inspiration'
              : filter === 'inbox'
                ? 'Sammelbox ist leer'
                : filter === 'done'
                  ? 'Noch nichts erledigt'
                  : 'Alles erledigt 🎉'
          }
          text={
            all.length === 0
              ? 'Ein TikTok mit einem Food-Spot? Ein Reel vom schönsten Strand? Kopiere den Link und speichere ihn hier – direkt bei einem Land oder erstmal in der Sammelbox.'
              : filter === 'inbox'
                ? 'Alle Ideen sind einem Ort zugeordnet.'
                : 'Hier erscheinen die passenden Ideen.'
          }
          action={
            all.length === 0 && (
              <button type="button" className="btn btn-primary" onClick={() => openSheet({ kind: 'idea' })}>
                <Plus size={18} /> Ersten Link speichern
              </button>
            )
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.code} className="group-section">
            <h2 className="group-title">
              {g.code === '__inbox' ? (
                <>
                  <Inbox size={15} /> Sammelbox
                </>
              ) : (
                <>
                  {g.meta?.flag} {g.meta?.name}
                </>
              )}
              <span className="group-count">{g.items.length}</span>
            </h2>
            <div className="idea-list">
              {g.items.map((i) => (
                <IdeaCard key={i.id} idea={i} showPlace={g.code === '__inbox' ? false : true} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
