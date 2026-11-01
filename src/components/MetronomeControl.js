import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated, AppState } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Ellipse, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { AudioContext } from 'react-native-audio-api';
import { COLOURS, RADIUS, SIZES, hitFor, TOUCH_ICON, HIT_ICON } from '../theme';
import { ACCENT_CLICK_B64, SUB_CLICK_B64, base64ToArrayBuffer } from '../utils/metronomeSounds';
import { addTap, bpmFromTaps } from '../utils/tapTempo';
import { isSilentStep, nextBars, describeSilentBars } from '../utils/silentBars';
import { allStrong, firstOnly, halfBar, fitPattern, cycleBeat, beatSound, isDefault, describePattern, STRONG, WEAK, MUTE } from '../utils/beatPattern';
import { openSpots, spotLabel, nextSpotTempo } from '../utils/insights';
import { emptyReps, recordRep, readyToStep, describeReps, REPS_TO_STEP } from '../utils/cleanReps';
import { pieceMetronomeDefaults } from '../utils/pieceTempo';
import { Ionicons } from './Icon';
import { FadeInUp } from './Motion';

// Compound meters are conventionally felt in fewer main pulses than their
// numerator — 6/8 as 2 (each a dotted quarter), 12/8 as 4 — rather than
// one dot per eighth note, which would look busy and doesn't match how a
// pianist actually feels the beat.
const COMPOUND_MAIN_BEATS = { '6/8': 2, '12/8': 4 };

const PRIMARY_SIGS = ['2/4', '3/4', '4/4'];
const MORE_SIGS = ['6/8', '5/4', '7/8', '12/8'];

const TEMPO_PRESETS = [
  { name: 'Largo', range: '40–60', value: 50 },
  { name: 'Adagio', range: '60–76', value: 68 },
  { name: 'Andante', range: '76–108', value: 92 },
  { name: 'Moderato', range: '108–120', value: 114 },
  { name: 'Allegro', range: '120–156', value: 138 },
  { name: 'Presto', range: '156–208', value: 176 },
];

function tempoName(v) {
  if (v < 60) return 'Largo';
  if (v < 76) return 'Adagio';
  if (v < 108) return 'Andante';
  if (v < 120) return 'Moderato';
  if (v < 156) return 'Allegro';
  return 'Presto';
}

function parseSig(sig) {
  const [num, den] = (sig || '4/4').split('/').map(Number);
  return { num: num || 4, den: den || 4 };
}

function mainBeatsFor(sig) {
  return COMPOUND_MAIN_BEATS[sig] || parseSig(sig).num;
}

// Simple monochrome note glyphs, matching how they'd actually be engraved —
// drawn as plain shapes rather than Unicode music dingbats, which render as
// full-colour emoji on iOS and would look inconsistent against everything
// else in the app.
function NoteIcon({ sub, color }) {
  const stroke = color;
  if (sub === 1) {
    return (
      <Svg width={22} height={18} viewBox="0 0 40 30">
        <Ellipse cx={10} cy={22} rx={4.2} ry={3.2} fill={stroke} />
        <Line x1={14} y1={22} x2={14} y2={4} stroke={stroke} strokeWidth={2} />
      </Svg>
    );
  }
  if (sub === 2) {
    return (
      <Svg width={26} height={18} viewBox="0 0 40 30">
        <Ellipse cx={8} cy={22} rx={4} ry={3} fill={stroke} />
        <Ellipse cx={24} cy={22} rx={4} ry={3} fill={stroke} />
        <Line x1={12} y1={22} x2={12} y2={6} stroke={stroke} strokeWidth={2} />
        <Line x1={28} y1={22} x2={28} y2={6} stroke={stroke} strokeWidth={2} />
        <Line x1={12} y1={6} x2={28} y2={6} stroke={stroke} strokeWidth={3} />
      </Svg>
    );
  }
  if (sub === 3) {
    return (
      <Svg width={30} height={18} viewBox="0 0 40 30">
        <SvgText x={21} y={5} fontSize={9} textAnchor="middle" fill={stroke} fontStyle="italic">3</SvgText>
        <Ellipse cx={6} cy={23} rx={3.2} ry={2.6} fill={stroke} />
        <Ellipse cx={18} cy={23} rx={3.2} ry={2.6} fill={stroke} />
        <Ellipse cx={30} cy={23} rx={3.2} ry={2.6} fill={stroke} />
        <Line x1={9} y1={23} x2={9} y2={8} stroke={stroke} strokeWidth={2} />
        <Line x1={21} y1={23} x2={21} y2={8} stroke={stroke} strokeWidth={2} />
        <Line x1={33} y1={23} x2={33} y2={8} stroke={stroke} strokeWidth={2} />
        <Line x1={9} y1={8} x2={33} y2={8} stroke={stroke} strokeWidth={3} />
      </Svg>
    );
  }
  return (
    <Svg width={34} height={18} viewBox="0 0 40 30">
      <Ellipse cx={5} cy={23} rx={3} ry={2.4} fill={stroke} />
      <Ellipse cx={15} cy={23} rx={3} ry={2.4} fill={stroke} />
      <Ellipse cx={25} cy={23} rx={3} ry={2.4} fill={stroke} />
      <Ellipse cx={35} cy={23} rx={3} ry={2.4} fill={stroke} />
      <Line x1={8} y1={23} x2={8} y2={6} stroke={stroke} strokeWidth={2} />
      <Line x1={18} y1={23} x2={18} y2={6} stroke={stroke} strokeWidth={2} />
      <Line x1={28} y1={23} x2={28} y2={6} stroke={stroke} strokeWidth={2} />
      <Line x1={38} y1={23} x2={38} y2={6} stroke={stroke} strokeWidth={2} />
      <Line x1={8} y1={6} x2={38} y2={6} stroke={stroke} strokeWidth={2.5} />
      <Line x1={8} y1={10} x2={38} y2={10} stroke={stroke} strokeWidth={2.5} />
    </Svg>
  );
}

