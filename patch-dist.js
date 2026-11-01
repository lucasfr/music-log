#!/usr/bin/env node
// Patches dist/index.html after expo export --platform web
// Expo ignores web/index.html entirely, so we inject our meta tags here.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const file = path.join(__dirname, 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');

// 1. Fix viewport — add viewport-fit=cover
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1'
);

// 2. Inject PWA + iOS meta tags and the page colour before </head>
//
// The status bar is black-translucent, so the page is drawn behind the notch and its colour
// is what you see there. iOS offers no way to pick a colour for that area (only default, which
// is white; black; or translucent), so the page has to be the right colour itself, and it has
// to follow the theme. The script below does that before the app loads, from the saved theme
// (the key ThemeContext stores it under) or the phone's light/dark setting; once the app is
// running, src/utils/pageChrome.js keeps it in step when the theme changes.
//
// Keep these values in step with src/theme/index.js (tests/pageChrome.test.mjs checks them):
//   light page #EBF4F6, dark page #0A1418, light-theme navy #09637E.
// In a translucent status bar the clock is always white, so on the light theme a thin navy
// strip is drawn behind it; on the dark theme the strip is the page colour.
const inject = `
  <!-- iOS PWA -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="music.log" />
  <meta name="theme-color" content="#EBF4F6" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
  <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120.png" />
  <link rel="manifest" href="/manifest.json" />
  <style>
    html { background-color: #EBF4F6; }
  </style>
  <script>
    (function () {
      try {
        var pref = localStorage.getItem('musiclog.theme') || 'system';
        var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        var page = dark ? '#0A1418' : '#EBF4F6';
        var root = document.documentElement.style;
        root.setProperty('background-color', page, 'important');
        root.setProperty('color-scheme', dark ? 'dark' : 'light');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', page);
        document.addEventListener('DOMContentLoaded', function () {
          var band = document.createElement('div');
          band.id = 'status-bar-band';
          band.setAttribute('aria-hidden', 'true');
          band.style.cssText = 'position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:2147483647;pointer-events:none;';
          band.style.backgroundColor = dark ? '#0A1418' : '#09637E';
          document.body.appendChild(band);
        });
      } catch (e) {}
    })();
  </script>
`;

html = html.replace('</head>', inject + '</head>');

fs.writeFileSync(file, html, 'utf8');
console.log('dist/index.html patched successfully');

// 3. The web app manifest the <link rel="manifest"> above points at. Expo's Metro export does not
// write one (the web keys in app.json belong to the old Webpack setup), and without a file there
// Netlify's catch-all redirect answers /manifest.json with index.html, which is not a manifest, so
// Chrome and Android could not install the app. The icon is the 1024px app icon (Chrome wants one
// of 512px or more); the touch icon is the 180px one.
const root = __dirname;
const dist = path.join(root, 'dist');
fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(dist, 'icon.png'));
const manifest = {
  name: 'music.log',
  short_name: 'music.log',
  description: 'Piano practice session logger',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#EAF0F5',
  theme_color: '#EBF4F6',
  icons: [
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: '/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('dist/manifest.json written');

// 4. The service worker, stamped with this build. Its cache name used to be bumped by hand, so every
// deploy left the previous hashed bundles in the cache for good. The id comes from index.html, which
// names the bundles, so it changes exactly when a deploy ships something new, and the worker's
// activate step then deletes every older cache.
const buildId = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
const sw = fs.readFileSync(path.join(root, 'web', 'service-worker.js'), 'utf8');
if (!sw.includes("'musiclog-__BUILD_ID__'")) throw new Error('web/service-worker.js has no cache name placeholder (musiclog-__BUILD_ID__) to stamp');
fs.writeFileSync(path.join(dist, 'service-worker.js'), sw.replace("'musiclog-__BUILD_ID__'", "'musiclog-" + buildId + "'"), 'utf8');
console.log('dist/service-worker.js written (build ' + buildId + ')');
