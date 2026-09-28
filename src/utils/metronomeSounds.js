// Two short synthesized clicks for the metronome — an accented beat-1
// tone and a softer tone for the rest of the beats/subdivisions. Tiny
// 8-bit/8kHz WAVs, embedded as base64 so nothing ships as a separate
// asset file in the repo.
export const ACCENT_CLICK_B64 = 'UklGRjwBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRgBAACA0PDOgDMUNH/J5seAOR07f8PdwYA/JkF/vdW8gEUtRn+4zraASjVLf7PHsoBOO1B/rsGtgFNBVH+qu6mAV0ZXf6e2pn9aS1t/o7KigF1QXn+grZ9/YFRhf52pnYBjWGR/m6aaf2VbZn+YopiAaF5of5afloBqYWp/lJ2UgGxkbH+TmpKAbWZugJGYkYBvaG9/j5aPgHBqcX+OlI6Acmxyf42SjIBzbnOAjJCLgHRvdH+Lj4qAdXF1f4qOiYB2cnZ/iYyJgHdzd4CIi4iAd3R4f4eKh4B4dXh/h4mGgHl2eX+GiYaAeXd5gIWIhYB6eHp/hYeFgHp4en+EhoSAe3l7f4SGhIB7eXuAhIWEgHx6fICDhYOAfHp8';

export const SUB_CLICK_B64 = 'UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAo7vBtJh2WEdHV3KRqbSvnYNpV1FYa4OZp6mfjHZkW1xoeo2boZ2QgG9lYmh1hJGZmZKFeG1oanJ+iZKVkYl+dG5tcnqEjJCPioJ6c3FyeH+HjI2KhH54dHR3fYOIiomGgHt3dnh7gIWHiIaCfnp4eHt+goWGhYOAfHp6e32Ag4WFg4F+fHt7fX+Cg4SDgX99fHx9foCCg4OCgH59fH1+';

// Pure-JS base64 → Uint8Array decoder, deliberately not relying on atob
// (not guaranteed to exist as a global in the RN/Hermes runtime) or on
// any native module — works identically on web and native, since the
// audio engine's decodeAudioData() accepts a plain ArrayBuffer directly
// on both platforms. No filesystem involved at all.
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToArrayBuffer(base64) {
  const clean = base64.replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | B64_CHARS.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes).buffer;
}
