import { ClipboardPaste, ExternalLink, Inbox, Loader2, MapPin, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountry } from '../../data/countries';
import { CATEGORIES } from '../../lib/categories';
import { detectPlatform, extractUrl, fallbackTitle, fetchLinkTitle, isValidUrl } from '../../lib/links';
import { normalize, searchCountries } from '../../lib/search';
import type { IdeaCategory, IdeaRecord } from '../../lib/types';
import { useData } from '../../store/data';
import { useUI } from '../../store/ui';
import { PlatformBadge } from '../IdeaCard';
import { useSheet } from '../Sheet';
import { Flag } from '../ui';

interface Props {
  id?: string;
  prefill?: Partial<IdeaRecord>;
}

interface Place {
  countryCode: string | null;
  cityId: string | null;
}

export function IdeaSheetHeader({ id, editor }: { id?: string; editor: IdeaEditorState }) {
  const sheet = useSheet();
  const showToast = useUI((s) => s.showToast);
  const onSave = () => {
    if (!editor.save()) return;
    sheet.close();
    if (!id) {
      const where = editor.place.cityId || editor.place.countryCode ? 'Idee gespeichert' : 'In der Sammelbox gespeichert';
      showToast(where);
    }
  };
  return (
    <div className="editor-header">
      <button type="button" className="text-btn" onClick={sheet.close}>
        Abbrechen
      </button>
      <h2 className="editor-title">{id ? 'Idee bearbeiten' : 'Neue Idee'}</h2>
      <button type="button" className="text-btn text-btn--strong" disabled={!editor.canSave} onClick={onSave}>
        Sichern
      </button>
    </div>
  );
}

export function useIdeaEditor({ id, prefill }: Props) {
  const existing = useData((s) => (id ? s.data.ideas[id] : undefined));
  const base = existing ?? prefill ?? {};
  const [url, setUrl] = useState(base.url ?? '');
  const [title, setTitle] = useState(base.title ?? '');
  const [note, setNote] = useState(base.note ?? '');
  const [category, setCategory] = useState<IdeaCategory>(base.category ?? 'food');
  const [place, setPlace] = useState<Place>({ countryCode: base.countryCode ?? null, cityId: base.cityId ?? null });
  const [titleLoading, setTitleLoading] = useState(false);
  const titleTouched = useRef(Boolean(base.title));

  const urlOk = !url || isValidUrl(url);
  const canSave = urlOk && Boolean(url.trim() || title.trim() || note.trim());

  // Titel automatisch holen (TikTok/YouTube), wenn der Nutzer noch keinen eingegeben hat
  useEffect(() => {
    if (!url || !isValidUrl(url) || titleTouched.current) return;
    let cancelled = false;
    setTitleLoading(true);
    const t = setTimeout(() => {
      fetchLinkTitle(url).then((fetched) => {
        if (cancelled) return;
        setTitleLoading(false);
        if (fetched && !titleTouched.current) setTitle(fetched);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setTitleLoading(false);
    };
  }, [url]);

  const save = (): boolean => {
    if (!canSave) return false;
    const store = useData.getState();
    const payload = {
      url: url.trim(),
      title: title.trim(),
      note: note.trim(),
      category,
      countryCode: place.countryCode,
      cityId: place.cityId,
    };
    if (id && existing) store.updateIdea(id, payload);
    else store.addIdea(payload);
    return true;
  };

  return {
    existing,
    url, setUrl, title, setTitle, note, setNote, category, setCategory, place, setPlace,
    titleLoading, titleTouched, urlOk, canSave, save,
  };
}

export type IdeaEditorState = ReturnType<typeof useIdeaEditor>;

export function IdeaSheet({ editor, id }: { editor: IdeaEditorState; id?: string }) {
  const sheet = useSheet();
  const showToast = useUI((s) => s.showToast);
  const deleteIdea = useData((s) => s.deleteIdea);
  const restoreIdea = useData((s) => s.restoreIdea);
  const { url, setUrl, title, setTitle, note, setNote, category, setCategory, place, setPlace, titleLoading, titleTouched, urlOk } = editor;
  const urlRef = useRef<HTMLInputElement>(null);
  const platform = detectPlatform(url);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyText(text);
    } catch {
      urlRef.current?.focus();
      showToast('Einfügen nicht erlaubt – halte das Feld gedrückt und wähle „Einfügen“.');
    }
  };

  const applyText = (text: string) => {
    const { url: found, rest } = extractUrl(text);
    if (found) {
      setUrl(found);
      if (rest && !title && !titleTouched.current && rest.length < 140) {
        setTitle(rest);
        titleTouched.current = true;
      }
    } else if (text.trim()) {
      setUrl(text.trim());
    }
  };

  return (
    <div className="sheet-body editor">
      <div className="field">
        <label className="field-label" htmlFor="idea-url">
          Link
        </label>
        <div className={`url-field${!urlOk ? ' is-invalid' : ''}`}>
          <PlatformBadge url={url} size={34} />
          <input
            id="idea-url"
            ref={urlRef}
            className="url-input"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="TikTok, Instagram, YouTube, Maps …"
            value={url}
            onChange={(e) => setUrl(e.target.value.trim())}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text) {
                e.preventDefault();
                applyText(text);
              }
            }}
          />
          {url ? (
            <button type="button" className="search-clear" aria-label="Link entfernen" onClick={() => setUrl('')}>
              <X size={14} strokeWidth={3} />
            </button>
          ) : (
            <button type="button" className="paste-btn" onClick={paste}>
              <ClipboardPaste size={16} /> Einfügen
            </button>
          )}
        </div>
        {!urlOk && <p className="field-error">Das sieht nicht nach einem Link aus.</p>}
        {url && urlOk && (
          <a className="link-preview" href={url} target="_blank" rel="noopener noreferrer">
            {platform.label} öffnen <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="idea-title">
          Titel {titleLoading && <Loader2 className="spin" size={12} />}
        </label>
        <input
          id="idea-title"
          className="input"
          placeholder={fallbackTitle(url)}
          value={title}
          maxLength={200}
          onChange={(e) => {
            titleTouched.current = true;
            setTitle(e.target.value);
          }}
        />
      </div>

      <div className="field">
        <span className="field-label">Kategorie</span>
        <div className="cat-grid">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                className={`cat-chip${category === c.id ? ' is-on' : ''}`}
                style={{ ['--cat' as string]: c.color }}
                onClick={() => setCategory(c.id)}
              >
                <Icon size={16} strokeWidth={2.4} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Ort</span>
        <PlacePicker value={place} onChange={setPlace} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="idea-note">
          Notiz
        </label>
        <textarea
          id="idea-note"
          className="input textarea"
          rows={3}
          placeholder="Was genau? Name vom Restaurant, Uhrzeit, Preis …"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {id && editor.existing && (
        <button
          type="button"
          className="btn btn-danger-ghost btn-block"
          onClick={() => {
            const copy = { ...editor.existing! };
            sheet.close();
            setTimeout(() => {
              deleteIdea(id);
              showToast('Idee gelöscht', 'Rückgängig', () => restoreIdea(copy));
            }, 320);
          }}
        >
          <Trash2 size={17} /> Idee löschen
        </button>
      )}
    </div>
  );
}

