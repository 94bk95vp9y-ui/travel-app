import { Building2, Flag as FlagIcon, Link2, StickyNote } from 'lucide-react';
import type { ReactNode } from 'react';
import { primeKeyboard } from '../../lib/actions';
import { useUI } from '../../store/ui';

export function AddSheet() {
  const openSheet = useUI((s) => s.openSheet);

  const go = (fn: () => void, keyboard = true) => {
    if (keyboard) primeKeyboard();
    fn();
  };

  return (
    <div className="add-sheet">
      <h2 className="add-title">Hinzufügen</h2>
      <div className="add-grid">
        <AddTile
          icon={<Link2 size={24} strokeWidth={2.2} />}
          title="Link speichern"
          text="TikTok, Instagram, Maps …"
          tone="gold"
          onClick={() => go(() => openSheet({ kind: 'idea' }, { replaceTop: true }), false)}
        />
        <AddTile
          icon={<FlagIcon size={24} strokeWidth={2.2} />}
          title="Land markieren"
          text="Besucht oder Wunschziel"
          tone="violet"
          onClick={() => go(() => openSheet({ kind: 'search', mode: 'country', status: 'visited' }, { replaceTop: true }))}
        />
        <AddTile
          icon={<Building2 size={24} strokeWidth={2.2} />}
          title="Stadt hinzufügen"
          text="Mit Pin auf dem Globus"
          tone="blue"
          onClick={() => go(() => openSheet({ kind: 'search', mode: 'city', status: 'visited' }, { replaceTop: true }))}
        />
        <AddTile
          icon={<StickyNote size={24} strokeWidth={2.2} />}
          title="Notiz"
          text="Idee ohne Link"
          tone="green"
          onClick={() => go(() => openSheet({ kind: 'idea', prefill: { category: 'other' } }, { replaceTop: true }), false)}
        />
      </div>
    </div>
  );
}

function AddTile({
  icon,
  title,
  text,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: 'gold' | 'violet' | 'blue' | 'green';
  onClick(): void;
}) {
  return (
    <button type="button" className={`add-tile add-tile--${tone}`} onClick={onClick}>
      <span className="add-tile-icon">{icon}</span>
      <span className="add-tile-title">{title}</span>
      <span className="add-tile-text">{text}</span>
    </button>
  );
}
