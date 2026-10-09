// Pure helpers for drag-to-reorder lists. No React Native imports, so the
// maths can be unit-tested in plain Node.

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

// Keep the drag inside the list.
export function clampDy(keys, layouts, from, dy) {
  const first = layouts[keys[0]];
  const last = layouts[keys[keys.length - 1]];
  const me = layouts[keys[from]];
  const min = first.y - me.y;
  const max = last.y + last.h - me.h - me.y;
  return Math.max(min, Math.min(max, dy));
}
