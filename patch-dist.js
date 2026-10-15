#!/usr/bin/env node
// Patches dist/index.html after expo export --platform web
// Expo ignores web/index.html entirely, so we inject our meta tags here.

const fs = require('fs');
const path = require('path');

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
