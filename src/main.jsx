import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// A failed lazy-chunk import after a redeploy means the old hashed assets are
// gone — one reload picks up the new build instead of a broken screen.
// One-shot per tab: a second failure (genuinely offline) falls through to the
// ErrorBoundary instead of reload-looping.
window.addEventListener('vite:preloadError', (event) => {
  if (!sessionStorage.getItem('chunk_reloaded')) {
    sessionStorage.setItem('chunk_reloaded', '1');
    event.preventDefault();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register service worker for PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}
