import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/vault.css';

// Register offline Service Worker for shell caching alongside Dexie IndexedDB
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal if browser restricts service workers in embedded frames
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
