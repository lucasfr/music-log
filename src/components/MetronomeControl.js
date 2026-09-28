import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Ellipse, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { COLOURS, RADIUS } from '../theme';
import { ACCENT_CLICK_URI, SUB_CLICK_URI } from '../utils/metronomeSounds';

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

// Isolated on purpose: this is the only piece of the metronome that changes
// every single tick. Keeping its state here (rather than lifting it into
// MetronomeControl) means ticking never re-renders the BlurView glass card
// or any of the buttons/icons around it — only these few Views update.
// Native blur re-renders are expensive enough that doing one per tick was
// fighting the JS thread for the same time budget setTimeout needs to fire
// on schedule, which is what was actually causing the glitching at every
// tempo, not just high ones.
const BeatDotsRow = forwardRef(function BeatDotsRow({ mainBeats }, ref) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lit, setLit] = useState(false);
  const flashTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    pulse(index, flashMs) {
      clearTimeout(flashTimeoutRef.current);
      setActiveIndex(index);
      setLit(true);
      flashTimeoutRef.current = setTimeout(() => setLit(false), flashMs);
    },
    reset() {
      clearTimeout(flashTimeoutRef.current);
      setActiveIndex(0);
      setLit(false);
    },
  }));

  useEffect(() => () => clearTimeout(flashTimeoutRef.current), []);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
      {Array.from({ length: mainBeats }, (_, i) => (
        <View key={i} style={{
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: (lit && i === activeIndex) ? COLOURS.amber : 'rgba(247,127,0,0.22)',
        }} />
      ))}
    </View>
  );
});

function SigChip({ sig, active, onPress }) {
  const [num, den] = sig.split('/');
  const color = active ? '#fff' : COLOURS.steel;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={{ flex: 1, paddingVertical: 6, borderRadius: 10, backgroundColor: active ? COLOURS.navy : 'rgba(9,99,126,0.08)', alignItems: 'center' }}>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif', fontWeight: '700', fontSize: 16, color, lineHeight: 17 }}>{num}</Text>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif', fontWeight: '700', fontSize: 16, color, lineHeight: 17 }}>{den}</Text>
    </TouchableOpacity>
  );
}

