import { Platform } from 'react-native';

// Lightweight completion cue — web only for now. Native (iOS/Android) needs
// expo-haptics and/or expo-av added as dependencies before it can vibrate or
// play a sound; deliberately left as a no-op there rather than half-wiring
// something that would need a native rebuild to actually work.
export function playChime() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.42);
  } catch (e) {
    // Autoplay policies etc. — silently skip, it's a nice-to-have, not core.
  }
}