/** Ort zuordnen: Land oder eigene Stadt – oder in der Sammelbox lassen. */
function PlacePicker({ value, onChange }: { value: Place; onChange(p: Place): void }) {
  const cities = useData((s) => s.data.cities);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const city = value.cityId ? cities[value.cityId] : undefined;
  const country = getCountry(city?.countryCode ?? value.countryCode);

  const results = useMemo(() => {
    const nq = normalize(q);
    const myCities = Object.values(cities)
      .filter((c) => !nq || normalize(c.name).includes(nq))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, nq ? 6 : 5);
    const countries = nq ? searchCountries(q, 6) : [];
    return { myCities, countries };
  }, [q, cities]);

  if (!open) {
    return (
      <button type="button" className="place-field" onClick={() => setOpen(true)}>
        {country ? (
          <>
            <Flag emoji={country.flag} size={22} />
            <span className="place-field-text">
              <span className="place-field-title">{city ? city.name : country.name}</span>
              {city && <span className="place-field-sub">{country.name}</span>}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="search-clear"
              aria-label="Ort entfernen"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ countryCode: null, cityId: null });
              }}
            >
              <X size={14} strokeWidth={3} />
            </span>
          </>
        ) : (
          <>
            <span className="place-field-icon">
              <Inbox size={18} />
            </span>
            <span className="place-field-text">
              <span className="place-field-title">Sammelbox</span>
              <span className="place-field-sub">Noch keinem Ort zugeordnet – tippen zum Zuordnen</span>
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="place-picker">
      <label className="search-field search-field--inline">
        <Search size={17} className="search-field-icon" />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Land oder eine deiner Städte"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="text-btn" onClick={() => setOpen(false)}>
          Fertig
        </button>
      </label>
      <div className="result-list result-list--compact">
        {results.myCities.map((c) => {
          const cc = getCountry(c.countryCode);
          return (
            <button
              key={c.id}
              type="button"
              className="result-row"
              onClick={() => {
                onChange({ countryCode: c.countryCode, cityId: c.id });
                setOpen(false);
              }}
            >
              <span className={`result-icon result-icon--${c.status}`}>
                <MapPin size={15} />
              </span>
              <span className="result-text">
                <span className="result-title">{c.name}</span>
                <span className="result-sub">
                  {cc?.flag} {cc?.name}
                </span>
              </span>
            </button>
          );
        })}
        {results.countries.map((c) => (
          <button
            key={c.code}
            type="button"
            className="result-row"
            onClick={() => {
              onChange({ countryCode: c.code, cityId: null });
              setOpen(false);
            }}
          >
            <Flag emoji={c.flag} size={24} />
            <span className="result-text">
              <span className="result-title">{c.name}</span>
              <span className="result-sub">Ganzes Land</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          className="result-row"
          onClick={() => {
            onChange({ countryCode: null, cityId: null });
            setOpen(false);
          }}
        >
          <span className="result-icon">
            <Inbox size={15} />
          </span>
          <span className="result-text">
            <span className="result-title">In der Sammelbox lassen</span>
            <span className="result-sub">Später zuordnen</span>
          </span>
        </button>
      </div>
    </div>
  );
}