// Isolated on purpose: this is the only piece of the metronome that
// changes continuously while playing. The parent's rAF loop below detects
// *when* the active beat changes by polling elapsed time (fully decoupled
// from the audio scheduler) and calls pulse() once per change; the actual
// fade itself runs via a native-driver Animated.timing so that once
// started, it keeps animating smoothly on the UI thread even if the JS
// thread hiccups afterward — a plain per-frame setValue() is only ever as
// smooth as the JS thread's ability to fire that exact frame on time.
// Never mix raw .setValue() with native-driven values once they've been
// animated with useNativeDriver — that desyncs them from their native
// counterpart (a real bug from an earlier version of this file). Every
// change here, including instant snaps, goes through Animated.timing.
// Only the previously-lit dot is ever touched on a given pulse, not all
// MAX_DOTS of them — firing native animation starts on slots that were
// already at 0 is wasted native-side work that compounds over a session.
const MAX_DOTS = 8;
const BeatDotsRow = forwardRef(function BeatDotsRow({ mainBeats }, ref) {
  const animsRef = useRef(null);
  const lastIndexRef = useRef(null);
  if (!animsRef.current) {
    animsRef.current = Array.from({ length: MAX_DOTS }, () => new Animated.Value(0));
  }

  useImperativeHandle(ref, () => ({
    pulse(index, flashMs) {
      const prev = lastIndexRef.current;
      if (prev !== null && prev !== index) {
        Animated.timing(animsRef.current[prev], { toValue: 0, duration: 0, useNativeDriver: true }).start();
      }
      lastIndexRef.current = index;
      Animated.sequence([
        Animated.timing(animsRef.current[index], { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(animsRef.current[index], { toValue: 0, duration: flashMs, useNativeDriver: true }),
      ]).start();
    },
    reset() {
      if (lastIndexRef.current !== null) {
        Animated.timing(animsRef.current[lastIndexRef.current], { toValue: 0, duration: 0, useNativeDriver: true }).start();
      }
      lastIndexRef.current = null;
    },
  }));

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
      {Array.from({ length: mainBeats }, (_, i) => (
        <View key={i} style={{ width: 14, height: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.accent2Mid, overflow: 'hidden' }}>
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.pill,
            backgroundColor: COLOURS.amber, opacity: animsRef.current[i],
          }} />
        </View>
      ))}
    </View>
  );
});

function SigChip({ sig, active, onPress }) {
  const [num, den] = sig.split('/');
  const color = active ? COLOURS.onNavy : COLOURS.steel;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.08), alignItems: 'center' }}>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif', fontWeight: '700', fontSize: SIZES.body, color, lineHeight: 17 }}>{num}</Text>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif', fontWeight: '700', fontSize: SIZES.body, color, lineHeight: 17 }}>{den}</Text>
    </TouchableOpacity>
  );
}

