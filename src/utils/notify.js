// notify(title, message?) — tell the user something short.
//
//   native: a normal alert dialog.
//   web:    Alert.alert does nothing in a browser, so show a toast instead. It's a plain
//           DOM element rather than a React component so it always sits above open modals
//           (the log forms are modals on mobile, and an app-level toast would be hidden
//           underneath them).

import { Alert, Platform } from 'react-native';
import { COLOURS } from '../theme';

const TOAST_ID = 'musiclog-toast';
const SHOW_MS = 4000;
let hideTimer = null;

function webToast(text) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  // Clear of the floating tab bar on phones; tucked in the corner area on desktop.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: narrow ? 'calc(110px + env(safe-area-inset-bottom, 0px))' : '24px',
    transform: 'translateX(-50%) translateY(12px)',
    maxWidth: 'calc(100vw - 32px)',
    padding: '12px 20px',
    borderRadius: '999px',
    background: COLOURS.ink,
    color: '#fff',
    font: '14px Lato, system-ui, sans-serif',
    textAlign: 'center',
    boxShadow: '0 6px 14px rgba(0,0,0,0.3)',
    zIndex: '2147483647',
    opacity: '0',
    transition: 'opacity 180ms ease, transform 180ms ease',
    pointerEvents: 'none',
  });
  el.textContent = text;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(12px)';
  }, SHOW_MS);
}

export function notify(title, message) {
  if (Platform.OS === 'web') {
    webToast(message ? `${title}: ${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
