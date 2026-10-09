// Pure helpers for drag-to-reorder lists. No React Native imports, so the
// maths can be unit-tested in plain Node (see tests/reorder.test.mjs).

// React Native reports a measured view as { x, y, width, height }; every helper below
// works with { y, h }. Convert at the boundary: reading `.h` straight off a raw layout
// gives undefined, which silently turns all the maths into NaN.
export function toSlot(layout) {
  return { y: layout.y, h: layout.height };
}

// Move one item from `from` to `to`, returning a new array.
export function reorder(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Which slot is the dragged item over? `layouts[key]` is { y, h } in the list's
// own coordinate space (original, un-shifted positions). The answer is the
// number of *other* items whose centre is above the dragged item's centre.
export function overIndex(keys, layouts, dragKey, centerY) {
  let over = 0;
  for (const k of keys) {
    if (k === dragKey) continue;
    const L = layouts[k];
    if (L && L.y + L.h / 2 < centerY) over += 1;
  }
  return over;
}

// How far should the item at index `i` visually slide while another item is
// being dragged from `from` and is currently hovering over `over`?
export function shiftFor(i, from, over, draggedH) {
  if (i === from) return 0;
  if (from < over && i > from && i <= over) return -draggedH;
  if (from > over && i >= over && i < from) return draggedH;
  return 0;
}

// Where does the dragged item settle (relative to where it started)?
export function snapOffset(keys, layouts, from, over) {
  let off = 0;
  if (over > from) for (let i = from + 1; i <= over; i++) off += layouts[keys[i]].h;
  else if (over < from) for (let i = over; i < from; i++) off -= layouts[keys[i]].h;
  return off;
}

// Keep the drag inside the list. The slot is decided by where the held card's CENTRE is,
// so that is what we bound: it may travel anywhere from the top of the first card to the
// bottom of the last. (Bounding the card's edges instead stops the centre exactly on the
// last card's centre, which never counts as "past" it, so nothing could reach the end slot,
// and a tall card couldn't reach most slots at all.)
export function clampDy(keys, layouts, from, dy) {
  const first = layouts[keys[0]];
  const last = layouts[keys[keys.length - 1]];
  const me = layouts[keys[from]];
  const centre = me.y + me.h / 2;
  const min = first.y + 1 - centre;
  const max = last.y + last.h - 1 - centre;
  return Math.max(min, Math.min(max, dy));
}
