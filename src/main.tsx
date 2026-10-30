import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          if (reg.active?.scriptURL.includes('dev-sw.js')) {
            reg.unregister().catch(() => {});
          }
        }
      })
      .catch(() => {});

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.includes('workbox'))
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {});
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore service worker registration restrictions in sandboxed iframes
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
