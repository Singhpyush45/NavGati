import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from '@/context/AuthContext';
import { applyTheme } from '@/utils/prefs';
import './index.css';

applyTheme();

// Keep the browser's install prompt so Settings can offer an "Install app" button.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); (window as unknown as { __navgatiInstall?: Event }).__navgatiInstall = e; window.dispatchEvent(new Event('navgati-installable')); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// Installable PWA + offline shell (production builds only, so dev hot-reload isn't cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
