import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioContext } from 'react-native-audio-api';
import { base64ToArrayBuffer } from './metronomeSounds';
import { DIAL_TICK_B64 } from './dialTickSound';

// A light "click" for each notch the dial passes through while dragging —
// distinct from chime.js's session-completion cue, which is a separate,
// more noticeable event. Native gets both a selection haptic (the same
// subtle tick iOS uses for its own picker wheels) and an audible click;
// web gets the click only, reusing one AudioContext across ticks rather
// than creating a new one per call, since browsers can throttle/refuse
// rapid-fire context creation.
//
// Native playback goes through react-native-audio-api (the same engine
// MetronomeControl uses), not expo-audio — consolidating onto one audio
// library rather than two, now that this is the only other spot that
// used expo-audio at all (chime.js never did: haptics only on native).
// Drag ticks aren't tempo-critical the way the metronome's clicks are, so
// there's no lookahead scheduler here — just decode the buffer once and
// fire a fresh BufferSourceNode immediately per tick.

let nativeCtx = null;
let nativeBufferPromise = null;

function ensureNativeBuffer() {
  if (!nativeBufferPromise) {
    nativeBufferPromise = (async () => {
      if (!nativeCtx) nativeCtx = new AudioContext();
      if (nativeCtx.state === 'suspended') await nativeCtx.resume().catch(() => {});
      return nativeCtx.decodeAudioData(base64ToArrayBuffer(DIAL_TICK_B64));
    })();
  }
  return nativeBufferPromise;
}

let audioCtx = null;
function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

export function dialTick() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
    ensureNativeBuffer()
      .then(buffer => {
        if (!nativeCtx) return;
        try {
          const source = nativeCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(nativeCtx.destination);
          source.start(nativeCtx.currentTime);
        } catch (e) {
          // Playback hiccup — the haptic above already fired, so the drag
          // still feels responsive even if the click itself drops a beat.
        }
      })
      .catch(() => {});
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // Body: a low sine 'tock', matching the native WAV's character
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.value = 220;
    bodyGain.gain.value = 0.11;
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    body.stop(now + 0.055);

    // Transient: a brief higher tone for onset definition, quieter and
    // much shorter so it reads as attack rather than pitch
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'sine';
    click.frequency.value = 700;
    clickGain.gain.value = 0.05;
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
    click.stop(now + 0.02);
  } catch (e) {
    // Non-fatal — the dial still works perfectly well silently.
  }
}
