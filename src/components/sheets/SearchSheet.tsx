import { Building2, Check, CloudOff, Globe2, Heart, Loader2, MapPinOff, Search, Wifi, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, getCountry, type CountryMeta } from '../../data/countries';
import { celebrateCity, focusCity, focusCountry, markCountry } from '../../lib/actions';
import { formatPopulation, loadCities, normalize, searchCityIndex, searchCountries, searchOnline, type CityHit } from '../../lib/search';
import type { Status } from '../../lib/types';
import { useData } from '../../store/data';
import { useSheet } from '../Sheet';
import { Flag, Segmented, StatusPill } from '../ui';

type Mode = 'any' | 'country' | 'city';

interface Props {
  mode: Mode;
  countryCode?: string;
  status?: Status;
}

export function SearchSheet({ mode, countryCode, status: initialStatus }: Props) {
  const sheet = useSheet();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>(initialStatus ?? 'visited');
  const [cityIndex, setCityIndex] = useState<Awaited<ReturnType<typeof loadCities>> | null>(null);
  const [cityError, setCityError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [online, setOnline] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; hits: CityHit[]; q: string }>({
    state: 'idle',
    hits: [],
    q: '',
  });
  const [manualName, setManualName] = useState<string | null>(null);

  const views = useData((s) => s.views);
  const myCities = useData((s) => s.data.cities);
  const addCity = useData((s) => s.addCity);

  const country = getCountry(countryCode);
  const wantsCities = mode !== 'country' && manualName === null;
  const wantsCountries = mode !== 'city' || manualName !== null;
  const showStatusChoice = mode !== 'any' || manualName !== null;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [manualName]);

  useEffect(() => {
    if (!wantsCities || cityIndex) return;
    loadCities()
      .then(setCityIndex)
      .catch(() => setCityError(true));
  }, [wantsCities, cityIndex]);

  const existingCityKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of Object.values(myCities)) m.set(`${c.countryCode}:${normalize(c.name)}`, c.id);
    return m;
  }, [myCities]);

  const countryHits: CountryMeta[] = useMemo(() => {
    if (!wantsCountries) return [];
    if (!q.trim()) return mode === 'country' || manualName !== null ? COUNTRIES : [];
    return searchCountries(q, mode === 'any' ? 5 : 30);
  }, [q, wantsCountries, mode, manualName]);

  const myCityHits = useMemo(() => {
    if (!wantsCities || !q.trim()) return [];
    const nq = normalize(q);
    return Object.values(myCities)
      .filter((c) => (!countryCode || c.countryCode === countryCode) && normalize(c.name).includes(nq))
      .slice(0, 5);
  }, [q, myCities, wantsCities, countryCode]);

  const atlasHits = useMemo(() => {
    if (!wantsCities || !cityIndex) return [];
    return searchCityIndex(cityIndex, q, { countryCode, limit: q.trim() ? 14 : 12 }).filter(
      (h) => !existingCityKey.has(`${h.countryCode}:${normalize(h.name)}`),
    );
  }, [cityIndex, q, countryCode, wantsCities, existingCityKey]);

  const onlineHits = online.q === q ? online.hits.filter((h) => !existingCityKey.has(`${h.countryCode}:${normalize(h.name)}`)) : [];

  // -------------------------------------------------------------- Aktionen
  const pickCountry = (c: CountryMeta) => {
    inputRef.current?.blur();
    if (manualName !== null) {
      const id = addCity({ name: manualName, countryCode: c.code, lat: null, lng: null, status });
      focusCity(id, { push: Boolean(countryCode) });
      return;
    }
    if (mode === 'country') {
      const cur = views.get(c.code)?.status ?? null;
      if (cur !== 'visited' && cur !== status) markCountry(c.code, status);
    }
    focusCountry(c.code);
  };

  const pickCity = (hit: CityHit, s: Status) => {
    inputRef.current?.blur();
    const before = Object.keys(useData.getState().data.cities).length;
    const id = addCity({ name: hit.name, countryCode: hit.countryCode, lat: hit.lat, lng: hit.lng, status: s });
    if (Object.keys(useData.getState().data.cities).length > before) celebrateCity(id);
    focusCity(id, { push: Boolean(countryCode) });
  };

  const onCityRow = (hit: CityHit) => {
    if (mode === 'any') setExpanded((k) => (k === hit.key ? null : hit.key));
    else pickCity(hit, status);
  };

  const runOnline = async () => {
    const query = q;
    setOnline({ state: 'loading', hits: [], q: query });
    try {
      const hits = await searchOnline(query, { countryCode });
      setOnline({ state: 'done', hits, q: query });
    } catch {
      setOnline({ state: 'error', hits: [], q: query });
    }
  };

  const placeholder =
    manualName !== null
      ? `In welchem Land liegt „${manualName}“?`
      : mode === 'country'
        ? 'Land suchen'
        : mode === 'city'
          ? country
            ? `Stadt in ${country.name} suchen`
            : 'Stadt suchen'
          : 'Land oder Stadt suchen';

  const nothing =
    q.trim().length > 0 && !countryHits.length && !myCityHits.length && !atlasHits.length && !onlineHits.length;

  return (
    <div className="search-sheet">
      <div className="search-bar">
        <label className="search-field">
          <Search size={18} className="search-field-icon" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setExpanded(null);
            }}
          />
          {q && (
            <button type="button" className="search-clear" aria-label="Leeren" onClick={() => setQ('')}>
              <X size={14} strokeWidth={3} />
            </button>
          )}
        </label>
        <button type="button" className="text-btn" onClick={sheet.close}>
          Abbrechen
        </button>
      </div>

      {showStatusChoice && (
        <div className="search-status">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'visited', label: <><Check size={15} strokeWidth={3} /> Ich war dort</> },
              { value: 'wishlist', label: <><Heart size={15} strokeWidth={2.6} /> Will ich hin</> },
            ]}
          />
        </div>
      )}

      {manualName !== null && (
        <div className="search-banner">
          <MapPinOff size={16} />
          <span>„{manualName}“ wird ohne Kartenposition gespeichert.</span>
          <button type="button" className="text-btn" onClick={() => setManualName(null)}>
            Zurück
          </button>
        </div>
      )}

      <div className="search-results">
        {countryHits.length > 0 && (
          <ResultGroup title={mode === 'any' ? 'Länder' : manualName !== null ? 'Land wählen' : undefined}>
            {countryHits.map((c) => {
              const s = views.get(c.code)?.status ?? null;
              return (
                <button key={c.code} type="button" className="result-row" onClick={() => pickCountry(c)}>
                  <Flag emoji={c.flag} size={26} />
                  <span className="result-text">
                    <span className="result-title">{c.name}</span>
                    <span className="result-sub">{c.countable ? c.subregion : 'Gebiet'}</span>
                  </span>
                  <StatusPill status={s} small />
                </button>
              );
            })}
          </ResultGroup>
        )}

        {myCityHits.length > 0 && (
          <ResultGroup title="Deine Städte">
            {myCityHits.map((c) => {
              const cc = getCountry(c.countryCode);
              return (
                <button key={c.id} type="button" className="result-row" onClick={() => focusCity(c.id, { push: Boolean(countryCode) })}>
                  <span className={`result-icon result-icon--${c.status}`}>
                    <Building2 size={16} />
                  </span>
                  <span className="result-text">
                    <span className="result-title">{c.name}</span>
                    <span className="result-sub">
                      {cc?.flag} {cc?.name}
                    </span>
                  </span>
                  <StatusPill status={c.status} small />
                </button>
              );
            })}
          </ResultGroup>
        )}

        {wantsCities && !cityIndex && !cityError && (
          <div className="result-loading">
            <Loader2 className="spin" size={18} /> Städte werden geladen…
          </div>
        )}
        {cityError && <p className="hint pad">Städteliste konnte nicht geladen werden.</p>}

        {atlasHits.length > 0 && (
          <ResultGroup title={q.trim() ? (mode === 'any' ? 'Städte' : undefined) : `Größte Städte${country ? ` in ${country.name}` : ''}`}>
            {atlasHits.map((h) => (
              <CityResult
                key={h.key}
                hit={h}
                expanded={expanded === h.key}
                onClick={() => onCityRow(h)}
                onPick={(s) => pickCity(h, s)}
                showCountry={!countryCode}
              />
            ))}
          </ResultGroup>
        )}

        {onlineHits.length > 0 && (
          <ResultGroup title="Online gefunden">
            {onlineHits.map((h) => (
              <CityResult
                key={h.key}
                hit={h}
                expanded={expanded === h.key}
                onClick={() => onCityRow(h)}
                onPick={(s) => pickCity(h, s)}
                showCountry={!countryCode}
              />
            ))}
            <p className="attribution">Daten © OpenStreetMap-Mitwirkende · Suche: Photon (komoot)</p>
          </ResultGroup>
        )}

        {wantsCities && q.trim().length >= 2 && (
          <div className="search-more">
            {online.q !== q || online.state === 'idle' ? (
              <button type="button" className="more-btn" onClick={runOnline}>
                <Wifi size={16} /> Kleineren Ort online suchen
              </button>
            ) : online.state === 'loading' ? (
              <div className="result-loading">
                <Loader2 className="spin" size={18} /> Suche online…
              </div>
            ) : online.state === 'error' ? (
              <p className="hint hint--icon">
                <CloudOff size={14} /> Online-Suche gerade nicht erreichbar.
              </p>
            ) : (
              onlineHits.length === 0 && <p className="hint">Online nichts Neues gefunden.</p>
            )}
            <button
              type="button"
              className="more-btn more-btn--ghost"
              onClick={() => {
                const name = q.trim();
                if (countryCode) {
                  const id = addCity({ name, countryCode, lat: null, lng: null, status });
                  focusCity(id, { push: true });
                } else {
                  setManualName(name);
                  setQ('');
                }
              }}
            >
              <MapPinOff size={16} /> „{q.trim()}“ ohne Karte hinzufügen
            </button>
          </div>
        )}

        {nothing && !wantsCities && <p className="hint pad">Kein Land gefunden.</p>}

        {mode === 'any' && !q.trim() && (
          <div className="search-empty">
            <Globe2 size={34} strokeWidth={1.6} />
            <p>Suche nach einem Land oder einer Stadt.</p>
            <p className="muted">Über 7.000 Städte sind offline verfügbar – kleinere Orte findest du online.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="result-group">
      {title && <div className="result-group-title">{title}</div>}
      <div className="result-list">{children}</div>
    </div>
  );
}

