import { Dices, Search, Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { COUNTABLE_TOTAL, COUNTRY_BY_CODE } from '../data/countries';
import { focusCity, focusCountry, primeKeyboard, randomDestination } from '../lib/actions';
import { formatPercent } from '../lib/format';
import { useData } from '../store/data';
import { useUI } from '../store/ui';

export function GlobeHud() {
  const views = useData((s) => s.views);
  const hydrated = useData((s) => s.hydrated);
  const openSheet = useUI((s) => s.openSheet);
  const setTab = useUI((s) => s.setTab);
  const showToast = useUI((s) => s.showToast);
  const sheets = useUI((s) => s.sheets);

  const { visited, wish } = useMemo(() => {
    let visited = 0;
    let wish = 0;
    for (const v of views.values()) {
      if (v.status === 'visited' && COUNTRY_BY_CODE.get(v.code)?.countable) visited++;
      else if (v.status === 'wishlist') wish++;
    }
    return { visited, wish };
  }, [views]);

  const empty = hydrated && views.size === 0;
  const pct = (visited / COUNTABLE_TOTAL) * 100;

  return (
    <div className={`hud${sheets.length ? ' has-sheet' : ''}`}>
      <div className="hud-top">
        <button type="button" className="hud-stats glass" onClick={() => setTab('stats')}>
          <span className="hud-stats-num">{visited}</span>
          <span className="hud-stats-text">
            <span>{visited === 1 ? 'Land' : 'Länder'}</span>
            <span className="hud-stats-sub">{formatPercent(pct)} der Welt</span>
          </span>
          {wish > 0 && (
            <span className="hud-stats-wish">
              <span className="dot dot--wishlist" /> {wish}
            </span>
          )}
        </button>
        <div className="hud-actions">
          <button
            type="button"
            className="icon-btn glass"
            aria-label="Suchen"
            onClick={() => {
              primeKeyboard();
              openSheet({ kind: 'search', mode: 'any' });
            }}
          >
            <Search size={20} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="icon-btn glass"
            aria-label="Zufälliges Wunschziel"
            onClick={() => {
              const pick = randomDestination();
              if (!pick) {
                showToast('Markiere zuerst ein paar Wunschziele 💜');
                return;
              }
              if (pick.kind === 'country') focusCountry(pick.code);
              else focusCity(pick.id);
            }}
          >
            <Dices size={20} strokeWidth={2.2} />
          </button>
          <button type="button" className="icon-btn glass" aria-label="Einstellungen" onClick={() => openSheet({ kind: 'settings' })}>
            <Settings2 size={19} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {empty && !sheets.length && (
        <div className="hud-hint glass">
          <strong>Willkommen!</strong> Tippe auf ein Land oder auf <span className="hud-plus">+</span>, um deine Reisen einzutragen.
        </div>
      )}

      <div className="hud-legend">
        <span>
          <span className="dot dot--visited" /> Besucht
        </span>
        <span>
          <span className="dot dot--wishlist" /> Will hin
        </span>
      </div>
    </div>
  );
}
