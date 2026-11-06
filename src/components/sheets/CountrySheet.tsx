import { Building2, ExternalLink, Lightbulb, LocateFixed } from 'lucide-react';
import { CONTINENT_NAME, getCountry } from '../../data/countries';
import { flyToCountry, focusCity, markCountry, primeKeyboard } from '../../lib/actions';
import { formatArea, yearsLabel } from '../../lib/format';
import { useData } from '../../store/data';
import { useUI } from '../../store/ui';
import { IdeaCard } from '../IdeaCard';
import { useSheet } from '../Sheet';
import { AddRow, Flag, ListRow, NoteField, Section, SheetHeader, StatusToggle, YearPicker } from '../ui';

export function CountrySheetHeader({ code }: { code: string }) {
  const meta = getCountry(code);
  if (!meta) return null;
  const sub = [meta.capital, meta.subregion || CONTINENT_NAME[meta.continent]].filter(Boolean).join(' · ');
  return <SheetHeader leading={<Flag emoji={meta.flag} size={40} />} title={meta.name} subtitle={sub} />;
}

export function CountrySheet({ code }: { code: string }) {
  const meta = getCountry(code);
  const view = useData((s) => s.views.get(code));
  const record = useData((s) => s.data.countries[code]);
  const toggleYear = useData((s) => s.toggleCountryYear);
  const setNote = useData((s) => s.setCountryNote);
  const openSheet = useUI((s) => s.openSheet);
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const sheet = useSheet();

  if (!meta) return <p className="muted pad">Unbekanntes Land.</p>;

  const status = view?.status ?? null;
  const manual = record?.status ?? null;
  const cities = view?.cities ?? [];
  const ideas = view?.ideas ?? [];
  const ownYears = record?.years ?? [];
  const cityYears = (view?.years ?? []).filter((y) => !ownYears.includes(y));

  return (
    <div className="sheet-body">
      <StatusToggle
        value={manual ?? (view?.derived ? status : null)}
        onChange={(s) => {
          // Abgeleiteten Status (aus Städten) übernehmen statt zu entfernen
          if (s === null && view?.derived) return;
          markCountry(code, s);
        }}
      />
      {view?.derived && (
        <p className="hint">
          Automatisch durch {cities.filter((c) => c.status === status).length === 1 ? 'eine Stadt' : 'deine Städte'} als „
          {status === 'visited' ? 'besucht' : 'Wunschziel'}“ markiert.
        </p>
      )}

      {status === 'visited' && (
        <Section title="Wann warst du dort?">
          <YearPicker selected={ownYears} onToggle={(y) => toggleYear(code, y)} />
          {cityYears.length > 0 && <p className="hint">Aus deinen Städten: {cityYears.join(', ')}</p>}
        </Section>
      )}

      <Section
        title="Städte"
        count={cities.length}
      >
        <div className="list">
          {cities.map((c) => (
            <ListRow
              key={c.id}
              leading={<span className={`dot dot--${c.status}`} />}
              title={c.name}
              subtitle={c.status === 'visited' ? yearsLabel(c.years) || 'Besucht' : 'Will hin'}
              onClick={() => focusCity(c.id, { push: true })}
            />
          ))}
          <AddRow
            label="Stadt hinzufügen"
            icon={<Building2 size={16} strokeWidth={2.4} />}
            onClick={() => {
              primeKeyboard();
              openSheet({ kind: 'search', mode: 'city', countryCode: code, status: status === 'visited' ? 'visited' : 'wishlist' });
            }}
          />
        </div>
      </Section>

      <Section title="Ideen & Links" count={ideas.length}>
        <div className="idea-list">
          {ideas.map((i) => (
            <IdeaCard key={i.id} idea={i} />
          ))}
        </div>
        <AddRow
          label="Idee oder Link speichern"
          icon={<Lightbulb size={16} strokeWidth={2.4} />}
          onClick={() => openSheet({ kind: 'idea', prefill: { countryCode: code } })}
        />
      </Section>

      <Section title="Notizen">
        <NoteField value={record?.note ?? ''} onSave={(v) => setNote(code, v)} />
      </Section>

      <Section title="Infos">
        <div className="facts">
          {meta.capital && <Fact label="Hauptstadt" value={meta.capital} />}
          <Fact label="Region" value={[CONTINENT_NAME[meta.continent], meta.subregion].filter(Boolean).join(' · ')} />
          {meta.languages.length > 0 && <Fact label="Sprachen" value={meta.languages.join(', ')} />}
          {meta.currencies.length > 0 && <Fact label="Währung" value={meta.currencies.join(', ')} />}
          {meta.area > 0 && <Fact label="Fläche" value={formatArea(meta.area)} />}
          {!meta.countable && <Fact label="Hinweis" value="Gebiet – zählt nicht zu den 195 Ländern" />}
        </div>
        <a
          className="link-row"
          href={`https://www.google.com/search?q=${encodeURIComponent(`Auswärtiges Amt Reise- und Sicherheitshinweise ${meta.name}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Reise- & Sicherheitshinweise suchen <ExternalLink size={14} />
        </a>
      </Section>

      {tab !== 'globe' && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => {
            sheet.close();
            setTab('globe');
            setTimeout(() => {
              useUI.getState().showDetail({ kind: 'country', code });
              flyToCountry(code);
            }, 60);
          }}
        >
          <LocateFixed size={18} /> Auf dem Globus zeigen
        </button>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value}</span>
    </div>
  );
}
