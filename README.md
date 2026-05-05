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

- 🏠 **Home screen** — today's session summary card and a scrollable journal feed of past sessions, each expandable into full detail
- 📅 **Calendar view** — monthly grid with practiced-day markers, month stats (sessions, minutes, avg energy), and current streak; tap any day to log or review
- ⚡ **Zelda-style rating bars** — energy (⚡) and enjoyment (❤️) rated 1–5 by tap or hold-and-slide, per session; felt difficulty (🎵) rated per segment
- 🎼 **Segment types** — technique (Hanon, Scales, Arpeggios, Sight-reading, Technical exercise) and repertoire, each with notes, felt difficulty, challenge tags, and progress tags
- 🗂️ **Composition library** — per-piece tracking of status, 🎹 difficulty (Zelda-style, tap or slide), key, time signature, grade, arrangement, collection, year, tags, dates, teacher notes, study notes (technical challenges, musical focus, practice notes), teacher feedback, resources, and full session history across five tabs
- 📊 **Stats** — 30-day totals, day streak, 14-day activity chart, most-practiced pieces, and library breakdown by status
- 📤 **JSON export** — share any session as a structured JSON file via the native share sheet (iOS/Android) or browser download (web)
- 🔍 **Autocomplete** — composer and arranger fields suggest names from existing entries as you type
- 💾 **Offline-first** — IndexedDB on web, expo-sqlite on native; no account or network required
- 🌐 **PWA-ready** — installable from any browser including iOS Safari, service worker caching, Netlify deploy

---

## 🗂️ Project Structure

```
music-log/
├── App.js                        # Root: font loading, navigation, SW registration
├── app.json                      # Expo config + PWA metadata
├── netlify.toml                  # Netlify build config
├── web/
│   ├── index.html                # Custom HTML template with Apple touch icon tags
│   └── service-worker.js         # PWA cache-first service worker
├── assets/
│   ├── icon.png                  # App icon (1024×1024, crotchet on navy)
│   ├── adaptive-icon.png         # Android adaptive icon
│   ├── splash-icon.png           # Splash screen
│   ├── favicon.png               # Web favicon
│   ├── apple-touch-icon.png      # iOS PWA home screen icon (180×180)
│   ├── apple-touch-icon-152.png  # iOS PWA icon (152×152)
│   └── apple-touch-icon-120.png  # iOS PWA icon (120×120)
└── src/
    ├── constants.js              # Tag lists, keys, grades, status options
    ├── utils.js                  # uid, date helpers
    ├── theme/
    │   └── index.js              # Colour tokens (#213C51 navy palette), radius
    ├── db/
    │   ├── index.js              # SQLite (native) + IndexedDB (web) data layer
    │   └── hooks.js              # useSessions, useCompositions React hooks
    ├── components/
    │   ├── Background.js         # Dot-grid SVG background
    │   ├── UI.js                 # GlassCard, Btn, TagCloud, StatusPill, etc.
    │   ├── Form.js               # TextF, NumberF, SelectF (platform-adaptive picker)
    │   ├── SegmentEditor.js      # Collapsible technique / repertoire segment editor
    │   ├── LogModal.js           # Session log form (pageSheet modal)
    │   └── SessionDetailModal.js # Read-only session detail with export + delete
    ├── screens/
    │   ├── HomeScreen.js         # Journal feed + today summary + FAB
    │   ├── CalendarScreen.js     # Monthly calendar with streak and month stats
    │   ├── CompositionsScreen.js # Piece library with full composition template
    │   └── StatsScreen.js        # Overview, charts, and library breakdown
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
