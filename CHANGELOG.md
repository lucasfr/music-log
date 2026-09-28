# Changelog

All notable changes to music.log are documented here.

## [1.1.0] — 2026-09-28

### Added
- **Practice timer**: pomodoro-style segmented sessions. Build a plan of technique/repertoire segments in a setup screen, each with its own drag-to-set minutes dial; confirm and collapse each entry as you finish setting it up, so reviewing a multi-segment plan doesn't mean scrolling past every picker and dial again; then run through the plan with a countdown ring, pause/skip/+5-minute controls, and automatic session logging with real elapsed time when you finish.
- **Metronome**, built into the timer screen: beat indicator, adjustable tempo (tap ±5bpm / hold for repeating ±1bpm, named tempo markings from Largo to Presto), time signatures 2/4 through 12/8 (compound meters felt in their conventional main pulses — 6/8 as 2, 12/8 as 4 — rather than one dot per numerator), quarter-through-16th-note subdivisions, and a "use piece tempo" shortcut that reads a linked library piece's stored tempo/time signature.
- Composition library entries can now store a reference tempo (bpm), feeding the metronome's "use piece tempo".
- **Optional Supabase sync**: push/pull practice sessions, lessons, and compositions to a Supabase project of your own, with GitHub or magic-link sign-in. Off by default; nothing leaves the device until it's configured in Settings.
- Floating pill nav bar with scroll-aware collapse (replaces the old fixed bottom tab bar).

### Fixed
- Supabase credentials and session now persist correctly on the native app. They previously relied on `localStorage`, which doesn't exist in the React Native runtime — sync silently never worked on native as a result, and saving credentials there would have thrown outright.
- Metronome audio no longer glitches or drifts, including at tempos that don't divide evenly into other timers running on screen at the same time. The audio engine's own clock (via `react-native-audio-api`) now handles playback timing directly, rather than JS `setTimeout`, which isn't precise enough for this on its own.
- Metronome plays correctly on iPhone: unlocks on the very first tap (previously needed the audio context to resume synchronously inside the gesture, not after a state update), and plays through the hardware mute switch (iOS treats Web Audio as a "ringtone" category by default).
- The countdown timer screen no longer periodically re-renders on an unrelated 250ms display-refresh tick, which was occasionally colliding with the metronome's own scheduling.
- "Add piece" button on the Pieces screen no longer sits under the floating nav pill (web).
- Segment-setup minutes dial's drag handle no longer clips at the edge of its container.

### Changed
- Countdown timer screen restyled to match the app's glass design language.
- Segment-setup minutes dial's progress ring now uses a stepped opacity sweep along its arc instead of a flat colour.
