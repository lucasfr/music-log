// Tests for scale entries, scale coverage and the technique breakdown (src/utils/scaleStats.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/scaleStats.js'), 'utf8');
const {
  scaleName, scaleMotion, scaleInterval, scaleOctaves, articulationOf,
  COF_KEYS, COF_MINORS, SCALE_LABEL_TO_COF, scaleCoverage, techniqueBreakdown,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const session = (...segments) => ({ id: 's', date: '2026-10-19', segments });
const tech = (extra = {}) => ({ type: 'technique', group: 'Scales', duration: 10, ...extra });
const OPTIONS = ['legato', 'non-legato', 'staccato', 'staccatissimo', 'portato', 'tenuto', 'accented'];

// ── scale entries ───────────────────────────────────────────────────────────────────────────

test('a plain string and an object entry read the same way', () => {
  assert.equal(scaleName('C major'), 'C major');
  assert.equal(scaleName({ scale: 'D major' }), 'D major');
  assert.equal(scaleMotion('C major'), 'parallel');
  assert.equal(scaleInterval('C major'), 'unison');
  assert.equal(scaleOctaves('C major', 3), 3, 'a plain string has no octaves of its own, so the segment\'s are used');
});

test('missing or empty fields on an object entry fall back to the defaults', () => {
  const e = { scale: 'E major', motion: '', octaves: 0, interval: '' };
  assert.equal(scaleMotion(e), 'parallel');
  assert.equal(scaleInterval(e), 'unison');
  assert.equal(scaleOctaves(e, 2), 2);
  assert.equal(scaleOctaves({ scale: 'E', octaves: 4 }, 2), 4);
  assert.equal(scaleMotion({ scale: 'E', motion: 'contrary' }), 'contrary');
  assert.equal(scaleInterval({ scale: 'E', interval: 'third' }), 'third');
});

test('articulation reads { rh, lh } and is empty on old segments', () => {
  assert.deepEqual(articulationOf({ articulation: { rh: 'legato', lh: 'staccato' } }), { rh: 'legato', lh: 'staccato' });
  assert.deepEqual(articulationOf({ articulation: { rh: 'legato' } }), { rh: 'legato', lh: null });
  assert.deepEqual(articulationOf({}), { rh: null, lh: null });
  assert.deepEqual(articulationOf(undefined), { rh: null, lh: null });
  assert.deepEqual(articulationOf({ articulation: null }), { rh: null, lh: null });
});

test('the circle of fifths has twelve major and twelve minor keys, and every label maps onto one of them', () => {
  assert.equal(COF_KEYS.length, 12);
  assert.equal(COF_MINORS.length, 12);
  const known = new Set([...COF_KEYS, ...COF_MINORS]);
  const stray = Object.entries(SCALE_LABEL_TO_COF).filter(([, key]) => !known.has(key));
  assert.deepEqual(stray, []);
  assert.equal(SCALE_LABEL_TO_COF['Gb major'], 'F#', 'the enharmonic spelling lands on the same key');
  assert.equal(SCALE_LABEL_TO_COF['A harmonic minor'], SCALE_LABEL_TO_COF['A natural minor']);
  assert.equal(SCALE_LABEL_TO_COF['C dominant 7th'], 'C', 'arpeggios of 7th chords are placed by their tonic');
});

// ── scale coverage ──────────────────────────────────────────────────────────────────────────

test('each key counts the segments that practised it, with its minutes and difficulty', () => {
  const sessions = [
    session(tech({ scales: ['C major', 'G major'], duration: 20, feltDifficulty: 2 }), tech({ scales: ['C major'], duration: 10, feltDifficulty: 4 })),
  ];
  const c = scaleCoverage(sessions);
  assert.equal(c.counts.C.sessions, 2);
  assert.equal(c.counts.G.sessions, 1);
  assert.equal(c.counts.C.minutes, 10 + 10, 'half of the 20-minute segment plus all of the 10-minute one');
  assert.equal(c.counts.G.minutes, 10);
  assert.deepEqual(c.counts.C.difficulty, [2, 4]);
  assert.equal(c.totalMinutes, 30, 'the segments\' real minutes, not shared out');
  assert.equal(c.totalSessions, 3);
  assert.equal(c.keysVisited, 2);
  assert.equal(c.avgDifficulty, (2 + 2 + 4) / 3, 'the shared 2 counts under each key it covers');
  assert.equal(c.maxCount, 2);
  assert.equal(c.majorCounts[COF_KEYS.indexOf('C')], 2);
});

test('two scales in the same key within one segment count that key once', () => {
  const c = scaleCoverage([session(tech({ scales: ['A natural minor', 'A harmonic minor', 'A melodic minor'], duration: 15 }))]);
  assert.equal(c.counts.Am.sessions, 1);
  assert.equal(c.counts.Am.minutes, 15);
  assert.equal(c.minorCounts[COF_MINORS.indexOf('Am')], 1);
});

test('only technique segments count, and labels that are not on the circle are ignored', () => {
  const sessions = [session(
    { type: 'repertoire', scales: ['C major'], duration: 30 },
    tech({ scales: ['Whole tone', 'Blues'], duration: 10 }),
    tech({ scales: undefined, duration: 10 }),
  )];
  const c = scaleCoverage(sessions);
  assert.equal(c.totalSessions, 0);
  assert.equal(c.totalMinutes, 0);
  assert.equal(c.keysVisited, 0);
  assert.equal(c.avgDifficulty, null);
  assert.equal(c.maxCount, 1);
  assert.equal(c.anyTechnique, true, 'there is technique, just nothing that can be placed');
  assert.equal(scaleCoverage([session({ type: 'repertoire' })]).anyTechnique, false);
  assert.equal(scaleCoverage([]).anyTechnique, false);
});

test('the filters narrow by motion, octaves and interval, using the segment\'s octaves for plain strings', () => {
  const sessions = [session(
    tech({ scales: [{ scale: 'C major', motion: 'contrary', octaves: 2 }, { scale: 'D major', motion: 'parallel', octaves: 1 }], octaves: 1 }),
    tech({ scales: ['E major'], octaves: 2 }),
    tech({ scales: [{ scale: 'F major', interval: 'third' }] }),
  )];
  assert.deepEqual(Object.keys(scaleCoverage(sessions, { motion: 'contrary' }).counts), ['C']);
  assert.deepEqual(Object.keys(scaleCoverage(sessions, { octaves: 2 }).counts).sort(), ['C', 'E'], 'E major is plain, so it takes its segment\'s 2 octaves');
  assert.deepEqual(Object.keys(scaleCoverage(sessions, { interval: 'third' }).counts), ['F']);
  assert.deepEqual(Object.keys(scaleCoverage(sessions, { motion: 'contrary', octaves: 1 }).counts), []);
  assert.equal(Object.keys(scaleCoverage(sessions).counts).length, 4);
});

test('missing durations and difficulties do not break the totals', () => {
  const c = scaleCoverage([session(tech({ scales: ['C major'], duration: undefined }), tech({ scales: ['C major'], duration: 'x', feltDifficulty: 3 }))]);
  assert.equal(c.counts.C.sessions, 2);
  assert.equal(c.totalMinutes, 0);
  assert.deepEqual(c.counts.C.difficulty, [3]);
});

// ── technique breakdown ─────────────────────────────────────────────────────────────────────

test('technique segments are grouped by group, then title, most-used first', () => {
  const sessions = [session(
    tech({ group: 'Hanon', duration: 10, feltDifficulty: 3 }), tech({ group: 'Scales' }), tech({ group: 'Hanon', duration: 5 }),
    tech({ group: undefined, title: 'Etude 1' }), tech({ group: undefined, title: undefined }),
    { type: 'repertoire', group: 'Hanon', duration: 99 },
  )];
  const { sorted } = techniqueBreakdown(sessions, 'all', OPTIONS);
  assert.deepEqual(sorted.map(([name, g]) => [name, g.count]), [['Hanon', 2], ['Scales', 1], ['Etude 1', 1], ['Technique', 1]]);
  assert.equal(sorted[0][1].minutes, 15);
  assert.deepEqual(sorted[0][1].difficulty, [3]);
});

test('the articulation filter offers only what exists, in the app\'s order', () => {
  const sessions = [session(
    tech({ articulation: { rh: 'staccato', lh: 'legato' } }),
    tech({ articulation: { rh: 'tenuto', lh: null } }),
    tech({}),
    { type: 'repertoire', articulation: { rh: 'accented', lh: 'accented' } },
  )];
  assert.deepEqual(techniqueBreakdown(sessions, 'all', OPTIONS).available, ['legato', 'staccato', 'tenuto']);
});

test('a segment matches an articulation if either hand uses it', () => {
  const sessions = [session(
    tech({ group: 'A', articulation: { rh: 'staccato', lh: 'legato' } }),
    tech({ group: 'B', articulation: { rh: 'legato', lh: 'staccato' } }),
    tech({ group: 'C', articulation: { rh: 'legato', lh: 'legato' } }),
    tech({ group: 'D' }),
  )];
  const out = techniqueBreakdown(sessions, 'staccato', OPTIONS);
  assert.equal(out.activeFilter, 'staccato');
  assert.deepEqual(out.sorted.map(([n]) => n).sort(), ['A', 'B']);
});

test('a filter with no data here falls back to all, rather than an empty chart with no way out', () => {
  const sessions = [session(tech({ group: 'A', articulation: { rh: 'legato', lh: 'legato' } }), tech({ group: 'B' }))];
  const out = techniqueBreakdown(sessions, 'staccato', OPTIONS);
  assert.equal(out.activeFilter, 'all');
  assert.equal(out.sorted.length, 2);
  assert.equal(techniqueBreakdown(sessions, 'not-a-thing', OPTIONS).activeFilter, 'all');
});

test('no technique means nothing to show, and missing input does not throw', () => {
  assert.deepEqual(techniqueBreakdown([session({ type: 'repertoire' })], 'all', OPTIONS).sorted, []);
  assert.deepEqual(techniqueBreakdown(undefined, 'all', OPTIONS), { available: [], activeFilter: 'all', sorted: [] });
  assert.deepEqual(techniqueBreakdown([], 'all', undefined).available, []);
});
