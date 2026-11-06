import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useData } from './store/data';
import './styles/global.css';

void useData.getState().hydrate();

// iOS: Seiten-Zoom per Zwei-Finger-Geste verhindern (der Globus hat eigenes Zoomen)
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
