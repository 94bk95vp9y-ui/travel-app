import { Camera, Check, ExternalLink, Globe, Map as MapIcon, MapPinned, Music2, Play, StickyNote, type LucideIcon } from 'lucide-react';
import { getCountry } from '../data/countries';
import { CATEGORY_BY_ID } from '../lib/categories';
import { detectPlatform, fallbackTitle, hostOf, type PlatformId } from '../lib/links';
import type { IdeaRecord } from '../lib/types';
import { useData } from '../store/data';
import { useUI } from '../store/ui';
import { vibrate } from '../lib/actions';

const PLATFORM_ICON: Record<PlatformId, LucideIcon> = {
  tiktok: Music2,
  instagram: Camera,
  youtube: Play,
  gmaps: MapPinned,
  amaps: MapIcon,
  web: Globe,
  none: StickyNote,
};

export function PlatformBadge({ url, size = 40 }: { url: string; size?: number }) {
  const p = detectPlatform(url);
  const Icon = PLATFORM_ICON[p.id];
  return (
    <span className="platform-badge" style={{ width: size, height: size, background: p.color }} title={p.label}>
      <Icon size={size * 0.46} strokeWidth={2.4} />
    </span>
  );
}

export function IdeaCard({ idea, showPlace = true }: { idea: IdeaRecord; showPlace?: boolean }) {
  const city = useData((s) => (idea.cityId ? s.data.cities[idea.cityId] : undefined));
  const updateIdea = useData((s) => s.updateIdea);
  const openSheet = useUI((s) => s.openSheet);
  const country = getCountry(idea.countryCode);
  const cat = CATEGORY_BY_ID[idea.category];
  const CatIcon = cat.icon;
  const title = idea.title || fallbackTitle(idea.url);
  const unsorted = !idea.countryCode && !idea.cityId;

  return (
    <div className={`idea-card${idea.done ? ' is-done' : ''}`}>
      <button type="button" className="idea-card-main" onClick={() => openSheet({ kind: 'idea', id: idea.id })}>
        <PlatformBadge url={idea.url} />
        <span className="idea-card-text">
          <span className="idea-card-title">{title}</span>
          {idea.note && <span className="idea-card-note">{idea.note}</span>}
          <span className="idea-card-meta">
            <span className="idea-cat" style={{ color: cat.color }}>
              <CatIcon size={12} strokeWidth={2.6} />
              {cat.label}
            </span>
            {showPlace && (unsorted ? (
              <span className="idea-place idea-place--unsorted">Sammelbox</span>
            ) : (
              <span className="idea-place">
                {country?.flag} {city ? city.name : country?.name}
              </span>
            ))}
            {!showPlace && idea.url && <span className="idea-host">{hostOf(idea.url)}</span>}
          </span>
        </span>
      </button>
      <div className="idea-card-actions">
        {idea.url && (
          <a className="icon-btn icon-btn--ghost" href={idea.url} target="_blank" rel="noopener noreferrer" aria-label="Link öffnen">
            <ExternalLink size={17} />
          </a>
        )}
        <button
          type="button"
          className={`check-btn${idea.done ? ' is-on' : ''}`}
          aria-label={idea.done ? 'Als offen markieren' : 'Als erledigt markieren'}
          onClick={() => {
            updateIdea(idea.id, { done: !idea.done });
            vibrate(8);
          }}
        >
          <Check size={15} strokeWidth={3.2} />
        </button>
      </div>
    </div>
  );
}