// composition: the linked library piece for the current segment, or null.
// Reads composition.tempo (bpm) and composition.timeSigs[0] as defaults —
// falls back to 90bpm / 4/4 if the piece has no stored tempo/time sig yet.
//
// Wrapped in React.memo deliberately: PracticeTimerScreen re-renders every
// 250ms to refresh the countdown ring's remaining-time display, which is
// entirely unrelated to the metronome's own beat scheduling. Without memo,
// every one of those parent re-renders was cascading down and re-rendering
// this whole card (BlurView, every button, every icon) on a schedule that
// had nothing to do with bpm — occasionally colliding with the metronome's
// own tick/animation state and knocking the visuals out of sync with the
// audio, which kept ticking fine underneath since its scheduler lives in a
// ref-held closure unaffected by re-renders.
export const MetronomeControl = React.memo(function MetronomeControl({ composition, compact = false, suggestedBpm = null, bpmRef = null, onSpotChange = null }) {
  // Tempo and time signature of the linked piece (90 bpm and 4/4 when it has none).
  const piece = pieceMetronomeDefaults(composition);
  const defaultBpm = piece.bpm;
  const defaultSig = piece.sig;

  const [bpm, setBpm] = useState(defaultBpm);
  // Lets the practice timer read the tempo (to log it as clean) without re-rendering on every change.
  useEffect(() => { if (bpmRef) bpmRef.current = bpm; }, [bpm, bpmRef]);
  const [sig, setSig] = useState(defaultSig);
  const [subdivision, setSubdivision] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // `compact` (the phone's timer screen) starts with only tempo and play showing; everything
  // else (presets, time signature, subdivision, ramp) opens with one tap.
  const [expanded, setExpanded] = useState(!compact);
  const [audioError, setAudioError] = useState(null);
  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampTarget, setRampTarget] = useState(() => Math.min(240, defaultBpm + 40));
  const [rampEveryBars, setRampEveryBars] = useState(4);
  // Silent bars: click for N bars, then none for N (see utils/silentBars.js). Off by default.
  const [silentEnabled, setSilentEnabled] = useState(false);
  const [silentPlayBars, setSilentPlayBars] = useState(2);
  const [silentQuietBars, setSilentQuietBars] = useState(2);
  // Which main beats of the bar sound strong, weak or not at all (see utils/beatPattern.js). Fitted to the
  // current bar every render, so it stays right when the time signature changes. All strong is the default.
  const [accentPattern, setAccentPattern] = useState([]);
  // Clean goes at the tricky spot being practised (see utils/cleanReps.js). They are added to the spot's totals
  // when you log them or raise the tempo, not on every tap, so a session doesn't save to the piece dozens of times.
  const [activeSpotId, setActiveSpotId] = useState(null);
  const [reps, setReps] = useState(emptyReps());

  // The piece's values can arrive after this card opens (a sync landing mid-session). Follow
  // them, but only for a control that still shows the previous default, so something you've
  // changed by hand is never overwritten.
  const appliedRef = useRef({ bpm: defaultBpm, sig: defaultSig });
  useEffect(() => {
    const prev = appliedRef.current;
    if (prev.bpm !== defaultBpm) setBpm(b => (b === prev.bpm ? defaultBpm : b));
    if (prev.sig !== defaultSig) setSig(s => (s === prev.sig ? defaultSig : s));
    appliedRef.current = { bpm: defaultBpm, sig: defaultSig };
  }, [defaultBpm, defaultSig]);

  const mainBeats = mainBeatsFor(sig);
  const dotsRef = useRef(null);

  const audioCtxRef = useRef(null);
  const buffersRef = useRef({ accent: null, sub: null });
  const readyPromiseRef = useRef(null);
  const schedulerTimerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const stepIndexRef = useRef(0);
  const startTimeRef = useRef(null);
  const scheduledNodesRef = useRef([]);
  const sessionIdRef = useRef(0);
  const rafRef = useRef(null);
  const lastBeatIndexRef = useRef(-1);
  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const barCountRef = useRef(0);
  // Always-fresh mirrors of the ramp settings for the rAF loop below, the
  // same "useLatest" pattern usePracticeTimer uses — the loop's effect only
  // re-runs on [playing, bpm, sig, subdivision, mainBeats], so without this
  // it would read stale ramp settings if they're changed mid-playback.
  const rampEnabledRef = useRef(rampEnabled);
  const rampTargetRef = useRef(rampTarget);
  const rampEveryBarsRef = useRef(rampEveryBars);
  rampEnabledRef.current = rampEnabled;
  rampTargetRef.current = rampTarget;
  rampEveryBarsRef.current = rampEveryBars;
  // The same for the silent-bar settings, so changing them mid-playback applies at once without
  // restarting the click (the scheduler reads these on every click it schedules).
  const silentEnabledRef = useRef(silentEnabled);
  const silentPlayBarsRef = useRef(silentPlayBars);
  const silentQuietBarsRef = useRef(silentQuietBars);
  silentEnabledRef.current = silentEnabled;
  silentPlayBarsRef.current = silentPlayBars;
  silentQuietBarsRef.current = silentQuietBars;
  const pattern = fitPattern(accentPattern, mainBeats);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const LOOKAHEAD_SEC = 0.12;
  const SCHEDULER_INTERVAL_MS = 30;

  // Loads the AudioContext and decodes both click buffers exactly once,
  // reused for the life of this component. decodeAudioData accepts a
  // plain ArrayBuffer directly on both web and native — no filesystem
  // step needed at all, which is what the earlier expo-file-system-based
  // version got wrong (and which fails outright on web, since that API
  // isn't implemented there).
  function ensureAudioReady() {
    if (!readyPromiseRef.current) {
      readyPromiseRef.current = (async () => {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') await ctx.resume();
          const [accent, sub] = await Promise.all([
            ctx.decodeAudioData(base64ToArrayBuffer(ACCENT_CLICK_B64)),
            ctx.decodeAudioData(base64ToArrayBuffer(SUB_CLICK_B64)),
          ]);
          buffersRef.current = { accent, sub };
          return ctx;
        } catch (e) {
          // Surfaced in the UI below rather than failing silently — a
          // rejected promise here previously meant nothing ever scheduled
          // and nothing ever explained why, on both the audio and visual
          // side, since the visual loop also waits on this succeeding.
          console.error('[Metronome] audio init failed:', e);
          setAudioError(String(e?.message || e));
          readyPromiseRef.current = null; // allow retrying on next play press
          throw e;
        }
      })();
    }
    return readyPromiseRef.current;
  }

  // Schedules exactly one click at an absolute AudioContext time — the
  // context's own clock, not Date.now() or setTimeout, handles the actual
  // playback moment. AudioBufferSourceNode is single-use, so a fresh node
  // is created per click; each is tracked so a reset/pause can stop any
  // already-scheduled-but-not-yet-played nodes still sitting in the small
  // lookahead window.
  function scheduleClickAt(ctx, time, stepIndex, currentSubdivision, currentMainBeats) {
    // A silent bar plays nothing, but the beat dots keep moving (they follow the clock, not this).
    if (silentEnabledRef.current && isSilentStep(stepIndex, currentSubdivision * currentMainBeats, silentPlayBarsRef.current, silentQuietBarsRef.current)) return;
    const isMain = stepIndex % currentSubdivision === 0;
    let buffer;
    if (isMain) {
      // The main beats follow the accent pattern: strong and weak are different clicks, a silent beat plays nothing.
      const sound = beatSound(patternRef.current, Math.floor(stepIndex / currentSubdivision) % currentMainBeats);
      if (sound === MUTE) return;
      buffer = sound === WEAK ? buffersRef.current.sub : buffersRef.current.accent;
    } else {
      buffer = buffersRef.current.sub;
    }
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(time);
    scheduledNodesRef.current.push(source);

    if (isMain) {
      const mainTickNumber = Math.floor(stepIndex / currentSubdivision);
      if (mainTickNumber % currentMainBeats === 0) {
        // Haptics can't be scheduled on the audio clock, so it's fired via
        // a plain setTimeout aimed at the right moment instead — haptic
        // timing tolerance is far looser than audio, so the small amount
        // of JS-timer jitter here is genuinely fine, unlike for the click
        // sound itself.
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        setTimeout(() => Haptics.selectionAsync().catch(() => {}), delayMs);
      }
    }
  }

  // Lookahead scheduler (the standard "Tale of Two Clocks" pattern): a
  // coarse setTimeout loop (every 30ms) whose only job is to keep the
  // queue of *scheduled* clicks topped up ~120ms ahead of the audio
  // clock's current time. The actual playback moment for every click is
  // set once, up front, on the audio context's own clock — so once a
  // click is scheduled, nothing the JS thread does afterward (a render, a
  // GC pause, anything) can shift when it actually plays. This is the
  // real fix for the jitter every earlier setTimeout-only attempt in this
  // file couldn't fully remove: the audio engine's clock times the click,
  // not JS.
  async function startAudioScheduler(stepSec, mySessionId, currentSubdivision, currentMainBeats) {
    let ctx;
    try {
      ctx = await ensureAudioReady();
    } catch (e) {
      return; // already logged and surfaced by ensureAudioReady
    }
    if (sessionIdRef.current !== mySessionId) return; // superseded while loading

    startTimeRef.current = ctx.currentTime + 0.05;
    nextNoteTimeRef.current = startTimeRef.current;
    stepIndexRef.current = 0;

    function fillQueue() {
      if (sessionIdRef.current !== mySessionId) return;
      try {
        while (nextNoteTimeRef.current < ctx.currentTime + LOOKAHEAD_SEC) {
          scheduleClickAt(ctx, nextNoteTimeRef.current, stepIndexRef.current, currentSubdivision, currentMainBeats);
          stepIndexRef.current += 1;
          nextNoteTimeRef.current += stepSec;
        }
      } catch (e) {
        console.error('[Metronome] scheduling failed:', e);
        setAudioError(String(e?.message || e));
        return;
      }
      schedulerTimerRef.current = setTimeout(fillQueue, SCHEDULER_INTERVAL_MS);
    }
    fillQueue();
  }

  function stopAudioScheduler() {
    if (schedulerTimerRef.current) clearTimeout(schedulerTimerRef.current);
    schedulerTimerRef.current = null;
    scheduledNodesRef.current.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    scheduledNodesRef.current = [];
  }

  // Visual: an independent rAF polling loop, not triggered by the audio
  // scheduler at all. Every frame it computes "which beat should be active
  // right now" from the SAME audio-context clock the scheduler uses
  // (ctx.currentTime, not Date.now()) — fully decoupled, so a stall on
  // either side can't drag down the other, and both sides agree on
  // exactly the same notion of "now". It only calls pulse() when that
  // beat actually changes (once per beat, not once per frame), handing
  // the fade itself to a native-driver animation that keeps running
  // smoothly on the UI thread regardless of any subsequent JS-thread
  // hiccup.
  useEffect(() => {
    if (!playing) return;
    const stepSec = (60 / bpm) / subdivision;
    const flashMs = Math.min(110, stepSec * 1000 * 0.6);

    function frame() {
      const ctx = audioCtxRef.current;
      if (ctx && startTimeRef.current !== null) {
        const elapsed = Math.max(0, ctx.currentTime - startTimeRef.current);
        const stepIndex = Math.floor(elapsed / stepSec);
        const mainTickNumber = Math.floor(stepIndex / subdivision);
        const beatIndex = ((mainTickNumber % mainBeats) + mainBeats) % mainBeats;
        if (beatIndex !== lastBeatIndexRef.current) {
          const wrappedToStart = beatIndex === 0 && lastBeatIndexRef.current !== -1;
          lastBeatIndexRef.current = beatIndex;
          dotsRef.current?.pulse(beatIndex, flashMs);

          // Tempo ramp: counts completed bars (not ticks) here, in the same
          // clock-driven loop that already detects bar boundaries for the
          // beat dots, rather than adding a second timer. Bumping bpm here
          // feeds back into the settings-reset effect below exactly like a
          // manual bpm change would, restarting the scheduler cleanly at
          // the bar boundary instead of fading the tempo mid-bar.
          if (wrappedToStart && rampEnabledRef.current) {
            barCountRef.current += 1;
            if (barCountRef.current >= rampEveryBarsRef.current) {
              barCountRef.current = 0;
              const target = rampTargetRef.current;
              setBpm(b => {
                if (target > b) return Math.min(target, b + 5);
                if (target < b) return Math.max(target, b - 5);
                return b;
              });
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, bpm, sig, subdivision, mainBeats]);

  // Single source of truth for "reset the beat cycle": runs whenever bpm,
  // time signature, subdivision, or play state changes — i.e. every
  // settings change and every play/pause press. sessionIdRef guards
  // against the async ensureAudioReady() from a previous, now-superseded
  // call resolving late and starting a scheduler nobody asked for anymore.
  useEffect(() => {
    sessionIdRef.current += 1;
    const mySessionId = sessionIdRef.current;
    stopAudioScheduler();
    lastBeatIndexRef.current = -1;
    startTimeRef.current = null;
    barCountRef.current = 0;
    dotsRef.current?.reset();

    if (playing) {
      setAudioError(null);
      startAudioScheduler((60 / bpm) / subdivision, mySessionId, subdivision, mainBeats);
    }

    return () => {
      sessionIdRef.current += 1; // invalidate any in-flight async setup
      stopAudioScheduler();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, sig, subdivision, playing]);

  useEffect(() => {
    return () => {
      clearTimeout(holdTimeoutRef.current);
      clearInterval(holdIntervalRef.current);
    };
  }, []);

  // iOS suspends the AudioContext when the app backgrounds (screen lock,
  // app switch) — the same restriction that requires gesture-unlocking it
  // in the first place. Rather than trying to precisely resume mid-stream
  // after however long the app was away, this just resumes the context and
  // restarts the scheduler fresh at the bar boundary, same as any other
  // settings change.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !playing) return;
      sessionIdRef.current += 1;
      const mySessionId = sessionIdRef.current;
      stopAudioScheduler();
      lastBeatIndexRef.current = -1;
      startTimeRef.current = null;
      barCountRef.current = 0;
      dotsRef.current?.reset();
      (async () => {
        try {
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
          }
        } catch (e) {}
        startAudioScheduler((60 / bpm) / subdivision, mySessionId, subdivision, mainBeats);
      })();
    });
    return () => sub.remove();
  }, [playing, bpm, subdivision, mainBeats]);

  function changeBpm(delta) {
    setBpm(b => Math.max(30, Math.min(240, b + delta)));
  }

  function startHold(delta) {
    changeBpm(delta * 5);
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => changeBpm(delta), 90);
    }, 420);
  }
  function stopHold() {
    clearTimeout(holdTimeoutRef.current);
    clearInterval(holdIntervalRef.current);
  }

  // iOS Safari (including installed PWAs) only counts AudioContext.resume()
  // as gesture-authorized if it happens synchronously inside the tap
  // handler itself — waiting for a useEffect to fire after the state
  // update commits loses that gesture association, and the context stays
  // silently suspended. This runs directly from the play button's onPress,
  // before setPlaying, so it's still inside the original tap.
  //
  // Separately: iOS treats Web Audio as a "ringtone" category by default,
  // which the hardware mute switch silences — unlike native playback apps.
  // navigator.audioSession.type = 'playback' (iOS 16.4+) asks Safari to
  // treat it as media playback instead, so it plays through the switch.
  // Web-only API; guarded since it doesn't exist in the RN native runtime.
  function unlockAudioSession() {
    try {
      if (typeof navigator !== 'undefined' && navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch (e) {}
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {}
  }

  function togglePlay() {
    unlockAudioSession();
    setPlaying(p => !p);
  }

  function usePieceTempo() {
    setBpm(defaultBpm);
    setSig(defaultSig);
  }

  function selectSig(newSig) {
    setSig(newSig);
  }

  function selectSubdivision(n) {
    setSubdivision(n);
  }

  // Tap tempo: the taps so far (see utils/tapTempo.js). Two or more give a tempo, which is set the
  // same way the +/- buttons set it, so the click restarts cleanly on the new tempo.
  const tapsRef = useRef([]);
  function tapTempo() {
    tapsRef.current = addTap(tapsRef.current, Date.now());
    const tapped = bpmFromTaps(tapsRef.current);
    if (tapped) setBpm(tapped);
  }

  // The piece's tricky spots that have a clean tempo of their own: one tap sets the metronome to it and, when
  // the piece has a faster tempo, ramps up towards that (the same ramp as the Ramp tempo option below).
  const spotsWithTempo = openSpots(composition).filter(s => s.tempo);
  function practiseSpot(s) {
    if (s.id !== activeSpotId) setReps(emptyReps());
    setActiveSpotId(s.id);
    setBpm(Math.max(30, Math.min(240, s.tempo)));
    if (piece.hasTempo && piece.bpm > s.tempo) { setRampTarget(Math.min(240, piece.bpm)); setRampEnabled(true); }
  }
  const activeSpot = spotsWithTempo.find(s => s.id === activeSpotId) || null;
  const nextSpot = activeSpot ? nextSpotTempo(activeSpot, piece.hasTempo ? piece.bpm : undefined) : null;
  // Five clean in a row: save this session's goes to the spot, give it the next tempo, and play at it.
  function raiseSpot() {
    if (!activeSpot || !nextSpot) return;
    if (onSpotChange && composition) onSpotChange(composition.id, activeSpot.id, { tempo: nextSpot, reps: reps.total > 0 ? { clean: reps.clean, total: reps.total } : undefined });
    setBpm(Math.max(30, Math.min(240, nextSpot)));
    setReps(emptyReps());
  }
  function logSpotReps() {
    if (!activeSpot || !reps.total) return;
    if (onSpotChange && composition) onSpotChange(composition.id, activeSpot.id, { reps: { clean: reps.clean, total: reps.total } });
    setReps(emptyReps());
  }

  const currentTempoName = tempoName(bpm);

  return (
    <BlurView intensity={44} tint={COLOURS.blurTint} style={{ borderRadius: RADIUS.md, overflow: 'hidden', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4 }}>
    <View style={{ backgroundColor: COLOURS.glass, padding: 14 }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>metronome</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {piece.hasTempo || piece.hasSig ? (
            <TouchableOpacity onPress={usePieceTempo} activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{ minHeight: 28, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLOURS.steelA(0.10) }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.steel }}>Use piece tempo</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={tapTempo} activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button" accessibilityLabel="Tap tempo"
            accessibilityHint="Tap along to a beat, and the metronome takes that tempo"
            style={{ minHeight: 28, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLOURS.steelA(0.10) }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.steel }}>Tap tempo</Text>
          </TouchableOpacity>
          {/* The next tempo to try on this piece, a small step above your last clean reading (see
              suggestNextTempo in utils/insights.js). */}
          {suggestedBpm ? (
            <TouchableOpacity onPress={() => setBpm(suggestedBpm)} activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button" accessibilityLabel={`Set the metronome to ${suggestedBpm} beats per minute, the next tempo to try`}
              style={{ minHeight: 28, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLOURS.steelA(0.10) }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.steel }}>Next: {suggestedBpm}</Text>
            </TouchableOpacity>
          ) : null}
          {/* Play/pause lives here, in the header, rather than at the foot of
              the card — the card can grow tall once presets/more-time-sigs are
              expanded, and the most-tapped control shouldn't require
              scrolling past all of that to reach. */}
          <TouchableOpacity onPress={togglePlay} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel={playing ? 'Pause metronome' : 'Start metronome'}
            style={{ width: 44, height: 44, borderRadius: RADIUS.pill, backgroundColor: COLOURS.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={playing ? 'pause' : 'play'} size={24} color={COLOURS.onAmber} />
          </TouchableOpacity>
        </View>
      </View>

      {audioError ? (
        <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.danger, marginBottom: 8, textAlign: 'center' }}>
          Audio engine failed to start: {audioError}
        </Text>
      ) : null}

      {/* What the piece gave the metronome, so a piece that arrives without a tempo or time
          signature (or a segment with no piece) is visible as that rather than as a silent
          90 bpm and 4/4. */}
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, textAlign: 'center', marginBottom: 8 }}>
        {!composition
          ? 'No piece is linked to this segment.'
          : piece.hasTempo || piece.hasSig
            ? `${composition.title}: ${piece.hasTempo ? `${piece.bpm} bpm` : 'no tempo saved'} · ${piece.hasSig ? piece.sig : 'no time signature saved'}`
            : `${composition.title} has no tempo or time signature saved on this device.`}
      </Text>

      {spotsWithTempo.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          {spotsWithTempo.map(s => (
            <TouchableOpacity key={s.id} onPress={() => practiseSpot(s)} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Practise ${spotLabel(s.bars)} at ${s.tempo} beats per minute${piece.hasTempo && piece.bpm > s.tempo ? `, ramping up to ${piece.bpm}` : ''}`}
              style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.steelA(0.12) }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{spotLabel(s.bars)} · {s.tempo}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {activeSpot ? (
        <View style={{ alignItems: 'center', marginBottom: 10 }} accessibilityLiveRegion="polite">
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textAlign: 'center' }}>
            {spotLabel(activeSpot.bars)}: {describeReps(reps) || 'tap Clean or Miss after each go'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity onPress={() => setReps(r => recordRep(r, true))} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button" accessibilityLabel={`Clean go at ${spotLabel(activeSpot.bars)}`}
              style={{ minHeight: 44, paddingHorizontal: 22, justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOURS.success }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Clean</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReps(r => recordRep(r, false))} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button" accessibilityLabel={`Missed go at ${spotLabel(activeSpot.bars)}`}
              style={{ minHeight: 44, paddingHorizontal: 22, justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.10) }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.bodySmall, color: COLOURS.textMuted }}>Miss</Text>
            </TouchableOpacity>
          </View>
          {readyToStep(reps) && nextSpot ? (
            <TouchableOpacity onPress={raiseSpot} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button" accessibilityLabel={`${REPS_TO_STEP} clean in a row. Raise the tempo to ${nextSpot}`}
              style={{ marginTop: 10, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>{REPS_TO_STEP} clean: go up to {nextSpot}</Text>
            </TouchableOpacity>
          ) : null}
          {reps.total > 0 && onSpotChange ? (
            <TouchableOpacity onPress={logSpotReps} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button" accessibilityLabel={`Log ${reps.clean} clean of ${reps.total} goes to the spot`}
              style={{ marginTop: 8, minHeight: 36, justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>Log these {reps.total} {reps.total === 1 ? 'go' : 'goes'} to the spot</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <BeatDotsRow ref={dotsRef} mainBeats={mainBeats} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Decrease tempo"
          onPressIn={() => startHold(-1)}
          onPressOut={stopHold}
          activeOpacity={0.7}
          hitSlop={hitFor(40)} style={{ width: 40, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.navyA(0.25), alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: SIZES.body, color: COLOURS.navy }}>−</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.display, color: COLOURS.text }}>{bpm}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>bpm</Text>
          </View>
          <TouchableOpacity onPress={() => { if (!expanded) { setExpanded(true); setPresetsOpen(true); } else setPresetsOpen(o => !o); }} activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{currentTempoName}</Text>
            <Text style={{ fontSize: SIZES.tiny, color: COLOURS.steel }}>{presetsOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Increase tempo"
          onPressIn={() => startHold(1)}
          onPressOut={stopHold}
          activeOpacity={0.7}
          hitSlop={hitFor(40)} style={{ width: 40, height: 40, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOURS.navyA(0.25), alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: SIZES.body, color: COLOURS.navy }}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ textAlign: 'center', fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginTop: 2, marginBottom: 8 }}>
        tap ±5 · hold for ±1
      </Text>

      {compact ? (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 20, right: 20 }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Hide time signature, subdivision and ramp' : 'Show time signature, subdivision and ramp'}
          accessibilityState={{ expanded }}
          style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 }}>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.steel }}>{expanded ? 'Fewer options' : `${sig} \u00b7 more options`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLOURS.steel} />
        </TouchableOpacity>
      ) : null}

      {expanded && (
      <FadeInUp skip={!compact} distance={8}>
      {presetsOpen && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: COLOURS.navyA(0.12), paddingTop: 8, marginBottom: 8 }}>
          {TEMPO_PRESETS.map(p => {
            const active = p.name === currentTempoName;
            return (
              <TouchableOpacity
                key={p.name}
                onPress={() => setBpm(p.value)}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, paddingVertical: 6, paddingHorizontal: 4, borderRadius: RADIUS.sm, backgroundColor: active ? COLOURS.navyA(0.08) : 'transparent' }}
              >
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.label, color: active ? COLOURS.navy : COLOURS.text }}>{p.name}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{p.range} bpm</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {PRIMARY_SIGS.map(s => (
            <SigChip key={s} sig={s} active={sig === s} onPress={() => selectSig(s)} />
          ))}
          <TouchableOpacity onPress={() => setMoreOpen(o => !o)} activeOpacity={0.75}
            style={{ width: 44, borderRadius: RADIUS.sm, backgroundColor: COLOURS.navyA(0.08), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: SIZES.label, color: COLOURS.navy }}>{moreOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
        {moreOpen && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {MORE_SIGS.map(s => (
              <SigChip key={s} sig={s} active={sig === s} onPress={() => selectSig(s)} />
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: rampEnabled ? 8 : 10 }}>
        {[1, 2, 3, 4].map(n => {
          const active = subdivision === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => selectSubdivision(n)}
              activeOpacity={0.75}
              style={{ flex: 1, height: 44, borderRadius: RADIUS.sm, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.08), alignItems: 'center', justifyContent: 'center' }}
            >
              <NoteIcon sub={n} color={active ? COLOURS.onNavy : COLOURS.navyA(0.55)} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View>
        <TouchableOpacity onPress={() => setRampEnabled(e => !e)} activeOpacity={0.75}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            minHeight: 44, paddingVertical: 8, borderRadius: RADIUS.sm,
            backgroundColor: rampEnabled ? COLOURS.steelA(0.12) : COLOURS.navyA(0.06),
          }}>
          <Text style={{ fontSize: SIZES.label }}>📈</Text>
          <Text style={{ fontFamily: rampEnabled ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: rampEnabled ? COLOURS.steel : COLOURS.textDim }}>
            {rampEnabled ? `Ramping to ${rampTarget} bpm, +5 every ${rampEveryBars} bar${rampEveryBars === 1 ? '' : 's'}` : 'Ramp tempo'}
          </Text>
        </TouchableOpacity>
        {rampEnabled && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginBottom: 4 }}>target bpm</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => setRampTarget(t => Math.max(bpm, t - 5))} accessibilityRole="button" accessibilityLabel="Lower ramp target tempo" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, minWidth: 28, textAlign: 'center' }}>{rampTarget}</Text>
                <TouchableOpacity onPress={() => setRampTarget(t => Math.min(240, t + 5))} accessibilityRole="button" accessibilityLabel="Raise ramp target tempo" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginBottom: 4 }}>every N bars</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => setRampEveryBars(n => Math.max(1, n - 1))} accessibilityRole="button" accessibilityLabel="Fewer bars between tempo steps" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, minWidth: 16, textAlign: 'center' }}>{rampEveryBars}</Text>
                <TouchableOpacity onPress={() => setRampEveryBars(n => Math.min(32, n + 1))} accessibilityRole="button" accessibilityLabel="More bars between tempo steps" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={{ marginTop: 8 }}>
        <TouchableOpacity onPress={() => setSilentEnabled(e => !e)} activeOpacity={0.75}
          accessibilityRole="button" accessibilityState={{ selected: silentEnabled }}
          accessibilityLabel={silentEnabled ? `Silent bars on: ${describeSilentBars(silentPlayBars, silentQuietBars)}` : 'Silent bars off'}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            minHeight: 44, paddingVertical: 8, borderRadius: RADIUS.sm,
            backgroundColor: silentEnabled ? COLOURS.steelA(0.12) : COLOURS.navyA(0.06),
          }}>
          <Text style={{ fontFamily: silentEnabled ? 'Lato-Bold' : 'Lato', fontSize: SIZES.label, color: silentEnabled ? COLOURS.steel : COLOURS.textDim }}>
            {silentEnabled ? describeSilentBars(silentPlayBars, silentQuietBars) : 'Silent bars'}
          </Text>
        </TouchableOpacity>
        {silentEnabled && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginBottom: 4 }}>click for</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => setSilentPlayBars(n => nextBars(n, -1))} accessibilityRole="button" accessibilityLabel="Fewer bars with the click" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, minWidth: 16, textAlign: 'center' }}>{silentPlayBars}</Text>
                <TouchableOpacity onPress={() => setSilentPlayBars(n => nextBars(n, 1))} accessibilityRole="button" accessibilityLabel="More bars with the click" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.tiny, color: COLOURS.textDim, marginBottom: 4 }}>then silent for</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => setSilentQuietBars(n => nextBars(n, -1))} accessibilityRole="button" accessibilityLabel="Fewer silent bars" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, minWidth: 16, textAlign: 'center' }}>{silentQuietBars}</Text>
                <TouchableOpacity onPress={() => setSilentQuietBars(n => nextBars(n, 1))} accessibilityRole="button" accessibilityLabel="More silent bars" hitSlop={HIT_ICON} style={TOUCH_ICON}>
                  <Text style={{ fontSize: SIZES.bodySmall, color: COLOURS.navy }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ textAlign: 'center', fontFamily: isDefault(pattern) ? 'Lato' : 'Lato-Bold', fontSize: SIZES.label, color: isDefault(pattern) ? COLOURS.textDim : COLOURS.steel }}>{describePattern(pattern)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {pattern.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => setAccentPattern(cycleBeat(pattern, i))} activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Beat ${i + 1}: ${s === STRONG ? 'strong' : s === WEAK ? 'weak' : 'silent'}. Tap to change`}
              style={{ width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: s === STRONG ? COLOURS.navy : s === WEAK ? COLOURS.navyA(0.25) : 'transparent', borderWidth: s === MUTE ? 1.5 : 0, borderColor: COLOURS.navyA(0.35) }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: s === STRONG ? COLOURS.onNavy : COLOURS.navy }}>{i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {[['All', allStrong], ['1 only', firstOnly], ['Half bar', halfBar]].map(([label, make]) => (
            <TouchableOpacity key={label} onPress={() => setAccentPattern(make(mainBeats))} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button" accessibilityLabel={`Accents: ${label}`}
              style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navyA(0.08) }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textMuted }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      </FadeInUp>
      )}
    </View>
    </BlurView>
  );
});
