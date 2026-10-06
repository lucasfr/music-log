# Changelog

All notable changes to music.log are documented here.

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
