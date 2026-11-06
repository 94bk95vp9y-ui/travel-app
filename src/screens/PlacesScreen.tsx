import { Building2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONTINENTS, COUNTRIES, getCountry } from '../data/countries';
import { focusCity, focusCountry, primeKeyboard } from '../lib/actions';
import { yearsLabel } from '../lib/format';
import { normalize } from '../lib/search';
import type { Status } from '../lib/types';
import { EmptyState, Flag, ListRow, Segmented, StatusPill } from '../components/ui';
import { useData } from '../store/data';
import { useUI } from '../store/ui';

type Kind = 'countries' | 'cities';
type Filter = 'all' | Status;

export function PlacesScreen() {
  const views = useData((s) => s.views);
  const cities = useData((s) => s.data.cities);
  const openSheet = useUI((s) => s.openSheet);
  const [kind, setKind] = useState<Kind>('countries');
  const [filter, setFilter] = useState<Filter>('visited');
  const [q, setQ] = useState('');

  const nq = normalize(q);

  const countryGroups = useMemo(() => {
    const list = COUNTRIES.filter((c) => {
      const s = views.get(c.code)?.status ?? null;
      if (filter !== 'all' && s !== filter) return false;
      if (filter === 'all' && !c.countable && !s) return false; // Gebiete nur zeigen, wenn markiert
      if (nq && !normalize(c.name).includes(nq) && !normalize(c.nameEn).includes(nq)) return false;
      return true;
    });
    return CONTINENTS.map((k) => ({ ...k, items: list.filter((c) => c.continent === k.code) })).filter((g) => g.items.length);
  }, [views, filter, nq]);

  const cityGroups = useMemo(() => {
    const list = Object.values(cities).filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (nq && !normalize(c.name).includes(nq)) return false;
      return true;
    });
    const by = new Map<string, typeof list>();
    for (const c of list) {
      const arr = by.get(c.countryCode) ?? [];
      arr.push(c);
      by.set(c.countryCode, arr);
    }
    return [...by.entries()]
      .map(([code, items]) => ({ code, meta: getCountry(code), items: items.sort((a, b) => a.name.localeCompare(b.name, 'de')) }))
      .sort((a, b) => (a.meta?.name ?? a.code).localeCompare(b.meta?.name ?? b.code, 'de'));
  }, [cities, filter, nq]);

  const counts = useMemo(() => {
    let v = 0;
    let w = 0;
    for (const x of views.values()) {
      if (x.status === 'visited') v++;
      else if (x.status === 'wishlist') w++;
    }
    const cv = Object.values(cities).filter((c) => c.status === 'visited').length;
    return { v, w, cv, cw: Object.keys(cities).length - cv };
  }, [views, cities]);

  const isEmpty = kind === 'countries' ? countryGroups.length === 0 : cityGroups.length === 0;

  return (
    <div className="screen-inner">
      <header className="screen-header">
        <h1 className="screen-title">Orte</h1>
        <p className="screen-sub">
          {kind === 'countries'
            ? `${counts.v} besucht · ${counts.w} auf der Wunschliste`
            : `${counts.cv} Städte besucht · ${counts.cw} geplant`}
        </p>
      </header>

      <div className="sticky-bar">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'countries', label: 'Länder' },
            { value: 'cities', label: 'Städte' },
          ]}
        />
        <div className="filter-row">
          {(
            [
              ['visited', 'Besucht'],
              ['wishlist', 'Will hin'],
              ['all', kind === 'countries' ? 'Alle Länder' : 'Alle'],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} type="button" className={`chip chip--filter chip--${f}${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search-field search-field--inline">
          <Search size={17} className="search-field-icon" />
          <input type="search" placeholder="Filtern…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {q && (
            <button type="button" className="search-clear" aria-label="Leeren" onClick={() => setQ('')}>
              <X size={14} strokeWidth={3} />
            </button>
          )}
        </label>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={kind === 'countries' ? '🌍' : <Building2 size={30} />}
          title={q ? 'Nichts gefunden' : filter === 'visited' ? 'Noch nichts besucht?' : filter === 'wishlist' ? 'Noch keine Wunschziele' : 'Noch keine Städte'}
          text={
            q
              ? 'Versuch es mit einem anderen Begriff.'
              : kind === 'countries'
                ? 'Tippe auf „Alle Länder“ und hake ab, wo du schon warst – oder markiere Länder direkt auf dem Globus.'
                : 'Füge Städte hinzu, die du besucht hast oder sehen willst.'
          }
          action={
            !q && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (kind === 'countries') setFilter('all');
                  else {
                    primeKeyboard();
                    openSheet({ kind: 'search', mode: 'city', status: filter === 'wishlist' ? 'wishlist' : 'visited' });
                  }
                }}
              >
                {kind === 'countries' ? 'Alle Länder zeigen' : 'Stadt hinzufügen'}
              </button>
            )
          }
        />
      ) : kind === 'countries' ? (
        countryGroups.map((g) => (
          <section key={g.code} className="group-section">
            <h2 className="group-title">
              {g.name} <span className="group-count">{g.items.length}</span>
            </h2>
            <div className="list list--card">
              {g.items.map((c) => {
                const v = views.get(c.code);
                const sub = [
                  v?.years.length ? yearsLabel(v.years) : '',
                  v && v.cities.length ? `${v.cities.length} ${v.cities.length === 1 ? 'Stadt' : 'Städte'}` : '',
                  v && v.ideas.length ? `${v.ideas.length} ${v.ideas.length === 1 ? 'Idee' : 'Ideen'}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <ListRow
                    key={c.code}
                    leading={<Flag emoji={c.flag} size={26} />}
                    title={c.name}
                    subtitle={sub || undefined}
                    trailing={<StatusPill status={v?.status ?? null} small />}
                    onClick={() => focusCountry(c.code, { fly: false })}
                  />
                );
              })}
            </div>
          </section>
        ))
      ) : (
        cityGroups.map((g) => (
          <section key={g.code} className="group-section">
            <h2 className="group-title">
              {g.meta?.flag} {g.meta?.name ?? g.code} <span className="group-count">{g.items.length}</span>
            </h2>
            <div className="list list--card">
              {g.items.map((c) => (
                <ListRow
                  key={c.id}
                  leading={<span className={`dot dot--lg dot--${c.status}`} />}
                  title={c.name}
                  subtitle={c.status === 'visited' ? yearsLabel(c.years) || 'Besucht' : 'Will hin'}
                  onClick={() => focusCity(c.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