// composition: the linked library piece for the current segment, or null.
// Reads composition.tempo (bpm) and composition.timeSigs[0] as defaults —
// falls back to 90bpm / 4/4 if the piece has no stored tempo/time sig yet.
export function MetronomeControl({ composition }) {
  const defaultBpm = Number(composition?.tempo) || 90;
  const defaultSig = (composition?.timeSigs && composition.timeSigs[0]) || '4/4';

  const [bpm, setBpm] = useState(defaultBpm);
  const [sig, setSig] = useState(defaultSig);
  const [subdivision, setSubdivision] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const mainBeats = mainBeatsFor(sig);
  const dotsRef = useRef(null);

  const timerRef = useRef(null);
  const tickCountRef = useRef(0);
  const beatIndexRef = useRef(0);
  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const accentPlayersRef = useRef([]);
  const subPlayersRef = useRef([]);
  const accentIdxRef = useRef(0);
  const subIdxRef = useRef(0);

  // A small round-robin pool per click type, rather than one reused player.
  // At high bpm (especially with subdivisions on), the gap between ticks
  // can shrink close to or below the click sample's own playback time —
  // calling seekTo(0)+play() again on a player that's still mid-playback
  // is exactly the kind of retrigger that causes audio glitches/dropouts.
  // Cycling through a few instances gives each one a full rotation's worth
  // of time to finish before it's reused.
  const POOL_SIZE = 4;

  function getNextPlayer(poolRef, idxRef, uri) {
    if (poolRef.current.length < POOL_SIZE) {
      try { poolRef.current.push(createAudioPlayer({ uri })); }
      catch (e) { return null; }
    }
    const player = poolRef.current[idxRef.current];
    idxRef.current = (idxRef.current + 1) % POOL_SIZE;
    return player || null;
  }

  function playClick(isMain) {
    const player = isMain
      ? getNextPlayer(accentPlayersRef, accentIdxRef, ACCENT_CLICK_URI)
      : getNextPlayer(subPlayersRef, subIdxRef, SUB_CLICK_URI);
    if (player) {
      try { player.seekTo(0); player.play(); } catch (e) {}
    }
  }

  function tick() {
    const isMain = tickCountRef.current % subdivision === 0;
    if (isMain) {
      playClick(true);
      if (beatIndexRef.current === 0) Haptics.selectionAsync().catch(() => {});
      const intervalMs = (60000 / bpm) / subdivision;
      const flashMs = Math.min(110, intervalMs * 0.6);
      dotsRef.current?.pulse(beatIndexRef.current, flashMs);
      beatIndexRef.current = (beatIndexRef.current + 1) % mainBeats;
    } else {
      playClick(false);
    }
    tickCountRef.current = (tickCountRef.current + 1) % subdivision;
  }

  // Drift-corrected scheduler instead of a naive setInterval. setInterval
  // just requests "call me again in N ms" with no memory of how late the
  // previous call actually landed — any JS-thread stall (a render, a GC
  // pause, a bridge round-trip) makes every subsequent tick permanently
  // late by that same amount, compounding over a long session. This tracks
  // the *expected* wall-clock time of each tick and shrinks the next delay
  // by however much the previous one overshot, so timing self-corrects
  // instead of drifting.
  function startScheduler(intervalMs) {
    let expected = Date.now() + intervalMs;
    function step() {
      tick();
      const drift = Date.now() - expected;
      const nextDelay = Math.max(0, intervalMs - drift);
      expected += intervalMs;
      timerRef.current = setTimeout(step, nextDelay);
    }
    timerRef.current = setTimeout(step, intervalMs);
  }

  // Single source of truth for "reset the beat cycle": runs whenever bpm,
  // time signature, subdivision, or play state changes — i.e. every
  // settings change and every play/pause press, per the actual request.
  // Always clears any running timer, snaps the visual/audio state back to
  // beat 1 via the isolated dots component, and (if playing) fires an
  // immediate fresh tick before starting the scheduler at the current
  // settings. Centralising this here avoids the stale-closure risk of
  // computing intervals inside individual change handlers.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    tickCountRef.current = 0;
    beatIndexRef.current = 0;
    dotsRef.current?.reset();

    if (playing) {
      tick();
      startScheduler((60000 / bpm) / subdivision);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, sig, subdivision, playing]);

  useEffect(() => {
    return () => {
      clearTimeout(holdTimeoutRef.current);
      clearInterval(holdIntervalRef.current);
    };
  }, []);

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

  function togglePlay() {
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

  const currentTempoName = tempoName(bpm);

  return (
    <BlurView intensity={44} tint="light" style={{ borderRadius: 16, overflow: 'hidden', shadowColor: COLOURS.glassShadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 18, elevation: 4 }}>
    <View style={{ backgroundColor: COLOURS.glass, padding: 14 }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.steel }}>metronome</Text>
        {composition ? (
          <TouchableOpacity onPress={usePieceTempo} activeOpacity={0.75}
            style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(8,131,149,0.10)' }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 10, color: COLOURS.steel }}>Use piece tempo</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <BeatDotsRow ref={dotsRef} mainBeats={mainBeats} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <TouchableOpacity
          onPressIn={() => startHold(-1)}
          onPressOut={stopHold}
          activeOpacity={0.7}
          style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(9,99,126,0.25)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: COLOURS.navy }}>−</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 26, color: COLOURS.text }}>{bpm}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>bpm</Text>
          </View>
          <TouchableOpacity onPress={() => setPresetsOpen(o => !o)} activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.steel }}>{currentTempoName}</Text>
            <Text style={{ fontSize: 9, color: COLOURS.steel }}>{presetsOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPressIn={() => startHold(1)}
          onPressOut={stopHold}
          activeOpacity={0.7}
          style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(9,99,126,0.25)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: COLOURS.navy }}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ textAlign: 'center', fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, marginTop: 2, marginBottom: 8 }}>
        tap ±5 · hold for ±1
      </Text>

      {presetsOpen && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: 'rgba(9,99,126,0.12)', paddingTop: 8, marginBottom: 8 }}>
          {TEMPO_PRESETS.map(p => {
            const active = p.name === currentTempoName;
            return (
              <TouchableOpacity
                key={p.name}
                onPress={() => setBpm(p.value)}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, backgroundColor: active ? 'rgba(9,99,126,0.08)' : 'transparent' }}
              >
                <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 13, color: active ? COLOURS.navy : COLOURS.text }}>{p.name}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>{p.range} bpm</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {PRIMARY_SIGS.map(s => (
            <SigChip key={s} sig={s} active={sig === s} onPress={() => selectSig(s)} />
          ))}
          <TouchableOpacity onPress={() => setMoreOpen(o => !o)} activeOpacity={0.75}
            style={{ width: 36, borderRadius: 10, backgroundColor: 'rgba(9,99,126,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: COLOURS.navy }}>{moreOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
        {moreOpen && (
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
            {MORE_SIGS.map(s => (
              <SigChip key={s} sig={s} active={sig === s} onPress={() => selectSig(s)} />
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 5, marginBottom: 10 }}>
        {[1, 2, 3, 4].map(n => {
          const active = subdivision === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => selectSubdivision(n)}
              activeOpacity={0.75}
              style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: active ? COLOURS.navy : 'rgba(9,99,126,0.08)', alignItems: 'center', justifyContent: 'center' }}
            >
              <NoteIcon sub={n} color={active ? '#fff' : 'rgba(9,99,126,0.55)'} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ alignItems: 'center' }}>
        <TouchableOpacity onPress={togglePlay} activeOpacity={0.85}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: COLOURS.amber, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, color: '#fff' }}>{playing ? '❙❙' : '▶'}</Text>
        </TouchableOpacity>
      </View>
    </View>
    </BlurView>
  );
}
