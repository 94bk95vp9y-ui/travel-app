import { useEffect } from 'react';
import { GlobeHud } from './components/GlobeHud';
import { GlobeView } from './components/GlobeView';
import { ToastHost, UpdatePrompt, Welcome } from './components/Overlays';
import { SheetHost } from './components/SheetHost';
import { TabBar } from './components/TabBar';
import { IdeasScreen } from './screens/IdeasScreen';
import { PlacesScreen } from './screens/PlacesScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useData } from './store/data';
import { useUI } from './store/ui';

export function App() {
  const tab = useUI((s) => s.tab);
  const hydrated = useData((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 600);
    }
  }, [hydrated]);

  return (
    <div className="app">
      <div className={`globe-layer${tab === 'globe' ? ' is-active' : ''}`}>
        <GlobeView />
        <GlobeHud />
      </div>

      <Screen active={tab === 'places'}>
        <PlacesScreen />
      </Screen>
      <Screen active={tab === 'ideas'}>
        <IdeasScreen />
      </Screen>
      <Screen active={tab === 'stats'}>
        <StatsScreen />
      </Screen>

      <TabBar />
      <SheetHost />
      <ToastHost />
      <UpdatePrompt />
      <Welcome />
    </div>
  );
}

/** Nur der aktive Bildschirm wird gerendert – spart Arbeit, Animationen starten beim Öffnen neu. */
function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <main className={`screen${active ? ' is-active' : ''}`} aria-hidden={!active}>
      {active ? children : null}
    </main>
  );
}
