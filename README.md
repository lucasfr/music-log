# 🎹 music.log

**A structured practice journal for adult piano learners — log sessions, track repertoire, and review progress as a PWA or native app.**

[![Built with Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)](https://music-log.netlify.app)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 📖 What is music.log?

music.log is a practice journal built for adult piano learners. It replaces free-text notes with structured session logs — segmented by technique work and repertoire, tagged with challenges and progress markers, and linked to a composition library that tracks status, grade, teacher notes, and full session history per piece.

It runs as an installable PWA in any browser and as a native iOS/Android app via Expo. All data is stored locally — IndexedDB on web, SQLite on native — with no account or backend required.

---

## ✨ Features

- 🏠 **Home** — today's session card and a scrollable journal feed; tap any entry to open a full detail panel (inline on desktop, modal on mobile)
- 📅 **Calendar** — monthly grid with practice and lesson markers, month stats (sessions, lessons, minutes, avg energy), streak counter, and a day-detail panel on desktop
- 📖 **History** — chronological feed of all sessions and lessons, fully expanded inline with complete segment detail, wins, and next-focus notes
- 🎓 **Lessons** — log lessons separately with teacher, duration, per-piece feedback, assignments, overall notes, wins, and focus for next time
- 🎼 **Segment logging** — sessions split into technique segments (Hanon, Scales, Arpeggios, Sight-reading) and repertoire segments, each with notes, felt difficulty, challenge tags, and progress tags
- 🗂️ **Composition library** — per-piece tracking of status, 🎹 difficulty, keys, time signatures, grade, arrangement, collection, year, tags, dates, teacher notes, study notes, and session history
- ⚡ **Zelda-style rating bars** — energy (⚡) and enjoyment (❤️) per session; felt difficulty (🎵) and liking (⭐) per segment; all rated by tap or hold-and-slide
- 📊 **Stats** — period-aware overview (6 tiles: practice time, sessions, lessons, streak, avg energy ⚡, avg enjoyment ❤️); activity grid (full year, lesson markers); weekly trends + session quality scatter; technique group breakdown with time, count and difficulty; interactive circle of fifths (major/minor rings, tap for per-key stats); library status tiles; library growth chart + streak history; most-practised pieces with session and piece-level Zelda bars; wins timeline — all half-half glass cards on desktop
- 🖥️ **Desktop two-column layout** — sidebar navigation, inline log forms and detail panels, no modals
- 📤 **JSON export** — share any session as structured JSON via native share sheet or browser download
- 💾 **Offline-first** — IndexedDB on web, expo-sqlite on native; no account or network required
- 🌐 **PWA-ready** — installable from any browser including iOS Safari, service worker caching, Netlify deploy

---

## 🗂️ Project Structure

```
music-log/
├── App.js                          # Root: font loading, navigation, SW registration
├── app.json                        # Expo config + PWA metadata
├── netlify.toml                    # Netlify build config
├── patch-dist.js                   # Post-build patch for PWA routing
├── web/
│   ├── index.html                  # HTML template with Apple touch icon tags
│   └── service-worker.js           # Cache-first service worker
├── assets/
│   ├── icon.png                    # App icon (1024×1024)
│   ├── adaptive-icon.png           # Android adaptive icon
│   ├── splash-icon.png             # Splash screen
│   ├── favicon.png                 # Web favicon
│   └── apple-touch-icon*.png       # iOS PWA home screen icons
└── src/
    ├── constants.js                # Tag lists, keys, grades, status options
    ├── utils.js                    # uid(), fmtDate(), confirmDelete()
    ├── theme/
    │   └── index.js                # Colour tokens, radius, sizes
    ├── db/
    │   ├── index.js                # SQLite (native) + IndexedDB (web) data layer
    │   └── hooks.js                # useSessions, useCompositions, useLessons
    ├── components/
    │   ├── Background.js           # Dot-grid SVG background
    │   ├── UI.js                   # GlassCard, Btn, SectionTitle, StatusPill, etc.
    │   ├── Form.js                 # TextF, NumberF, SelectF, DatePickerF, ZeldaBar
    │   ├── FAB.js                  # Shared floating action button (practice + lesson)
    │   ├── Sidebar.js              # Desktop sidebar navigation
    │   ├── SegmentEditor.js        # Technique / repertoire segment editor
    │   ├── LogModal.js             # Session log form (pageSheet modal or inline)
    │   ├── LessonModal.js          # Lesson log form (pageSheet modal or inline)
    │   ├── SessionDetailModal.js   # Session detail with export + delete (mobile)
    │   └── LessonDetailModal.js    # Lesson detail with export + delete (mobile)
    ├── screens/
    │   ├── HomeScreen.js           # Journal feed + today summary + FAB
    │   ├── CalendarScreen.js       # Monthly calendar with day-detail panel
    │   ├── HistoryScreen.js        # Full chronological session + lesson feed
    │   ├── CompositionsScreen.js   # Composition library with full template
    │   ├── StatsScreen.js          # Overview stats, charts, library breakdown
    │   ├── SettingsScreen.js       # App settings
    │   ├── AboutScreen.js          # About screen
    │   ├── OnboardingScreen.js     # First-run onboarding
    │   └── LogScreen.js            # Standalone log screen (mobile)
    └── utils/
        └── export.js               # JSON export: Blob (web) / share sheet (native)
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
# Web (PWA dev server)
npx expo start --web

# iOS simulator
npx expo run:ios

# Android emulator
npx expo run:android
```

### Build and deploy (PWA)

```bash
npm run build:web      # outputs to dist/
npx serve dist         # preview locally
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
| `react-native-svg` | ~15 | Circle of fifths, charts, dot-grid background |
| `@expo/vector-icons` | ~14 | Ionicons used throughout UI |
| `@react-navigation/bottom-tabs` | ^7 | Tab bar navigation |
| `@react-native-picker/picker` | ~2.11 | Native select inputs |
| `@expo-google-fonts/cormorant-garamond` | ~0.3 | Serif display font |
| `@expo-google-fonts/lato` | ~0.3 | Body and UI font |

---

## 👥 Authors

| Role | Name |
|------|------|
| Developer | Lucas França |

---

## 📄 Licence

Released under the [MIT License](./LICENSE).

Copyright © Lucas França, 2026
