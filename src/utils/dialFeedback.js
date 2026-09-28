import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { DIAL_TICK_URI } from './dialTickSound';

// A light "click" for each notch the dial passes through while dragging —
// distinct from chime.js's session-completion cue, which is a separate,
// more noticeable event. Native gets both a selection haptic (the same
// subtle tick iOS uses for its own picker wheels) and an audible click;
// web gets the click only, reusing one AudioContext across ticks rather
// than creating a new one per call, since browsers can throttle/refuse
// rapid-fire context creation.

let nativePlayer = null;
function getNativePlayer() {
  if (!nativePlayer) {
    try {
      nativePlayer = createAudioPlayer({ uri: DIAL_TICK_URI });
    } catch (e) {
      nativePlayer = false; // tried and failed — don't retry every tick
    }
  }
  return nativePlayer || null;
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
    const player = getNativePlayer();
    if (player) {
      try {
        player.seekTo(0);
        player.play();
      } catch (e) {
        // Playback hiccup — the haptic above already fired, so the drag
        // still feels responsive even if the click itself drops a beat.
      }
    }
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1400;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);
    osc.stop(ctx.currentTime + 0.03);
  } catch (e) {
    // Non-fatal — the dial still works perfectly well silently.
  }
}
