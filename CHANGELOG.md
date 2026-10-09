# Changelog

All notable changes to music.log are documented here.

## [Unreleased]

### Added
- **Themes**: Light, Dark, or follow the device, chosen in Settings → Appearance and remembered across launches (AsyncStorage, so it works on web and native). Themes live in a registry (`THEMES` in `src/theme/index.js`), so adding another colour theme is one palette entry and it shows up in the picker automatically. Components read colours through `COLOURS`, with `COLOURS.w()` / `navyA()` / `steelA()` for the frosted-white and teal tints, `blurTint` for `BlurView`s, and `float` / `sheet` for near-opaque floating chrome and bottom sheets. Styles built once at import time use the new `live()` helper so they follow a theme change. Switching themes remounts the visual tree and returns you to Settings; data hooks and onboarding state stay mounted.
- **Drag to reorder**: each segment in the session log, lesson log and timer setup has a grip handle. Drag it and the other cards slide out of the way, a dashed slot shows where the card will land, and the page auto-scrolls near the screen edge. Haptic ticks on native. Built on `PanResponder`/`Animated`, so no new dependency and no native rebuild. The slot/shift maths is pure (`src/utils/reorder.js`) and unit-testable in plain Node.
- **Swipe left to delete** segment cards, History entries and library pieces, by swiping most of the way across or tapping the revealed button. The first swipeable row peeks open once to teach the gesture (remembered across launches on web; per session on native, where the prefs helper has no storage). The timer setup only enables it on collapsed rows, since the expanded ones contain a drag dial.
- **Undo instead of confirm dialogs.** Deleting a session, lesson or piece hides it at once and shows an Undo toast; the real delete runs 5 seconds later unless undone, and is committed immediately if the tab closes or the app goes to the background. Removing a segment from a form shows the same toast and Undo restores it in its original position. Every delete path (swipe, in-card Delete buttons, the detail modals, the desktop side panel) goes through one app-level handler in `App.js`.
- **Unsaved-changes guard** on Cancel / Android back for the session log, lesson log and timer setup. Only asks when the form differs from the values it loaded with (timer setup: when it has any segments).
- **Repeat last session**: an empty session log offers to copy the previous session's segments and duration, with notes, feedback, ratings, challenge and progress tags cleared.
- **History search and filter**: search across piece names, technique groups, notes, feedback, wins, teacher and dates; filter to All / Practice / Lessons.
- **Activity heatmap days are tappable**, showing that day's sessions, minutes and pieces, with ◀ ▶ buttons to step a day at a time (the cells are 10–14px, so the steppers do the fine aiming). The next-year button now stays in place, dimmed, when you're on the current year.
- The active tab in the floating nav pill shows its name under the icon.
- Accessibility roles and labels on the tabs, FAB, metronome play and tempo buttons, year/month/day steppers, star ratings, the About close button and the theme picker.
- **Articulation on technique segments**: record how an exercise was played — legato, non-legato, staccato, staccatissimo, portato, tenuto or accented — per hand. One tap sets both hands; "Hands separately" splits it into right and left rows for exercises where the hands get different touches (e.g. RH legato · LH staccato). Tapping the active option clears it, and the picker is hidden for Sight-reading. Stored as `segment.articulation = { rh, lh }`; segments logged before this existed simply have none, so no data migration was needed, and it syncs to Supabase without a schema change since segments are already stored as JSON.
- Articulation can be chosen when setting up a practice timer segment, is shown under the segment title on the countdown screen, and is carried into the log form when the session finishes.
- Articulation is shown on technique segments in the session and lesson detail modals, the desktop Home detail panel, the History feed, and the desktop Calendar day panel.
- **Stats → Technique groups** can be filtered by articulation. The filter pills only appear once something has been logged with an articulation, offer only articulations present in the selected period, and match a segment if either hand uses the chosen one. The scale-coverage circle of fifths is unaffected.
- **Manual tempo (BPM) on technique segments**: an optional clean-tempo field beside the minutes box, shown in the same detail views as articulation. Entered by hand after practising rather than captured from the metronome, since the metronome's setting is often not the tempo you actually held. Pairs with logging legato and staccato versions of the same exercise as separate segments, so each keeps its own tempo.
- JSON export includes each segment's `articulation` and `tempo_bpm`; import reads them back.

### Changed
- **Touch targets are now at least 44pt** across the app. Pills keep their glass look at a 36pt minimum height with 4pt of vertical hit slop (`TOUCH_PILL` / `HIT_PILL`), glyph buttons are 36pt boxes with slop (`TOUCH_ICON` / `HIT_ICON`), bare text buttons such as Cancel / Done / Edit and the "clear" links get generous slop (`HIT_TEXT`), and `hitFor()` pads fixed-size controls. Star ratings are about 44pt wide each; the metronome's play, −/+ and time-signature controls are 40–44pt; Timeline rows are 44pt; the tab bar icons are 44pt.
- **Text is larger.** Every size under 13 moved up one step (9 and 10 → 11, 11 → 12, 12 → 13), the `SIZES.label` / `labelSmall` / `tiny` tokens went up by one, Stats chart axis and value labels went from 7–8px to 10–12px, and the circle of fifths' labels are roughly a third bigger. Heatmap month labels are no longer as small as 7px.
- **Higher-contrast secondary text**: `COLOURS.textDim` went from `#7AB2B2` (about 2.1:1 on the page background) to `#3A767C` (about 4.6:1).
- **Deleting no longer asks "are you sure?"** — it's undoable instead (see Added). The Remove button inside an open library card, and the Delete buttons in detail modals and the desktop panel, behave the same way.
- Segment cards drop the ↑ / ↓ / ✕ buttons in favour of a drag handle and swipe-to-delete; an expanded card has a visible "Remove segment" button so deletion doesn't depend on discovering the swipe. In the timer setup, tapping a collapsed segment edits it.
- The activity heatmap wraps its months into rows (2×6, 3×4 or 4×3) on narrow screens instead of shrinking to unreadable cells.
- History is a virtualised list rather than a `ScrollView` that renders every entry.
- The year chevrons on the heatmap are 24px icons in 48pt buttons instead of 14px glyphs.

