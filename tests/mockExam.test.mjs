import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shuffled, buildMockExam, formatElapsed, summariseMockExam, DEFAULT_SCALES, DEFAULT_ARPEGGIOS } from '../src/utils/mockExam.js';

const req = (name, extra = {}) => ({ name, motion: 'parallel', octaves: 2, interval: 'unison', ...extra });
const R = {
  scales: ['C major', 'G major', 'D major', 'A major', 'E major', 'F major'].map(n => req(n)),
  arpeggios: ['C major', 'G major', 'A minor'].map(n => req(n, { group: 'Arpeggios' })),
  pieces: { needed: 3, list: [{ id: 'a', title: 'Sonatina' }, { id: 'b', title: 'Prelude' }] },
};

test('the same seed gives the same exam, and different seeds differ', () => {
  const a = buildMockExam(R, makeRng(1)).map(i => i.label);
  const b = buildMockExam(R, makeRng(1)).map(i => i.label);
  const c = buildMockExam(R, makeRng(2)).map(i => i.label);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('makeRng stays inside [0, 1)', () => {
  const rng = makeRng(42);
  for (let i = 0; i < 1000; i++) { const v = rng(); assert.ok(v >= 0 && v < 1); }
});

test('shuffled keeps every item once and leaves the original alone', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffled(list, makeRng(7));
  assert.deepEqual([...out].sort((x, y) => x - y), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(shuffled(undefined), []);
});

test('the shuffle is fair: every item lands first about equally often', () => {
  const counts = [0, 0, 0, 0];
  const rng = makeRng(99);
  for (let i = 0; i < 4000; i++) counts[shuffled([0, 1, 2, 3], rng)[0]]++;
  counts.forEach(c => assert.ok(c > 850 && c < 1150, `count ${c}`));
});

test('an exam is scales, then arpeggios, then pieces, then sight-reading', () => {
  const items = buildMockExam(R, makeRng(3));
  assert.deepEqual(items.map(i => i.kind), [
    ...Array(DEFAULT_SCALES).fill('scale'), ...Array(DEFAULT_ARPEGGIOS).fill('arpeggio'), 'piece', 'piece', 'sight',
  ]);
  assert.equal(items[items.length - 1].label, 'Sight-reading');
});

test('no scale or arpeggio is asked twice', () => {
  for (let seed = 0; seed < 50; seed++) {
    const items = buildMockExam(R, makeRng(seed), { scales: 6, arpeggios: 3 });
    const scales = items.filter(i => i.kind === 'scale').map(i => i.label);
    assert.equal(new Set(scales).size, 6);
  }
});

test('it asks for fewer than the setting when the target has fewer', () => {
  const small = { scales: [req('C major')], arpeggios: [], pieces: { needed: 0, list: [] } };
  const items = buildMockExam(small, makeRng(1));
  assert.deepEqual(items.map(i => i.kind), ['scale', 'sight']);
});

test('pieces come from the target\'s list, or are numbered when none are in the library', () => {
  assert.deepEqual(buildMockExam(R, makeRng(1)).filter(i => i.kind === 'piece').map(i => i.label), ['Sonatina', 'Prelude']);
  const none = { ...R, pieces: { needed: 3, list: [] } };
  assert.deepEqual(buildMockExam(none, makeRng(1)).filter(i => i.kind === 'piece').map(i => i.label), ['Piece 1', 'Piece 2', 'Piece 3']);
});

test('an empty or missing target still gives a sight-reading item and does not throw', () => {
  assert.deepEqual(buildMockExam(null, makeRng(1)), [{ kind: 'sight', label: 'Sight-reading' }]);
  assert.deepEqual(buildMockExam({}, makeRng(1)), [{ kind: 'sight', label: 'Sight-reading' }]);
});

test('describe is used for the labels', () => {
  const items = buildMockExam(R, makeRng(1), { scales: 1, arpeggios: 0, describe: q => `${q.name}!` });
  assert.match(items[0].label, /!$/);
});

test('formatElapsed', () => {
  assert.equal(formatElapsed(5), '0:05');
  assert.equal(formatElapsed(75), '1:15');
  assert.equal(formatElapsed(600), '10:00');
  assert.equal(formatElapsed(3725), '1:02:05');
  assert.equal(formatElapsed(-3), '0:00');
  assert.equal(formatElapsed(undefined), '0:00');
  assert.equal(formatElapsed(59.9), '0:59');
});

test('summariseMockExam: totals, what needs work, and the slowest item', () => {
  const items = [{ kind: 'scale', label: 'C major, 2 oct' }, { kind: 'piece', label: 'Sonatina' }, { kind: 'sight', label: 'Sight-reading' }];
  const s = summariseMockExam(items, { 0: true, 2: true }, [20, 150, 40]);
  assert.equal(s.total, 210);
  assert.equal(s.count, 3);
  assert.deepEqual(s.needsWork, ['C major, 2 oct', 'Sight-reading']);
  assert.deepEqual(s.slowest, { label: 'Sonatina', seconds: 150 });
  assert.equal(s.line, '3 items in 3:30. 2 to work on.');
});

test('summariseMockExam with nothing flagged, no times, and no items', () => {
  const items = [{ kind: 'scale', label: 'A' }];
  assert.equal(summariseMockExam(items, {}, [30]).line, '1 item in 0:30. Nothing flagged.');
  assert.equal(summariseMockExam(items, undefined, undefined).slowest, null);
  assert.deepEqual(summariseMockExam(undefined, undefined, undefined), { total: 0, count: 0, needsWork: [], needsWorkItems: [], slowest: null, line: '0 items in 0:00. Nothing flagged.' });
});
