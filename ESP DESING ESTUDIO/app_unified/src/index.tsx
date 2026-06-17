
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './theme';
import { AiMemoryService } from './services/AiMemoryService';

// ── GLOBAL FETCH INTERCEPTOR ──
// Inyecta automáticamente el token de sesión en todas las peticiones /api/*
// para que AiMemoryService, useEspCopilot, PhaseMonitoreo, etc. funcionen
// sin necesidad de modificar cada llamada individual.
const _originalFetch = window.fetch.bind(window);
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.startsWith('/api/') && !url.includes('/api/login')) {
        const token = sessionStorage.getItem('esp_session_token');
        if (token) {
            const headers = new Headers(init?.headers || {});
            headers.set('x-session-token', token);
            return _originalFetch(input, { ...init, headers });
        }
    }
    return _originalFetch(input, init);
};

// Inicializar Memoria IA (Persistencia en Servidor) — se ejecutará con token si existe
AiMemoryService.init();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// Register Service Worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
