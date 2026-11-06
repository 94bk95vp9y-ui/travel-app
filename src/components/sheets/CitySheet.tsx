import { Lightbulb, MapPinOff, Trash2 } from 'lucide-react';
import { getCountry } from '../../data/countries';
import { celebrateCity, focusCountry } from '../../lib/actions';
import { useData } from '../../store/data';
import { useUI } from '../../store/ui';
import { IdeaCard } from '../IdeaCard';
import { useSheet } from '../Sheet';
import { AddRow, Flag, NoteField, Section, SheetHeader, StatusToggle, YearPicker } from '../ui';

export function CitySheetHeader({ id }: { id: string }) {
  const city = useData((s) => s.data.cities[id]);
  if (!city) return <SheetHeader title="Stadt" />;
  const country = getCountry(city.countryCode);
  return (
    <SheetHeader
      leading={<span className={`city-avatar city-avatar--${city.status}`}>{city.name.slice(0, 1).toUpperCase()}</span>}
      title={city.name}
      subtitle={
        <button type="button" className="subtitle-link" onClick={() => focusCountry(city.countryCode, { push: true })}>
          {country && <Flag emoji={country.flag} size={14} />} {country?.name ?? city.countryCode}
        </button>
      }
    />
  );
}

export function CitySheet({ id }: { id: string }) {
  const city = useData((s) => s.data.cities[id]);
  const ideas = useData((s) => s.data.ideas);
  const updateCity = useData((s) => s.updateCity);
  const toggleYear = useData((s) => s.toggleCityYear);
  const deleteCity = useData((s) => s.deleteCity);
  const restoreCity = useData((s) => s.restoreCity);
  const openSheet = useUI((s) => s.openSheet);
  const showToast = useUI((s) => s.showToast);
  const sheet = useSheet();

  if (!city) return <p className="muted pad">Diese Stadt gibt es nicht mehr.</p>;

  const cityIdeas = Object.values(ideas)
    .filter((i) => i.cityId === id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="sheet-body">
      <StatusToggle
        value={city.status}
        allowClear={false}
        onChange={(s) => {
          if (!s) return;
          updateCity(id, { status: s });
          celebrateCity(id);
        }}
      />

      {city.status === 'visited' && (
        <Section title="Wann warst du dort?">
          <YearPicker selected={city.years} onToggle={(y) => toggleYear(id, y)} />
        </Section>
      )}

      <Section title="Ideen & Links" count={cityIdeas.length}>
        <div className="idea-list">
          {cityIdeas.map((i) => (
            <IdeaCard key={i.id} idea={i} showPlace={false} />
          ))}
        </div>
        <AddRow
          label="Idee oder Link speichern"
          icon={<Lightbulb size={16} strokeWidth={2.4} />}
          onClick={() => openSheet({ kind: 'idea', prefill: { cityId: id, countryCode: city.countryCode } })}
        />
      </Section>

      <Section title="Notizen">
        <NoteField value={city.note} onSave={(v) => updateCity(id, { note: v })} />
      </Section>

      {city.lat === null && (
        <p className="hint hint--icon">
          <MapPinOff size={14} /> Ohne Koordinaten angelegt – erscheint nicht auf dem Globus.
        </p>
      )}

      <button
        type="button"
        className="btn btn-danger-ghost btn-block"
        onClick={() => {
          const linked = cityIdeas.map((i) => i.id);
          const copy = { ...city };
          sheet.close();
          // Erst nach der Schließ-Animation löschen, damit das Panel nicht leer ausfährt
          setTimeout(() => {
            deleteCity(id);
            showToast(`„${copy.name}“ gelöscht`, 'Rückgängig', () => restoreCity(copy, linked));
          }, 320);
        }}
      >
        <Trash2 size={17} /> Stadt löschen
      </button>
    </div>
  );
}
