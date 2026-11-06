import { Award, CalendarDays, Dices, HardDrive, Lock, Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { COUNTABLE_TOTAL, getCountry } from '../data/countries';
import { focusCity, focusCountry, randomDestination } from '../lib/actions';
import { formatPercent, relativeDays } from '../lib/format';
import { computeStats } from '../lib/stats';
import { ProgressRing, useCountUp } from '../components/ui';
import { useData } from '../store/data';
import { useUI } from '../store/ui';

export function StatsScreen() {
  const data = useData((s) => s.data);
  const views = useData((s) => s.views);
  const openSheet = useUI((s) => s.openSheet);
  const setTab = useUI((s) => s.setTab);
  const showToast = useUI((s) => s.showToast);
  const stats = useMemo(() => computeStats(data, views), [data, views]);

  const visited = useCountUp(stats.visitedCountable);
  const hasData = Object.keys(data.countries).length + Object.keys(data.cities).length + Object.keys(data.ideas).length > 0;
  const backupDays = data.settings.lastBackupAt ? (Date.now() - data.settings.lastBackupAt) / 86_400_000 : Infinity;
  const unlocked = stats.achievements.filter((a) => a.unlocked).length;

  const roll = () => {
    const pick = randomDestination();
    if (!pick) {
      showToast('Markiere zuerst ein paar Wunschziele 💜');
      return;
    }
    setTab('globe');
    setTimeout(() => {
      if (pick.kind === 'country') focusCountry(pick.code);
      else focusCity(pick.id);
    }, 80);
  };

  return (
    <div className="screen-inner">
      <header className="screen-header screen-header--row">
        <div>
          <h1 className="screen-title">Statistik</h1>
          <p className="screen-sub">Deine Welt in Zahlen</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Einstellungen" onClick={() => openSheet({ kind: 'settings' })}>
          <Settings2 size={20} />
        </button>
      </header>

      {hasData && backupDays > 30 && (
        <button type="button" className="banner banner--warn" onClick={() => openSheet({ kind: 'settings' })}>
          <HardDrive size={18} />
          <span>
            <strong>Zeit für ein Backup</strong> – letztes: {relativeDays(data.settings.lastBackupAt)}. Deine Daten liegen nur auf
            diesem iPhone.
          </span>
        </button>
      )}

      <section className="hero-card">
        <ProgressRing value={stats.visitedCountable / COUNTABLE_TOTAL} size={148} stroke={13}>
          <span className="ring-num">{visited}</span>
          <span className="ring-of">von {COUNTABLE_TOTAL}</span>
        </ProgressRing>
        <div className="hero-side">
          <div className="hero-big">{formatPercent(stats.worldPercent)}</div>
          <div className="hero-label">der Länder der Welt</div>
          <div className="hero-divider" />
          <div className="hero-mini">
            <span className="hero-mini-num">{formatPercent(stats.areaPercent)}</span>
            <span className="hero-mini-label">der Landfläche</span>
          </div>
          {stats.territoriesVisited.length > 0 && (
            <div className="hero-mini">
              <span className="hero-mini-num">+{stats.territoriesVisited.length}</span>
              <span className="hero-mini-label">{stats.territoriesVisited.length === 1 ? 'weiteres Gebiet' : 'weitere Gebiete'}</span>
            </div>
          )}
        </div>
      </section>

      <div className="tile-grid">
        <Tile num={stats.continentsReached} of={7} label="Kontinente" tone="blue" />
        <Tile num={stats.citiesVisited} label={stats.citiesVisited === 1 ? 'Stadt besucht' : 'Städte besucht'} tone="gold" />
        <Tile num={stats.wishlistCountries + stats.citiesWishlist} label="Wunschziele" tone="violet" />
        <Tile num={stats.ideasOpen} label={stats.ideasOpen === 1 ? 'offene Idee' : 'offene Ideen'} tone="pink" />
      </div>

      <button type="button" className="dice-card" onClick={roll}>
        <span className="dice-icon">
          <Dices size={26} />
        </span>
        <span className="dice-text">
          <strong>Wohin als Nächstes?</strong>
          <span>Lass den Zufall aus deiner Wunschliste wählen</span>
        </span>
      </button>

      <section className="card">
        <h2 className="card-title">Kontinente</h2>
        <div className="continents">
          {stats.continents
            .filter((c) => c.code !== 'AN' || c.reached)
            .map((c) => (
              <div key={c.code} className={`continent${c.reached ? ' is-reached' : ''}`}>
                <div className="continent-head">
                  <span>{c.name}</span>
                  <span className="continent-num">
                    {c.code === 'AN' ? '✓' : `${c.visited}/${c.total}`}
                  </span>
                </div>
                <div className="bar">
                  <span className="bar-fill" style={{ width: `${c.total ? (c.visited / c.total) * 100 : c.reached ? 100 : 0}%` }} />
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">
          <CalendarDays size={17} /> Zeitleiste
        </h2>
        {stats.timeline.length === 0 ? (
          <p className="muted small">Trage bei besuchten Ländern oder Städten ein Jahr ein – dann entsteht hier deine Reise-Chronik.</p>
        ) : (
          <ol className="timeline">
            {stats.timeline.map((y) => (
              <li key={y.year} className="timeline-item">
                <span className="timeline-year">{y.year}</span>
                <div className="timeline-body">
                  <div className="timeline-flags">
                    {y.countries.map((code) => {
                      const m = getCountry(code);
                      return (
                        <button key={code} type="button" className="timeline-country" onClick={() => focusCountry(code, { fly: false })}>
                          <span className="flag">{m?.flag}</span> {m?.name}
                        </button>
                      );
                    })}
                  </div>
                  {y.cities.length > 0 && <div className="timeline-cities">{y.cities.map((c) => c.name).join(' · ')}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">
          <Award size={17} /> Erfolge <span className="card-title-sub">{unlocked}/{stats.achievements.length}</span>
        </h2>
        <div className="badges">
          {stats.achievements.map((a) => (
            <div key={a.id} className={`badge${a.unlocked ? ' is-on' : ''}`}>
              <span className="badge-medal">{a.unlocked ? <Award size={22} /> : <Lock size={18} />}</span>
              <span className="badge-title">{a.title}</span>
              <span className="badge-desc">{a.description}</span>
              {!a.unlocked && (
                <span className="badge-progress">
                  <span style={{ width: `${a.progress * 100}%` }} />
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="footnote">
        Gezählt werden 195 Länder (193 UN-Mitglieder + Vatikan + Palästina). Gebiete wie Hongkong oder Grönland kannst du
        markieren – sie zählen separat. Landfläche ohne Antarktis.
      </p>
    </div>
  );
}

function Tile({ num, of, label, tone }: { num: number; of?: number; label: string; tone: 'gold' | 'violet' | 'blue' | 'pink' }) {
  const n = useCountUp(num, 700);
  return (
    <div className={`tile tile--${tone}`}>
      <span className="tile-num">
        {n}
        {of !== undefined && <span className="tile-of">/{of}</span>}
      </span>
      <span className="tile-label">{label}</span>
    </div>
  );
}