### Fixed
- The activity heatmap showed each day's activity one day early between March and October (British Summer Time): dates were built at local midnight and then converted with `toISOString()`, which is UTC. Added `localISO()` to `utils.js`; `todayISO()` now uses it.
- `HistoryScreen` called a hook after an early return, which breaks as soon as the log goes from empty to having an entry.
- JSON import no longer drops or mislabels segment data. Segment durations (`duration_minutes`) were ignored entirely; felt difficulty was stored as `difficulty` rather than `feltDifficulty`, and progress tags as `progressTags` rather than `progress`, so none of them showed up in the editor, Stats, or composition-status derivation. Files imported before this fix keep the old keys.
- Lesson teacher feedback was always exported as `null` because export read `teacherFeedback` while the editor writes `feedback`. It now exports (and re-imports) correctly.

## [1.1.0] — 2026-09-28

### Added
- **Practice timer**: pomodoro-style segmented sessions. Build a plan of technique/repertoire segments in a setup screen, each with its own drag-to-set minutes dial and reorderable with ↑/↓; confirm and collapse each entry as you finish setting it up, so reviewing a multi-segment plan doesn't mean scrolling past every picker and dial again; then run through the plan with a countdown ring, pause/skip/+5-minute controls, and automatic session logging with real elapsed time when you finish.
- **Metronome**, built into the timer screen: beat indicator, adjustable tempo (tap ±5bpm / hold for repeating ±1bpm, named tempo markings from Largo to Presto), time signatures 2/4 through 12/8 (compound meters felt in their conventional main pulses — 6/8 as 2, 12/8 as 4 — rather than one dot per numerator), quarter-through-16th-note subdivisions, a "use piece tempo" shortcut that reads a linked library piece's stored tempo/time signature, and an optional tempo ramp (auto-increases bpm toward a target every N bars, for bringing a hard passage up to speed).
- Composition library entries can now store a reference tempo (bpm), feeding the metronome's "use piece tempo".
- **Optional Supabase sync**: push/pull practice sessions, lessons, and compositions to a Supabase project of your own, with GitHub or magic-link sign-in. Off by default; nothing leaves the device until it's configured in Settings. Settings now shows a last-synced timestamp or sync-error message instead of a static label.
- Floating pill nav bar with scroll-aware collapse (replaces the old fixed bottom tab bar).

### Fixed
- Supabase credentials and session now persist correctly on the native app. They previously relied on `localStorage`, which doesn't exist in the React Native runtime — sync silently never worked on native as a result, and saving credentials there would have thrown outright.
- Metronome audio no longer glitches or drifts, including at tempos that don't divide evenly into other timers running on screen at the same time. The audio engine's own clock (via `react-native-audio-api`) now handles playback timing directly, rather than JS `setTimeout`, which isn't precise enough for this on its own.
- Metronome plays correctly on iPhone: unlocks on the very first tap (previously needed the audio context to resume synchronously inside the gesture, not after a state update), and plays through the hardware mute switch (iOS treats Web Audio as a "ringtone" category by default). It also now resumes correctly if the app is backgrounded (screen lock, app switch) mid-session, rather than staying silently suspended.
- The countdown timer screen no longer periodically re-renders on an unrelated 250ms display-refresh tick, which was occasionally colliding with the metronome's own scheduling.
- "Add piece" button on the Pieces screen no longer sits under the floating nav pill (web); the same fix for the shared FAB no longer incorrectly applies on desktop, which doesn't have the pill at all.
- Segment-setup minutes dial's drag handle no longer clips at the edge of its container.
- Finishing a timed practice session now correctly carries the selected technique group into the log form (it was being written to the wrong field, so the technique-group pill showed nothing selected and saving without noticing dropped it from the record). A one-time, flag-guarded migration backfills any sessions logged before this fix.
- The timer's technique segments now show a linked library piece's title (previously only showed the technique group name), both on the countdown screen and in the setup screen's collapsed summary.
- Stats charts (practice volume, weekly trends, library growth) no longer cram overlapping x-axis date labels once there's enough history (e.g. 'All time') — label density now adapts to the chart's actual rendered width instead of a fixed step.

### Changed
- Countdown timer screen restyled to match the app's glass design language.
- Segment-setup minutes dial's progress ring now uses a stepped opacity sweep along its arc instead of a flat colour.
- `dialFeedback.js`'s native tick sound migrated from `expo-audio` to `react-native-audio-api` (the same engine the metronome uses), consolidating onto one audio library. `expo-audio` has been removed as a dependency.
