// Emoji → icon mapping (pure: no React Native imports, so it's unit-tested in plain Node).
//
// Emoji render differently on every platform (colour on iOS, flat and mismatched on some
// Android builds and browsers, black glyphs that vanish on a dark theme) and can't follow
// the theme. So <Text> swaps any emoji listed here for a Material Design Icon at render
// time (see components/EmojiIcons.js). Write emoji in JSX as usual; to support a new one,
// add a line below. `tint` is an optional semantic colour (resolved from the theme when
// drawn); icons without one simply take the surrounding text colour.
//
// Icon names are from Material Design Icons (MaterialCommunityIcons in @expo/vector-icons).
// FontAwesome5 is also bundled, if one family ever suits a glyph better.
//
// Typographic symbols (♪ ♩ ❙ ✕ ✎ ✓ ↻ ◀ ▶ …) are deliberately NOT here: they're ordinary
// text characters, not emoji, and render consistently.

export const EMOJI_ICONS = {
  '⚡': { name: 'lightning-bolt', tint: 'amber' },
  '❤': { name: 'heart', tint: 'heart' },
  '⭐': { name: 'star', tint: 'gold' },
  '🌟': { name: 'star-four-points', tint: 'gold' },
  '✨': { name: 'shimmer' },
  '🔥': { name: 'fire', tint: 'amber' },
  '✅': { name: 'check-circle-outline', tint: 'success' },
  '🎹': { name: 'piano' },
  '🎓': { name: 'school' },
  '🎵': { name: 'music-note' },
  '🎶': { name: 'music' },
  '🎼': { name: 'music-clef-treble' },
  '🎧': { name: 'headphones' },
  '🎥': { name: 'video-outline' },
  '🎯': { name: 'target' },
  '📜': { name: 'script-text-outline' },
  '📚': { name: 'bookshelf' },
  '📖': { name: 'book-open-page-variant-outline' },
  '📅': { name: 'calendar-month-outline' },
  '📊': { name: 'chart-bar' },
  '📈': { name: 'chart-line' },
  '📦': { name: 'package-variant-closed' },
  '📍': { name: 'map-marker-outline' },
  '📬': { name: 'email-outline' },
  '⏱': { name: 'timer-outline' },
  '💬': { name: 'comment-text-outline' },
  '💡': { name: 'lightbulb-on-outline' },
  '💧': { name: 'water' },
  '🔄': { name: 'sync' },
  '🔎': { name: 'magnify' },
  '🚧': { name: 'traffic-cone' },
  '🌿': { name: 'leaf' },
  '🌱': { name: 'sprout' },
  '🐙': { name: 'github' },
};

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest keys first; an optional U+FE0F (emoji presentation selector) is swallowed so
// "❤" and "❤️" are the same thing.
const PATTERN = Object.keys(EMOJI_ICONS)
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join('|');
const matcher = () => new RegExp(`(${PATTERN})\\uFE0F?`, 'g');

// Does this string contain an emoji we know how to draw as an icon?
export function hasEmoji(str) {
  return typeof str === 'string' && matcher().test(str);
}

// Split a string into plain-text pieces and { emoji, name, tint } icon pieces, in order.
// A string with nothing to convert comes back as [str] unchanged.
export function splitEmoji(str) {
  const re = matcher();
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push({ emoji: m[1], ...EMOJI_ICONS[m[1]] });
    last = m.index + m[0].length;
  }
  if (out.length === 0) return [str];
  if (last < str.length) out.push(str.slice(last));
  return out;
}