function CityResult({
  hit,
  expanded,
  onClick,
  onPick,
  showCountry,
}: {
  hit: CityHit;
  expanded: boolean;
  onClick(): void;
  onPick(s: Status): void;
  showCountry: boolean;
}) {
  const cc = getCountry(hit.countryCode);
  const sub = [showCountry ? `${cc?.flag ?? ''} ${cc?.name ?? hit.countryCode}` : '', hit.capital ? 'Hauptstadt' : '', formatPopulation(hit.population) || (hit.source === 'online' ? hit.nameEn : '')]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={`result-city${expanded ? ' is-expanded' : ''}`}>
      <button type="button" className="result-row" onClick={onClick}>
        <span className="result-icon">
          <Building2 size={16} />
        </span>
        <span className="result-text">
          <span className="result-title">
            {hit.name}
            {hit.nameEn && hit.nameEn !== hit.name && hit.source === 'atlas' && <span className="result-alt"> · {hit.nameEn}</span>}
          </span>
          <span className="result-sub">{sub}</span>
        </span>
      </button>
      {expanded && (
        <div className="result-actions">
          <button type="button" className="mini-btn mini-btn--visited" onClick={() => onPick('visited')}>
            <Check size={15} strokeWidth={3} /> Ich war dort
          </button>
          <button type="button" className="mini-btn mini-btn--wishlist" onClick={() => onPick('wishlist')}>
            <Heart size={15} strokeWidth={2.6} /> Will ich hin
          </button>
        </div>
      )}
    </div>
  );
}
