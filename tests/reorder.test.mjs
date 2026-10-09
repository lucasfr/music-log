// Tests for the drag-to-reorder maths (src/utils/reorder.js).
//
//   npm test
//
// Uses Node's built-in test runner, so there's nothing extra to install. reorder.js is
// loaded from source (as a data: module) so this works without a build step or any
// "type": "module" setting in package.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/reorder.js'), 'utf8');
const { reorder, toSlot, overIndex, shiftFor, snapOffset, clampDy } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

// ── helpers ──────────────────────────────────────────────────────────────────────────

// Stack cards of the given heights from y = 0, like a list does. (A card's height here
// includes the gap below it, which is how the app measures them.)
function stack(heights) {
  const keys = [];
  const layouts = {};
  let y = 0;
  heights.forEach((h, i) => {
    const k = 'k' + i;
    keys.push(k);
    layouts[k] = { y, h };
    y += h;
  });
  return { keys, layouts };
}

// Layouts used throughout. "3 equal" is the case that was reported broken.
const LAYOUTS = {
  '2 equal': [66, 66],
  '3 equal': [66, 66, 66],
  '4 equal': [66, 66, 66, 66],
  '3, tall in the middle': [66, 300, 66],
  '4 mixed': [66, 300, 120, 66],
  '5 mixed': [90, 66, 400, 66, 150],
};

// Drag card `from` by `dy` (clamped like the app does) and report which slot it's over.
function slotAt(keys, layouts, from, dy) {
  const me = layouts[keys[from]];
  const cdy = clampDy(keys, layouts, from, dy);
  return overIndex(keys, layouts, keys[from], me.y + me.h / 2 + cdy);
}

// ── toSlot: the boundary that once broke everything ─────────────────────────────────

test('toSlot converts a React Native layout ({x,y,width,height}) to {y,h}', () => {
  assert.deepEqual(toSlot({ x: 0, y: 132, width: 300, height: 66 }), { y: 132, h: 66 });
});

test('a raw React Native layout has no `h` — this is the trap toSlot exists for', () => {
  const raw = { x: 0, y: 0, width: 300, height: 66 };
  assert.equal(raw.h, undefined);
  // Fed straight into the maths it would produce NaN, so nothing could ever move.
  assert.ok(Number.isNaN(clampDy(['a'], { a: raw }, 0, 10)));
  // After conversion everything is a real number.
  assert.ok(Number.isFinite(clampDy(['a'], { a: toSlot(raw) }, 0, 10)));
});

// ── reorder ──────────────────────────────────────────────────────────────────────────

