#!/usr/bin/env node
// Patches dist/index.html after expo export --platform web
// Expo ignores web/index.html entirely, so we inject our meta tags here.

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');

// 1. Fix viewport — add viewport-fit=cover
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
);

// 2. Inject PWA + iOS meta tags and bg colour before </head>
const inject = `
  <!-- iOS PWA -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="music.log" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
  <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120.png" />
  <link rel="manifest" href="/manifest.json" />
  <style>
    html, body { background-color: #EBF4F6 !important; }
    #root { background-color: #EBF4F6 !important; }
  </style>
`;

html = html.replace('</head>', inject + '</head>');

fs.writeFileSync(file, html, 'utf8');
console.log('dist/index.html patched successfully');
