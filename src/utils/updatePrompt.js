// "A new version is available" banner (web only).
//
// web/service-worker.js posts { type: 'update-available' } when the page it just served from
// the cache has changed on the server. This shows a small banner with a Reload button. It's a
// plain DOM element (like notify()'s toast) so it sits above open modals.

import { COLOURS } from '../theme';

const BANNER_ID = 'musiclog-update';

export function isUpdateMessage(data) {
  return !!data && data.type === 'update-available';
}

export function showUpdateBanner(reload = () => window.location.reload()) {
  if (typeof document === 'undefined' || document.getElementById(BANNER_ID)) return;
  const bar = document.createElement('div');
  bar.id = BANNER_ID;
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
  Object.assign(bar.style, {
    position: 'fixed', left: '50%', transform: 'translateX(-50%)',
    bottom: narrow ? 'calc(110px + env(safe-area-inset-bottom, 0px))' : '24px',
    maxWidth: 'calc(100vw - 32px)', display: 'flex', alignItems: 'center', gap: '14px',
    padding: '10px 10px 10px 20px', borderRadius: '999px',
    background: COLOURS.ink, color: '#fff', font: '14px Lato, system-ui, sans-serif',
    boxShadow: '0 6px 14px rgba(0,0,0,0.3)', zIndex: '2147483647',
  });
  const text = document.createElement('span');
  text.textContent = 'A new version is available';
  const button = (label, onClick, strong) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      font: (strong ? 'bold ' : '') + '14px Lato, system-ui, sans-serif', cursor: 'pointer',
      minHeight: '40px', padding: '0 14px', border: '0', borderRadius: '999px',
      background: strong ? COLOURS.gold : 'transparent', color: strong ? COLOURS.ink : '#fff',
    });
    b.addEventListener('click', onClick);
    return b;
  };
  bar.append(text, button('Reload', reload, true), button('Later', () => bar.remove(), false));
  document.body.appendChild(bar);
}

// Call once at startup on web.
export function setupUpdatePrompt() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener('message', e => {
    if (isUpdateMessage(e.data)) showUpdateBanner();
  });
}
