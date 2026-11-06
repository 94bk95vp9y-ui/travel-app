import { Download, Plus, Share, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isIOS, isStandalone } from '../lib/actions';
import { useData } from '../store/data';
import { useUI } from '../store/ui';

export function ToastHost() {
  const toast = useUI((s) => s.toast);
  const hide = useUI((s) => s.hideToast);
  const [shown, setShown] = useState(toast);

  useEffect(() => {
    if (toast) setShown(toast);
  }, [toast]);

  return (
    <div className={`toast-wrap${toast ? ' is-on' : ''}`} aria-live="polite">
      {shown && (
        <div className="toast">
          <span>{shown.message}</span>
          {shown.actionLabel && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                shown.action?.();
                hide(shown.id);
              }}
            >
              {shown.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Zeigt einen Hinweis, wenn eine neue Version der App bereitliegt. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Beim Öffnen und stündlich nach Updates schauen
      if (!reg) return;
      setInterval(() => void reg.update(), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="update-bar">
      <Sparkles size={18} />
      <span>Neue Version verfügbar</span>
      <button type="button" className="text-btn" onClick={() => setNeedRefresh(false)}>
        Später
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>
        Aktualisieren
      </button>
    </div>
  );
}

/**
 * Begrüßung beim ersten Start. Im Safari-Browser (nicht installiert) zusätzlich die
 * Installationsanleitung – Daten in Safari und in der Home-Bildschirm-App sind getrennt!
 */
export function Welcome() {
  const hydrated = useData((s) => s.hydrated);
  const done = useData((s) => s.data.settings.onboardingDone);
  const update = useData((s) => s.updateSettings);
  const [standalone] = useState(() => isStandalone());
  const [ios] = useState(() => isIOS());
  const [browserDismissed, setBrowserDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('fernweh:browser-ok') === '1';
    } catch {
      return false;
    }
  });

  if (!hydrated) return null;

  const showInstall = !standalone && ios && !browserDismissed;
  const showWelcome = !done && !showInstall;
  if (!showInstall && !showWelcome) return null;

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-orb" />
        {showInstall ? (
          <>
            <h1>Fernweh installieren</h1>
            <p>Damit Fernweh wie eine echte App funktioniert, füge sie zum Home-Bildschirm hinzu:</p>
            <ol className="install-steps">
              <li>
                <span className="install-icon">
                  <Share size={18} />
                </span>
                Tippe unten in Safari auf <strong>Teilen</strong>
              </li>
              <li>
                <span className="install-icon">
                  <Plus size={18} />
                </span>
                Wähle <strong>„Zum Home-Bildschirm“</strong>
              </li>
              <li>
                <span className="install-icon">
                  <Download size={18} />
                </span>
                Öffne Fernweh über das neue Icon
              </li>
            </ol>
            <p className="welcome-warn">
              Wichtig: Was du hier im Browser einträgst, ist <strong>nicht</strong> in der installierten App sichtbar. Trag
              deine Reisen deshalb erst in der installierten App ein.
            </p>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                try {
                  sessionStorage.setItem('fernweh:browser-ok', '1');
                } catch {
                  /* egal */
                }
                setBrowserDismissed(true);
              }}
            >
              Trotzdem im Browser ansehen
            </button>
          </>
        ) : (
          <>
            <h1>Willkommen bei Fernweh</h1>
            <p className="welcome-lead">Dein persönlicher Reise-Atlas.</p>
            <ul className="welcome-list">
              <li>
                <span className="dot dot--visited" /> Markiere Länder und Städte, in denen du warst – mit Jahr.
              </li>
              <li>
                <span className="dot dot--wishlist" /> Sammle Wunschziele für später.
              </li>
              <li>
                <span className="dot dot--idea" /> Speichere TikTok-, Instagram- & Maps-Links direkt beim Ort.
              </li>
            </ul>
            <p className="muted small">Alles bleibt auf deinem iPhone – kein Konto, keine Werbung. Denk an gelegentliche Backups (Einstellungen).</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => update({ onboardingDone: true })}>
              Los geht’s
            </button>
          </>
        )}
      </div>
    </div>
  );
}
