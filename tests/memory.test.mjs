import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryState, withMemorised, withPlayedFromMemory, memorisedIds, STALE_AFTER_DAYS } from '../src/utils/memory.js';

const TODAY = '2026-11-01';

test('a piece that is not memorised has no state', () => {
  assert.deepEqual(memoryState({ id: 'a' }, TODAY), { memorised: false, since: null, lastPlayed: null, daysSince: null, stale: false, line: null });
  assert.equal(memoryState(null, TODAY).memorised, false);
  assert.equal(memoryState({ memorised: false, lastFromMemory: TODAY }, TODAY).line, null);
});

test('memorised but never played from memory since', () => {
  const s = memoryState({ memorised: true, memorisedAt: '2026-10-01' }, TODAY);
  assert.equal(s.memorised, true);
  assert.equal(s.since, '2026-10-01');
  assert.equal(s.daysSince, null);
  assert.equal(s.stale, false);
  assert.match(s.line, /Not yet played from memory/);
});

test('played from memory today, yesterday, and days ago', () => {
  assert.match(memoryState({ memorised: true, lastFromMemory: TODAY }, TODAY).line, /today/);
  assert.match(memoryState({ memorised: true, lastFromMemory: '2026-10-31' }, TODAY).line, /1 day ago\./);
  const s = memoryState({ memorised: true, lastFromMemory: '2026-10-25' }, TODAY);
  assert.equal(s.daysSince, 7);
  assert.equal(s.stale, false);
  assert.match(s.line, /7 days ago\./);
});

test('stale from the fourteenth day, and the line says a run-through is due', () => {
  const edge = memoryState({ memorised: true, lastFromMemory: '2026-10-19' }, TODAY);   // 13 days
  assert.equal(edge.stale, false);
  const due = memoryState({ memorised: true, lastFromMemory: '2026-10-18' }, TODAY);    // 14 days
  assert.equal(due.daysSince, STALE_AFTER_DAYS);
  assert.equal(due.stale, true);
  assert.match(due.line, /due a run-through/);
});

test('day counting is exact across the clocks going back (UK, 25 Oct 2026) and forward', () => {
  assert.equal(memoryState({ memorised: true, lastFromMemory: '2026-10-24' }, '2026-10-26').daysSince, 2);
  assert.equal(memoryState({ memorised: true, lastFromMemory: '2026-03-28' }, '2026-03-30').daysSince, 2);
});

test('a date in the future, or garbage, cannot give a negative or broken count', () => {
  assert.equal(memoryState({ memorised: true, lastFromMemory: '2026-11-05' }, TODAY).daysSince, 0);
  const s = memoryState({ memorised: true, lastFromMemory: 'yesterday', memorisedAt: 42 }, TODAY);
  assert.equal(s.lastPlayed, null);
  assert.equal(s.since, null);
  assert.match(s.line, /Not yet played/);
});

test('marking memorised sets the date once, and unmarking keeps the history', () => {
  const marked = withMemorised({ id: 'a', title: 'Sonatina' }, true, '2026-10-10');
  assert.deepEqual(marked, { id: 'a', title: 'Sonatina', memorised: true, memorisedAt: '2026-10-10' });
  const again = withMemorised(marked, true, '2026-10-20');
  assert.equal(again.memorisedAt, '2026-10-10');
  const off = withMemorised({ ...marked, lastFromMemory: '2026-10-15' }, false, TODAY);
  assert.equal(off.memorised, false);
  assert.equal(off.memorisedAt, '2026-10-10');
  assert.equal(off.lastFromMemory, '2026-10-15');
  assert.equal(withMemorised(off, true, TODAY).memorisedAt, '2026-10-10');
});

test('playing from memory marks the piece memorised and stamps today', () => {
  const p = withPlayedFromMemory({ id: 'a' }, TODAY);
  assert.equal(p.memorised, true);
  assert.equal(p.memorisedAt, TODAY);
  assert.equal(p.lastFromMemory, TODAY);
  const later = withPlayedFromMemory({ id: 'a', memorised: true, memorisedAt: '2026-09-01', lastFromMemory: '2026-10-01' }, TODAY);
  assert.equal(later.memorisedAt, '2026-09-01');
  assert.equal(later.lastFromMemory, TODAY);
});

test('it never changes the piece it was given', () => {
  const p = Object.freeze({ id: 'a' });
  assert.doesNotThrow(() => { withMemorised(p, true, TODAY); withPlayedFromMemory(p, TODAY); });
});

test('memorisedIds lists only the memorised pieces', () => {
  const ids = memorisedIds([{ id: 'a', memorised: true }, { id: 'b' }, { id: 'c', memorised: false }, null]);
  assert.deepEqual([...ids], ['a']);
  assert.equal(memorisedIds(undefined).size, 0);
});
