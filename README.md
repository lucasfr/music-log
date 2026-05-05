# 🎵 music.log

**A personal piano practice logger — track sessions, compositions, and progress as a PWA or native app.**

[![MIT License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)
[![Built with Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)](https://music-log.netlify.app)

---

## 📖 What is music.log?

music.log is a practice journal built for adult piano learners. It replaces free-text notes with a structured session log — segmented by technique work and repertoire, tagged with challenges and progress markers, and linked to a piece library that tracks status, grade, teacher notes, and session history per composition.

It runs as an installable PWA in any browser and as a native iOS/Android app via Expo. All data is stored locally — IndexedDB on web, SQLite on native — with no account or backend required.

---

## ✨ Features

- 📋 **Session logging** — date, energy level (−2 to +2), total duration, and unlimited segments
- 🎼 **Segment types** — technique (Hanon, Scales, Arpeggios, Sight-reading, Technical exercise) and repertoire, each with notes, challenge tags, and progress tags
- 🗂️ **Composition library** — per-piece tracking of status (learning / consolidating / performance-ready), key, time signature, grade estimate, teacher notes, personal notes, and full practice session history
- 📊 **Stats** — 30-day totals, day streak, 14-day activity chart, most-practiced pieces, and library breakdown by status
- 📤 **JSON export** — share any session as a structured JSON file via the native share sheet or browser download
- 💾 **Offline-first** — IndexedDB on web, expo-sqlite on native; no network required after install
- 🌐 **PWA-ready** — installable from any browser, service worker caching, Netlify deploy

---

## 🗂️ Project Structure

```
music-log/
├── App.js                        # Root: font loading, navigation, SW registration
├── app.json                      # Expo config + PWA metadata
├── netlify.toml                  # Netlify build config
├── web/
│   └── service-worker.js         # PWA cache-first service worker
├── assets/
│   ├── icon.png                  # App icon (1024×1024, crotchet on navy)
│   ├── adaptive-icon.png         # Android adaptive icon
│   ├── splash-icon.png           # Splash screen
│   └── favicon.png               # Web favicon
└── src/
    ├── constants.js              # Tag lists, keys, grades, status options
    ├── utils.js                  # uid, date helpers
    ├── theme/
    │   └── index.js              # Colour tokens, radius, status colours
    ├── db/
    │   ├── index.js              # SQLite (native) + IndexedDB (web) data layer
    │   └── hooks.js              # useSessions, useCompositions React hooks
    ├── components/
    │   ├── Background.js         # Dot-grid SVG background
    │   ├── UI.js                 # GlassCard, Btn, TagCloud, StatusPill, etc.
    │   ├── Form.js               # TextF, NumberF, SelectF (platform-adaptive picker)
    │   └── SegmentEditor.js      # Collapsible technique / repertoire segment editor
    ├── screens/
    │   ├── LogScreen.js          # Session logging
    │   ├── CompositionsScreen.js # Piece library
    │   ├── HistoryScreen.js      # Past sessions + JSON export
    │   └── StatsScreen.js        # Overview and charts
    └── utils/
        └── export.js             # JSON export: Blob download (web) / share sheet (native)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
git clone https://github.com/lucasfranca/music-log.git
cd music-log
npm install
```

### Run

```bash
# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android

# Web (PWA dev server)
npx expo start --web
```

### Build and deploy (PWA)

```bash
npm run build:web          # outputs to dist/
npx serve dist             # preview locally
```

Connect the repo to Netlify — it will pick up `netlify.toml` automatically and run `npm run build:web` on every push to `main`.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~54 | Build toolchain and runtime |
| `expo-sqlite` | ~15 | Local SQLite storage (native) |
| `expo-blur` | ~14 | Glassmorphism `BlurView` cards |
| `expo-font` | ~13 | Custom font loading |
| `expo-file-system` | ~18 | Temp file write for JSON export (native) |
| `expo-sharing` | ~12 | Native share sheet for JSON export |
| `react-native-web` | ~0.20 | Web render target |
| `react-native-svg` | ~15 | Dot-grid background |
| `@react-navigation/bottom-tabs` | ^7 | Tab bar navigation |
| `@react-native-picker/picker` | ~2.11 | Native select inputs |
| `@expo-google-fonts/libre-baskerville` | ~0.3 | Serif display font |
| `@expo-google-fonts/source-sans-3` | ~0.3 | Body and UI font |

---

## 👥 Authors

| Role | Name |
|------|------|
| Developer | [Lucas França](https://github.com/lucasfranca) |

---

## 📄 Licence

Released under the [MIT License](./LICENSE).

Copyright © Lucas França, 2026
