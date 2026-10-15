// The colours the browser page shows behind and around the app, kept in step with the theme.
// Pure where it can be (no imports), so it's unit-tested in plain Node, see tests/pageChrome.test.mjs.
//
// Why this exists: the installed iPhone app (a PWA) is drawn with a translucent status bar, so
// the area behind the notch is the *page*, not the app. iOS can't be told a colour for that
// area (Apple offers only default / black / black-translucent), so the page itself has to be
// the right colour, and it has to follow the theme. It used to be a fixed light colour, which
// is the white notch seen above a dark app. The text in a translucent status bar is always
// white, so on the light theme a thin dark band is drawn across it to keep the clock readable.

// colours: the COLOURS object (or any object with bg, navy and isDark).
export function pageChrome(colours) {
  const dark = !!colours.isDark;
  return {
    page: colours.bg,                      // html, body and the root view
    themeColor: colours.bg,                // <meta name="theme-color">
    band: dark ? colours.bg : colours.navy, // the strip behind the status bar
    scheme: dark ? 'dark' : 'light',       // CSS color-scheme (scrollbars, form controls)
  };
}

// The strip across the top: as tall as the notch / status bar (0 in a browser tab, on desktop,
// or anywhere there is no inset), never catching a tap, above everything else.
// patch-dist.js builds the same element before the app loads, so keep the two in step.
export const BAND_ID = 'status-bar-band';
export const BAND_CSS = 'position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:2147483647;pointer-events:none;';

// Applies pageChrome(colours) to the document. A no-op anywhere there is no DOM (native).
export function applyPageChrome(colours) {
  if (typeof document === 'undefined') return;
  const c = pageChrome(colours);
  // !important, because the page ships a fallback colour that must not win.
  const paint = el => { if (el) el.style.setProperty('background-color', c.page, 'important'); };
  paint(document.documentElement);
  paint(document.body);
  paint(document.getElementById('root'));
  document.documentElement.style.setProperty('color-scheme', c.scheme);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', c.themeColor);

  let band = document.getElementById(BAND_ID);
  if (!band && document.body) {
    band = document.createElement('div');
    band.id = BAND_ID;
    band.setAttribute('aria-hidden', 'true');
    band.style.cssText = BAND_CSS;
    document.body.appendChild(band);
  }
  if (band) band.style.backgroundColor = c.band;
}
