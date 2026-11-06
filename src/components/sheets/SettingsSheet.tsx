import { Download, HardDrive, Info, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BackupError, backupFileName, createBackup, parseBackup } from '../../lib/backup';
import { plural, relativeDays } from '../../lib/format';
import { isPersisted, requestPersistence, storageMode } from '../../lib/persist';
import { useData } from '../../store/data';
import { useUI } from '../../store/ui';
import { Section } from '../ui';

export function SettingsSheet() {
  const settings = useData((s) => s.data.settings);
  const countryMap = useData((s) => s.data.countries);
  const cityMap = useData((s) => s.data.cities);
  const ideaMap = useData((s) => s.data.ideas);
  const counts = {
    countries: Object.keys(countryMap).length,
    cities: Object.keys(cityMap).length,
    ideas: Object.keys(ideaMap).length,
  };
  const update = useData((s) => s.updateSettings);
  const replaceAll = useData((s) => s.replaceAll);
  const resetAll = useData((s) => s.resetAll);
  const showToast = useUI((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void isPersisted().then(setPersisted);
  }, []);

  const exportData = async () => {
    const data = useData.getState().data;
    const json = JSON.stringify(createBackup(data), null, 2);
    const name = backupFileName();
    const file = new File([json], name, { type: 'application/json' });
    const done = () => {
      update({ lastBackupAt: Date.now() });
      showToast('Backup erstellt');
    };
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Fernweh-Backup' });
        done();
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    done();
  };

  const importFile = async (file: File) => {
    try {
      const { data, skipped } = parseBackup(await file.text());
      const summary = `${Object.keys(data.countries).length} Länder-Einträge, ${Object.keys(data.cities).length} Städte, ${Object.keys(data.ideas).length} Ideen`;
      if (!window.confirm(`Backup laden?\n\n${summary}\n\nDeine aktuellen Daten werden dabei ersetzt.`)) return;
      replaceAll(data);
      showToast(skipped ? `Importiert (${skipped} fehlerhafte Einträge übersprungen)` : 'Backup geladen');
    } catch (e) {
      showToast(e instanceof BackupError ? e.message : 'Datei konnte nicht gelesen werden.');
    }
  };

  const days = settings.lastBackupAt ? (Date.now() - settings.lastBackupAt) / 86_400_000 : Infinity;
  const hasData = counts.countries + counts.cities + counts.ideas > 0;

  return (
    <div className="sheet-body">
      <Section title="Globus">
        <div className="group">
          <Toggle
            label="Automatisch drehen"
            sub="Dreht sich langsam, wenn du nichts tust"
            checked={settings.autoRotate}
            onChange={(v) => update({ autoRotate: v })}
          />
          <Toggle
            label="Städte anzeigen"
            sub="Pins für deine Städte"
            checked={settings.showCities}
            onChange={(v) => update({ showCities: v })}
          />
        </div>
      </Section>

      <Section title="Backup">
        <div className={`backup-card${hasData && days > 30 ? ' is-warn' : ''}`}>
          <HardDrive size={20} />
          <div>
            <div className="backup-title">Letztes Backup: {relativeDays(settings.lastBackupAt)}</div>
            <div className="backup-sub">
              Deine Daten liegen nur auf diesem iPhone. Löschst du die App vom Home-Bildschirm, sind sie weg – sichere sie
              regelmäßig (z. B. in „Dateien“ oder iCloud Drive).
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={exportData}>
            <Download size={18} /> Backup sichern
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Laden
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
      </Section>

      <Section title="Speicher">
        <div className="group">
          <div className="group-row">
            <ShieldCheck size={18} className={persisted ? 'ok' : 'muted'} />
            <div className="group-row-text">
              <div>{persisted ? 'Dauerhafter Speicher aktiv' : 'Speicher nicht als dauerhaft markiert'}</div>
              <div className="muted small">
                {storageMode() === 'memory'
                  ? 'Achtung: Speichern nicht möglich (privater Modus?). Änderungen gehen beim Schließen verloren.'
                  : `${plural(counts.countries, 'Land', 'Länder')} · ${plural(counts.cities, 'Stadt', 'Städte')} · ${plural(counts.ideas, 'Idee', 'Ideen')}`}
              </div>
            </div>
            {!persisted && (
              <button
                type="button"
                className="text-btn"
                onClick={async () => {
                  const ok = await requestPersistence();
                  setPersisted(ok);
                  showToast(ok ? 'Speicher ist jetzt dauerhaft' : 'Der Browser hat abgelehnt – Backups bleiben wichtig');
                }}
              >
                Anfragen
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Über">
        <div className="about">
          <p>
            <Info size={14} /> <strong>Fernweh</strong> · Version {__APP_VERSION__}
          </p>
          <p className="muted small">
            Ländergrenzen & Städte: Natural Earth (gemeinfrei). Länderdaten: mledoze/countries (ODbL). Online-Ortssuche:
            Photon von komoot, Daten © OpenStreetMap-Mitwirkende. Zählweise: 193 UN-Mitglieder + Vatikan + Palästina = 195
            Länder; weitere Gebiete (z. B. Hongkong, Grönland, Kosovo) kannst du markieren, sie werden separat gezählt.
          </p>
        </div>
      </Section>

      <button
        type="button"
        className="btn btn-danger-ghost btn-block"
        onClick={() => {
          if (!window.confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
          if (!window.confirm('Ganz sicher? Ohne Backup sind die Daten endgültig weg.')) return;
          resetAll();
          showToast('Alle Daten gelöscht');
        }}
      >
        <Trash2 size={17} /> Alle Daten löschen
      </button>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="group-row toggle-row">
      <div className="group-row-text">
        <div>{label}</div>
        {sub && <div className="muted small">{sub}</div>}
      </div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
