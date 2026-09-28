import * as FileSystem from 'expo-file-system';

// Two short synthesized clicks for the metronome — an accented beat-1
// tone and a softer tone for the rest of the beats/subdivisions. Tiny
// 8-bit/8kHz WAVs, embedded as base64 so nothing ships as a separate
// asset file in the repo.
const ACCENT_CLICK_B64 = 'UklGRjwBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRgBAACA0PDOgDMUNH/J5seAOR07f8PdwYA/JkF/vdW8gEUtRn+4zraASjVLf7PHsoBOO1B/rsGtgFNBVH+qu6mAV0ZXf6e2pn9aS1t/o7KigF1QXn+grZ9/YFRhf52pnYBjWGR/m6aaf2VbZn+YopiAaF5of5afloBqYWp/lJ2UgGxkbH+TmpKAbWZugJGYkYBvaG9/j5aPgHBqcX+OlI6Acmxyf42SjIBzbnOAjJCLgHRvdH+Lj4qAdXF1f4qOiYB2cnZ/iYyJgHdzd4CIi4iAd3R4f4eKh4B4dXh/h4mGgHl2eX+GiYaAeXd5gIWIhYB6eHp/hYeFgHp4en+EhoSAe3l7f4SGhIB7eXuAhIWEgHx6fICDhYOAfHp8';

const SUB_CLICK_B64 = 'UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAo7vBtJh2WEdHV3KRqbSvnYNpV1FYa4OZp6mfjHZkW1xoeo2boZ2QgG9lYmh1hJGZmZKFeG1oanJ+iZKVkYl+dG5tcnqEjJCPioJ6c3FyeH+HjI2KhH54dHR3fYOIiomGgHt3dnh7gIWHiIaCfnp4eHt+goWGhYOAfHp6e32Ag4WFg4F+fHt7fX+Cg4SDgX99fHx9foCCg4OCgH59fH1+';

// Data URIs — kept for anywhere still using the old expo-audio-based
// player (e.g. if this file is imported before the migration lands
// everywhere), but the metronome's engine now needs real local files
// instead, since react-native-audio-api's decodeAudioDataSource reads
// from the filesystem rather than accepting a data URI directly.
export const ACCENT_CLICK_URI = `data:audio/wav;base64,${ACCENT_CLICK_B64}`;
export const SUB_CLICK_URI = `data:audio/wav;base64,${SUB_CLICK_B64}`;

const DIR = FileSystem.cacheDirectory + 'metronome-clicks/';
const ACCENT_PATH = DIR + 'accent.wav';
const SUB_PATH = DIR + 'sub.wav';

let readyPromise = null;

// Writes both click WAVs to local cache files on first call, then just
// returns the same paths on every subsequent call — idempotent and safe
// to call from multiple places (e.g. every time playback starts).
export function ensureClickFiles() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
      const [accentInfo, subInfo] = await Promise.all([
        FileSystem.getInfoAsync(ACCENT_PATH),
        FileSystem.getInfoAsync(SUB_PATH),
      ]);
      if (!accentInfo.exists) {
        await FileSystem.writeAsStringAsync(ACCENT_PATH, ACCENT_CLICK_B64, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!subInfo.exists) {
        await FileSystem.writeAsStringAsync(SUB_PATH, SUB_CLICK_B64, { encoding: FileSystem.EncodingType.Base64 });
      }
      return { accentPath: ACCENT_PATH, subPath: SUB_PATH };
    })();
  }
  return readyPromise;
}
