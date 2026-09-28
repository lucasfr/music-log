import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Completion cue for segment transitions and session end.
// Native (iOS/Android): a haptic pulse via expo-haptics — no sound asset
// needed, works even with the phone silenced.
// Web: a short beep via the Web Audio API, since there's no haptics API
// in a browser tab.
export function playChime() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }

  if (typeof window === 'undefined') return;
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
