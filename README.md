# 🎹 music.log

**A structured practice journal for adult piano learners — log sessions, track repertoire, and review progress as a PWA or native app.**

[![Built with Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)](https://music-log.netlify.app)
[![Version](https://img.shields.io/badge/version-1.1.0-088395)](./CHANGELOG.md)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## 📖 What is music.log?

music.log is a practice journal built for adult piano learners. It replaces free-text notes with structured session logs — segmented by technique work and repertoire, tagged with challenges and progress markers, and linked to a composition library that tracks status, grade, teacher notes, and full session history per piece.

It runs as an installable PWA in any browser and as a native iOS/Android app via Expo. All data is stored locally — IndexedDB on web, SQLite on native — with no account required by default; optional Supabase sync is available for keeping data in step across devices.

---

## ✨ Features

- 🏠 **Home** — today's session card and a scrollable journal feed; tap any entry to open a full detail panel (inline on desktop, modal on mobile)
- 📅 **Calendar** — monthly grid with practice and lesson markers, month stats (sessions, lessons, minutes, avg energy), streak counter, and a day-detail panel on desktop
- 📖 **History** — chronological feed of all sessions and lessons, fully expanded inline with complete segment detail, wins, and next-focus notes; search across piece names, notes, wins and dates, filter to practice or lessons, and swipe an entry left to delete it (virtualised, so it stays smooth as the log grows)
- 🎓 **Lessons** — log lessons separately with teacher, duration, per-piece feedback, assignments, overall notes, wins, and focus for next time
- ⏱️ **Practice timer** — pomodoro-style segmented sessions: build a plan of technique/repertoire segments (each with its own minutes dial, drag its grip to reorder it, swipe a collapsed one left to remove it), confirm and collapse each one as you set it up, then run through them with a countdown ring, pause/skip/+5min controls, an optional articulation per technique segment (shown on the countdown screen and carried into the log form), and automatic session logging when you finish
- 🥁 **Metronome** — built into the timer screen: adjustable tempo (tap ±5 / hold ±1, named tempo markings from Largo to Presto), time signatures from 2/4 to 12/8 (compound meters felt in their conventional main pulses, not literal numerator), quarter-through-16th-note subdivisions, a "use piece tempo" shortcut that reads a linked library piece's stored tempo/time signature, and an optional tempo ramp (auto-increases bpm toward a target every N bars — useful for bringing a hard passage up to speed). Runs on a real audio-engine clock (react-native-audio-api) rather than JS timers, for steady timing independent of anything else happening in the app, and resumes correctly if the app is backgrounded mid-session
- 🔄 **Optional cloud sync** — push/pull sessions, lessons, and compositions to a Supabase project of your own, with GitHub or magic-link sign-in; works the same on web and native, with a last-synced / sync-error indicator in Settings
- 🎼 **Segment logging** — sessions split into technique segments (Hanon, Scales, Arpeggios, Chord work, Sight-reading, Technical exercise) and repertoire segments, each with notes, felt difficulty, challenge tags, and progress tags
- 🎹 **Scale & arpeggio detail tracking** — scales/arpeggios tracked individually with parallel/contrary motion, unison/3rds/6ths/10ths interval apart, and 1–4 octaves per entry, backward-compatible with older plain-string entries. Catalogue covers major/natural/harmonic/melodic minor, modes, pentatonic, chromatic (all 12 keys), whole tone, diminished, augmented, blues, and dominant/diminished 7th arpeggios (all 12 keys)
- 🎚️ **Articulation & tempo** — technique segments can record how an exercise was played: legato, non-legato, staccato, staccatissimo, portato, tenuto or accented, set once for both hands or separately for right and left (e.g. RH legato · LH staccato), plus an optional clean-tempo BPM entered by hand. Log legato and staccato versions of the same exercise as separate segments so each keeps its own tempo. Articulation can be set in the timer setup, is shown on the countdown screen, and appears in every detail view, the Stats technique filter, and the JSON export
- 🗂️ **Composition library** — per-piece tracking of status, 🎹 difficulty, keys, time signatures, grade, arrangement, collection, year, tags, dates, teacher notes, study notes, and session history
- ⚡ **Zelda-style rating bars** — energy (⚡) and enjoyment (❤️) per session; felt difficulty (🎵) and liking (⭐) per segment; all rated by tap or hold-and-slide
- 📊 **Stats** — period-aware overview (6 tiles: practice time, sessions, lessons, streak, avg energy ⚡, avg enjoyment ❤️); activity grid (full year, lesson markers, Both/Practice/Lessons toggle that remembers your last choice; tap a day to see what you did, then step ◀ ▶ a day at a time — the cells are small, so the steppers do the fine aiming; months wrap into rows on phones so cells stay tappable); weekly trends + session quality scatter; technique group breakdown with time, count and difficulty (filterable by articulation); interactive circle of fifths (major/minor rings, tap for per-key stats, filterable by motion, octave count 1–4, and interval unison/3rds/6ths/10ths); library status tiles; library growth chart + streak history; most-practised pieces with session and piece-level Zelda bars; wins timeline — all half-half glass cards on desktop
- 🗓️ **Timeline** — Gantt-style view of the composition library over time, coloured by status history, with a per-piece detail panel (stage history, sessions, time logged) and status filters
- 🖥️ **Desktop two-column layout** — sidebar navigation, inline log forms and detail panels, no modals
- 🌗 **Themes** — Light, Dark, or follow the device (Settings → Appearance); the choice is remembered, and new colour themes are a single entry in the theme registry (see [Theming](#-theming))
- 👆 **Touch-first editing** — segments reorder by dragging a grip handle (the page auto-scrolls near the screen edge, with a dashed landing slot and haptic ticks), and swipe left to delete segments, History entries and library pieces; the first swipeable row nudges itself open once to show the gesture
- ↩️ **Undo instead of "are you sure?"** — deleting a session, lesson or piece hides it immediately and shows an Undo toast for 5 seconds before it's really deleted (it is committed if you close the tab or background the app first); removing a segment from a form can be undone and restores it in the same position
- 🛡️ **Unsaved-changes guard** — cancelling the session log, lesson log or timer setup asks before throwing away what you've entered, but only when there's something to lose
- 🔁 **Repeat last session** — an empty session log offers to copy your previous session's plan (pieces, scales, minutes), leaving notes, ratings and tags blank
- ♿ **Built for thumbs and screen readers** — 44pt minimum touch targets, higher-contrast secondary text, no text below 11px (chart labels included), and accessibility labels on icon-only controls
- 📤 **JSON export** — share any session as structured JSON via native share sheet or browser download, including each segment's articulation and tempo
- 💾 **Offline-first** — IndexedDB on web, expo-sqlite on native; works fully without an account or network, with sync as an opt-in extra
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
    ├── constants.js                # Tag lists, keys, grades, status options, scale/interval/octave/articulation catalogues
    ├── utils.js                    # uid(), fmtDate(), localISO()/todayISO(), confirmDelete()/confirmDiscard(), latestSession(), scale motion/octave/interval helpers, articulation/tempo formatters, local prefs
    ├── theme/
    │   ├── index.js                # Palettes (light/dark), THEMES registry, applyTheme(), live(), colour/radius/size/touch-target tokens
    │   └── ThemeContext.js         # ThemeProvider/useTheme: persisted choice (System/Light/Dark), applies the theme before first paint
    ├── context/
    │   └── NavScrollContext.js     # Scroll-aware collapse state for the floating tab pill
    ├── lib/
    │   └── supabase.js             # Supabase client + credential/session storage (AsyncStorage native, localStorage web)
    ├── db/
    │   ├── index.js                # SQLite (native) + IndexedDB (web) data layer
    │   ├── hooks.js                # useSessions, useCompositions, useLessons — local save/load + auto push/pull sync
    │   ├── sync.js                 # Supabase push/pull/merge — safe no-ops when not signed in
    │   ├── syncStatus.js           # Pub-sub for push/pull outcomes, feeds the Settings sync indicator
    │   └── migrations.js           # One-time, flag-guarded data fixes (e.g. technique-group backfill)
    ├── components/
    │   ├── Background.js           # Dot-grid SVG background
    │   ├── UI.js                   # GlassCard, Btn, SectionTitle, StatusPill, etc.
    │   ├── Form.js                 # TextF, NumberF, SelectF, DatePickerF, ZeldaBar
    │   ├── Gestures.js             # SwipeRow (swipe-left delete), ReorderList + DragHandle (drag to reorder, auto-scroll) — plain PanResponder/Animated, no extra deps
    │   ├── Undo.js                 # UndoToast, useUndoToast (undo a local change), useUndoableDelete (deferred real deletes)
    │   ├── FAB.js                  # Shared floating action button (practice + lesson + timer)
    │   ├── CustomTabBar.js         # Floating pill nav bar with scroll-aware collapse
    │   ├── Sidebar.js              # Desktop sidebar navigation
    │   ├── SegmentEditor.js        # Technique / repertoire segment editor (incl. articulation picker and BPM field)
    │   ├── LogModal.js             # Session log form (pageSheet modal or inline)
    │   ├── LessonModal.js          # Lesson log form (pageSheet modal or inline)
    │   ├── SessionDetailModal.js   # Session detail with export + delete (mobile)
    │   ├── LessonDetailModal.js    # Lesson detail with export + delete (mobile)
    │   ├── TimerSetupModal.js      # Build a practice-timer plan: add/confirm/collapse segments
    │   ├── PracticeTimerScreen.js  # Countdown ring, pause/skip/+5min, metronome toggle
    │   ├── MetronomeControl.js     # Tempo/time-sig/subdivision metronome, audio-engine-clock scheduling
    │   └── MinutesDial.js          # Drag-to-set minutes dial used in the timer setup segments
    ├── screens/
    │   ├── HomeScreen.js           # Journal feed + today summary + FAB
    │   ├── CalendarScreen.js       # Monthly calendar with day-detail panel
    │   ├── HistoryScreen.js        # Full chronological session + lesson feed
    │   ├── CompositionsScreen.js   # Composition library with full template
    │   ├── StatsScreen.js          # Overview stats, charts, library breakdown
    │   ├── TimelineScreen.js       # Gantt-style composition timeline with status history
    │   ├── SettingsScreen.js       # App settings + Supabase sync setup/sign-in
    │   ├── AboutScreen.js          # About screen
    │   ├── OnboardingScreen.js     # First-run onboarding
    │   └── LogScreen.js            # Standalone log screen (mobile)
    └── utils/
        ├── reorder.js               # Pure drag-to-reorder maths (which slot, how far others shift) — unit-testable in plain Node
        ├── useDirtyGuard.js         # Tracks unsaved changes in a form against the values it loaded with
        ├── export.js                # JSON export: Blob (web) / share sheet (native)
        ├── usePracticeTimer.js      # Segment timer engine: real-timestamp elapsed time, subscribeTick display hook
        ├── metronomeSounds.js       # Embedded click samples + base64→ArrayBuffer decode (shared by the metronome and the dial tick)
        ├── chime.js                 # Segment-end / session-end chime
        ├── dialFeedback.js           # Haptic + tick sound for the minutes dial (react-native-audio-api on native, Web Audio on web)
        ├── dialTickSound.js          # Embedded tick sample for the minutes dial
        ├── useKeepAwake.js           # Keeps the screen on while the timer is running
        └── segmentNotifications.js   # Local notification when a segment ends (native)
```

---

## 🎨 Theming

Colours come from one shared object, `COLOURS` in `src/theme/index.js`. A theme is a palette that `applyTheme()` copies over it, so every component that reads `COLOURS.something` follows the active theme.

**Add a colour theme** — add an entry to `THEMES` (spread `LIGHT` or `DARK` and override what you want):

```js
const SEPIA = { ...LIGHT, bg: '#F4ECD8', text: '#4A3B2A', /* … */ };
export const THEMES = {
  light: { label: 'Light', colours: LIGHT },
  dark:  { label: 'Dark',  colours: DARK  },
  sepia: { label: 'Sepia', colours: SEPIA },
};
```

It then appears in **Settings → Appearance** automatically. A palette also supplies a few helpers and flags: `w(a)`, `navyA(a)` and `steelA(a)` (frosted-white, navy and teal tints at an alpha), `blurTint`, `statusBar`, `float` (near-opaque floating chrome) and `sheet` (bottom sheets).

**Rules for new UI**
- Don't hardcode `rgba(255,255,255,…)`, `rgba(9,99,126,…)` or `rgba(8,131,149,…)` — use `COLOURS.w()`, `COLOURS.navyA()` and `COLOURS.steelA()`.
- Use `tint={COLOURS.blurTint}` on every `BlurView`.
- A `StyleSheet.create` or shared style object at module scope is built once at import, so it would keep the startup theme. Wrap it in `live(() => …)` from `src/theme`.
- Switching themes remounts the visual tree (data hooks stay mounted), so there's no per-component subscription to manage.

---

## 🧭 Design Conventions

- **Touch targets:** at least 44pt. Pills keep the glass look at a 36pt minimum height (`TOUCH_PILL`) with 4pt of vertical hit slop (`HIT_PILL`); small glyph buttons use `TOUCH_ICON`/`HIT_ICON`; bare text buttons use `HIT_TEXT`; `hitFor(w, h)` pads a fixed-size control out to 44.
- **Text size:** use the `SIZES` tokens; avoid anything under 11px. Secondary text uses `COLOURS.textDim`, which is tuned to ≥4.5:1 contrast on the page background — don't lighten it.
- **Deleting:** call the `onDelete`/`onDeleteLesson` props and don't add a confirm dialog — `App.js` makes every delete undoable (hide now, delete after the undo window). For removing something from an in-progress form, use `useUndoToast` and restore it on Undo.
- **Lists you can edit:** `ReorderList` + `SwipeRow` + `DragHandle` from `components/Gestures.js`. Disable the parent `ScrollView` while dragging (`onDragChange`) and pass `scrollRef`/`scrollOffset` so it can auto-scroll.
- **Unsaved changes:** forms use `useDirtyGuard` and `confirmDiscard`, calling `guard.markReset()` at the end of the effect that loads their initial values.
- **Dates:** use `localISO()`/`todayISO()` from `utils.js`. `toISOString()` converts to UTC, which shifts a local-midnight date back a day in summer time.

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

### Optional: cloud sync

music.log works fully offline with no setup. To sync across devices, create a free [Supabase](https://supabase.com) project, then enter its Project URL and anon key in **Settings → Sync** and sign in (GitHub or email magic link). Nothing is sent anywhere until you do this.

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
| `expo-haptics` | ~15 | Haptic feedback on the metronome, minutes dial and drag-to-reorder |
| `expo-keep-awake` | ~15 | Keeps the screen on during a practice timer session |
| `expo-notifications` | ~0.32 | Local notification when a segment ends (native) |
| `react-native-audio-api` | ^0.13 | Metronome's audio-engine-clock scheduling (real Web Audio API on native + web) |
| `react-native-web` | ~0.20 | Web render target |
| `react-native-svg` | ~15 | Circle of fifths, charts, dot-grid background, metronome/dial rings |
| `@expo/vector-icons` | ~14 | Ionicons used throughout UI |
| `@react-navigation/bottom-tabs` | ^7 | Tab bar navigation |
| `@react-native-picker/picker` | ~2.11 | Native select inputs |
| `@react-native-async-storage/async-storage` | ^2.2 | Supabase credential/session storage and the saved theme choice |
| `@supabase/supabase-js` | ^2 | Optional cloud sync client |
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
