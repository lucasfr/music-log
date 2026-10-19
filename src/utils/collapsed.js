// Which sections of a long screen are folded away, remembered between launches. Pure (no React
// Native imports), so it's unit-tested in plain Node, see tests/collapsed.test.mjs.
// Stats has nine sections and is a very long scroll, so each can be folded.

// The saved value (a JSON list of section ids) -> an array. Anything unreadable means none folded.
export function parseCollapsed(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const serializeCollapsed = list => JSON.stringify(list);

// A new list with `id` folded if it was open, or open again if it was folded.
export function toggleCollapsed(list, id) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}