test('reorder moves an item and returns a new array', () => {
  const a = ['a', 'b', 'c'];
  assert.deepEqual(reorder(a, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(reorder(a, 2, 1), ['a', 'c', 'b']);
  assert.deepEqual(reorder(a, 1, 0), ['b', 'a', 'c']);
  assert.deepEqual(a, ['a', 'b', 'c'], 'input is not mutated');
});

test('reorder ignores no-op and out-of-range moves', () => {
  const a = ['a', 'b', 'c'];
  assert.equal(reorder(a, 1, 1), a);
  assert.equal(reorder(a, -1, 1), a);
  assert.equal(reorder(a, 0, 3), a);
  assert.equal(reorder(a, 3, 0), a);
});

// ── overIndex ────────────────────────────────────────────────────────────────────────

test('overIndex counts the other cards whose centre is above the held card', () => {
  const { keys, layouts } = stack([66, 66, 66]); // centres at 33, 99, 165
  assert.equal(overIndex(keys, layouts, 'k2', 20), 0);
  assert.equal(overIndex(keys, layouts, 'k2', 60), 1);
  assert.equal(overIndex(keys, layouts, 'k2', 120), 2);
  assert.equal(overIndex(keys, layouts, 'k0', 190), 2, 'the held card never counts itself');
});

test('overIndex only flips once the centre is strictly past a neighbour', () => {
  const { keys, layouts } = stack([66, 66, 66]);
  assert.equal(overIndex(keys, layouts, 'k2', 99), 1); // exactly level with card 2's centre
  assert.equal(overIndex(keys, layouts, 'k2', 99.5), 2);
});

// ── shiftFor / snapOffset: the gap and the landing spot must agree ───────────────────

test('shiftFor slides the cards in between out of the way, and nothing else', () => {
  // dragging card 0 down to slot 2: cards 1 and 2 move up by the held card's height
  assert.equal(shiftFor(0, 0, 2, 66), 0);
  assert.equal(shiftFor(1, 0, 2, 66), -66);
  assert.equal(shiftFor(2, 0, 2, 66), -66);
  assert.equal(shiftFor(3, 0, 2, 66), 0);
  // dragging card 3 up to slot 1: cards 1 and 2 move down
  assert.equal(shiftFor(0, 3, 1, 66), 0);
  assert.equal(shiftFor(1, 3, 1, 66), 66);
  assert.equal(shiftFor(2, 3, 1, 66), 66);
  assert.equal(shiftFor(3, 3, 1, 66), 0);
});

test('snapOffset is the total height of the cards the held card jumps over', () => {
  const { keys, layouts } = stack([66, 300, 120, 66]);
  assert.equal(snapOffset(keys, layouts, 0, 2), 300 + 120);
  assert.equal(snapOffset(keys, layouts, 3, 1), -(300 + 120));
  assert.equal(snapOffset(keys, layouts, 2, 2), 0);
});

test('for every move, the open gap is exactly where the card lands (no overlap, no hole)', () => {
  for (const [name, heights] of Object.entries(LAYOUTS)) {
    const { keys, layouts } = stack(heights);
    for (let from = 0; from < keys.length; from++) {
      for (let over = 0; over < keys.length; over++) {
        const held = layouts[keys[from]];
        const placed = keys.map((k, i) => ({
          k,
          y: layouts[k].y + (i === from ? snapOffset(keys, layouts, from, over) : shiftFor(i, from, over, held.h)),
          h: layouts[k].h,
        })).sort((a, b) => a.y - b.y);

        // order on screen == the order reorder() will produce
        assert.deepEqual(placed.map(p => p.k), reorder(keys, from, over), `${name}: ${from}→${over} order`);
        // cards tile the list exactly: each starts where the previous one ends
        let expected = 0;
        for (const p of placed) {
          assert.equal(p.y, expected, `${name}: ${from}→${over} leaves a gap or overlap at ${p.k}`);
          expected += p.h;
        }
      }
    }
  }
});

// ── clampDy ──────────────────────────────────────────────────────────────────────────

test('clampDy always returns a real number and keeps the held card centre inside the list', () => {
  for (const [name, heights] of Object.entries(LAYOUTS)) {
    const { keys, layouts } = stack(heights);
    const total = heights.reduce((a, b) => a + b, 0);
    for (let from = 0; from < keys.length; from++) {
      const me = layouts[keys[from]];
      for (const dy of [-1e6, -50, 0, 50, 1e6]) {
        const cdy = clampDy(keys, layouts, from, dy);
        assert.ok(Number.isFinite(cdy), `${name}: NaN for card ${from}`);
        const centre = me.y + me.h / 2 + cdy;
        assert.ok(centre >= 0 && centre <= total, `${name}: card ${from} centre ${centre} left the list`);
      }
    }
  }
});

// ── the bug that was reported: every card must be able to reach every slot ───────────

test('every card can be dragged to every slot (equal and mixed heights)', () => {
  for (const [name, heights] of Object.entries(LAYOUTS)) {
    const { keys, layouts } = stack(heights);
    for (let from = 0; from < keys.length; from++) {
      const reachable = new Set();
      for (let dy = -3000; dy <= 3000; dy++) reachable.add(slotAt(keys, layouts, from, dy));
      for (let to = 0; to < keys.length; to++) {
        assert.ok(reachable.has(to), `${name}: card ${from + 1} can't reach slot ${to + 1}`);
      }
    }
  }
});

test('three equal cards: the exact moves that were reported broken', () => {
  const { keys, layouts } = stack([66, 66, 66]);
  // dragging all the way down lands in the last slot, for card 1 and card 2
  assert.equal(slotAt(keys, layouts, 0, 1000), 2);
  assert.equal(slotAt(keys, layouts, 1, 1000), 2);
  // card 3 can stop in the middle, not just jump to the top
  assert.equal(slotAt(keys, layouts, 2, -66), 1);
  assert.equal(slotAt(keys, layouts, 2, -1000), 0);
  // and the resulting orders are what the user asked for
  assert.deepEqual(reorder(keys, 0, slotAt(keys, layouts, 0, 1000)), ['k1', 'k2', 'k0']);
  assert.deepEqual(reorder(keys, 2, slotAt(keys, layouts, 2, -66)), ['k0', 'k2', 'k1']);
});
