import test from 'node:test';
import assert from 'node:assert/strict';
import { describeConflictChanges } from '../src/utils/conflictDiff.js';

const base = { id: 's1', date: '2026-10-20', duration: 30, energy: 1, wins: 'Clean run', segments: [{ id: 'a', duration: 30 }], updated_at: '2026-10-20T10:00:00.000Z', created_at: '2026-10-20T09:00:00.000Z' };

test('a changed number reads as kept versus this copy, with its unit', () => {
  assert.deepEqual(describeConflictChanges(base, { ...base, duration: 25 }), ['duration: 30 min kept, 25 min in this copy']);
});

test('timestamps and ids never count as a difference', () => {
  const out = describeConflictChanges(base, { ...base, updated_at: '2026-10-21T10:00:00.000Z', created_at: 'x', id: 'other' });
  assert.deepEqual(out, ['The same content, saved at a different time.']);
});

test('long text says it differs rather than quoting it', () => {
  assert.deepEqual(describeConflictChanges(base, { ...base, wins: 'Something quite different and long' }), ['wins differ']);
  assert.deepEqual(describeConflictChanges({ notes: 'a' }, { notes: 'b' }), ['notes differ']);
});

test('a value present on one side and missing on the other reads as "nothing"', () => {
  assert.deepEqual(describeConflictChanges({ ...base, tempo: undefined }, { ...base, tempo: 80 }), ['tempo: nothing kept, 80 bpm in this copy']);
  assert.deepEqual(describeConflictChanges(base, { ...base, energy: 0 }), ['energy: 1 kept, 0 in this copy']);
});

test('segments: a different count is stated, the same count says the details differ', () => {
  const more = { ...base, segments: [{ id: 'a' }, { id: 'b' }] };
  assert.deepEqual(describeConflictChanges(base, more), ['1 segment kept, 2 in this copy']);
  assert.deepEqual(describeConflictChanges(base, { ...base, segments: [{ id: 'a', duration: 20 }] }), ['segment details differ']);
});

test('tricky spots and booleans', () => {
  assert.deepEqual(describeConflictChanges({ spots: [{}, {}] }, { spots: [{}] }), ['2 tricky spots kept, 1 in this copy']);
  assert.deepEqual(describeConflictChanges({ memorised: true }, { memorised: false }), ['memorised: yes kept, no in this copy']);
});

test('named fields come before unnamed ones, at most four are listed, then "and N more"', () => {
  const kept = { a1: 1, a2: 1, a3: 1, duration: 10, energy: 1, wins: 'x' };
  const saved = { a1: 2, a2: 2, a3: 2, duration: 20, energy: 2, wins: 'y' };
  const out = describeConflictChanges(kept, saved);
  assert.equal(out.length, 5);
  assert.match(out[0], /^duration:/);
  assert.match(out[4], /^and 2 more$/);
});

test('unfamiliar camelCase fields are made readable', () => {
  assert.deepEqual(describeConflictChanges({ someNewField: [1] }, { someNewField: [2] }), ['some new field: 1 kept, 2 in this copy']);
});

test('an entry deleted since: the line says restoring brings it back', () => {
  assert.deepEqual(describeConflictChanges(undefined, base), ['The entry has been deleted since; using this copy brings it back.']);
  assert.deepEqual(describeConflictChanges(null, base).length, 1);
});

test('nothing to compare gives nothing', () => {
  assert.deepEqual(describeConflictChanges(base, null), []);
  assert.deepEqual(describeConflictChanges(base, undefined), []);
});

test('it never changes the records it is given', () => {
  const a = Object.freeze({ ...base, segments: Object.freeze([...base.segments]) });
  const b = Object.freeze({ ...base, duration: 5 });
  assert.doesNotThrow(() => describeConflictChanges(a, b));
});
