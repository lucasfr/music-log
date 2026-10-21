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
  DYNAMICS_OPTIONS, DYNAMICS_LABELS, dynamicsOf, toggleDynamic, formatDynamics, selectionOf, toggleFilter,
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
  assert.deepEqual(out.activeArticulations, ['staccato']);
  assert.deepEqual(out.sorted.map(([n]) => n).sort(), ['A', 'B']);
});

test('a filter with no data here is left out, so nothing on means everything rather than an empty chart', () => {
  const sessions = [session(tech({ group: 'A', articulation: { rh: 'legato', lh: 'legato' } }), tech({ group: 'B' }))];
  const out = techniqueBreakdown(sessions, 'staccato', OPTIONS);
  assert.deepEqual(out.activeArticulations, []);
  assert.equal(out.sorted.length, 2);
  assert.deepEqual(techniqueBreakdown(sessions, 'not-a-thing', OPTIONS).activeArticulations, []);
});

test('no technique means nothing to show, and missing input does not throw', () => {
  assert.deepEqual(techniqueBreakdown([session({ type: 'repertoire' })], 'all', OPTIONS).sorted, []);
  assert.deepEqual(techniqueBreakdown(undefined, 'all', OPTIONS), { available: [], activeArticulations: [], availableDynamics: [], activeDynamics: [], sorted: [] });
  assert.deepEqual(techniqueBreakdown([], 'all', undefined).available, []);
});

// ── dynamics ────────────────────────────────────────────────────────────────────────────

test('every dynamic has a label, in the order they are shown', () => {
  assert.deepEqual(DYNAMICS_OPTIONS, ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'crescendo', 'diminuendo']);
  for (const k of DYNAMICS_OPTIONS) assert.ok(DYNAMICS_LABELS[k], k);
  assert.equal(Object.keys(DYNAMICS_LABELS).length, DYNAMICS_OPTIONS.length);
});

test('the dynamics on a segment are only the known ones, once each, in the usual order', () => {
  assert.deepEqual(dynamicsOf({ dynamics: ['f', 'p'] }), ['p', 'f']);
  assert.deepEqual(dynamicsOf({ dynamics: ['mf', 'mf', 'loud', 'diminuendo', 'crescendo'] }), ['mf', 'crescendo', 'diminuendo']);
  for (const none of [{}, { dynamics: null }, { dynamics: 'p' }, { dynamics: {} }, { dynamics: [] }, undefined, null]) assert.deepEqual(dynamicsOf(none), []);
});

test('tapping a dynamic adds it, tapping it again removes it, and the list stays in order', () => {
  assert.deepEqual(toggleDynamic(null, 'p'), ['p']);
  assert.deepEqual(toggleDynamic(['p'], 'f'), ['p', 'f']);
  assert.deepEqual(toggleDynamic(['f'], 'p'), ['p', 'f'], 'added in the order of the options, not the order tapped');
  assert.deepEqual(toggleDynamic(['p', 'f'], 'p'), ['f']);
  assert.deepEqual(toggleDynamic(['p'], 'p'), [], 'nothing left');
  assert.deepEqual(toggleDynamic(undefined, 'crescendo'), ['crescendo']);
});

test('tapping something that is not a dynamic changes nothing', () => {
  assert.deepEqual(toggleDynamic(['p'], 'loud'), ['p']);
  assert.deepEqual(toggleDynamic(['p', 'junk'], 'f'), ['p', 'f'], 'stored junk is dropped on the way');
});

test('dynamics read naturally, and are null when there are none', () => {
  assert.equal(formatDynamics({ dynamics: ['mf'] }), 'mf');
  assert.equal(formatDynamics({ dynamics: ['f', 'p'] }), 'p, f');
  assert.equal(formatDynamics({ dynamics: ['diminuendo', 'crescendo'] }), 'Crescendo, Diminuendo');
  assert.equal(formatDynamics({}), null);
  assert.equal(formatDynamics({ dynamics: [] }), null);
  assert.equal(formatDynamics(undefined), null);
});

test('the technique breakdown offers only the dynamics that exist, and filters by them', () => {
  const sessions = [session(
    tech({ group: 'Hanon', dynamics: ['p'] }), tech({ group: 'Hanon', dynamics: ['f', 'p'] }),
    tech({ group: 'Scales', dynamics: ['crescendo'] }), tech({ group: 'Other' }),
    { type: 'repertoire', dynamics: ['ff'] },
  )];
  const all = techniqueBreakdown(sessions, 'all', OPTIONS);
  assert.deepEqual(all.availableDynamics, ['p', 'f', 'crescendo'], 'the piece\'s ff does not count, and the order is the usual one');
  assert.deepEqual(all.activeDynamics, []);
  const p = techniqueBreakdown(sessions, 'all', OPTIONS, 'p');
  assert.deepEqual(p.activeDynamics, ['p']);
  assert.deepEqual(p.sorted.map(([n, g]) => [n, g.count]), [['Hanon', 2]]);
  assert.deepEqual(techniqueBreakdown(sessions, 'all', OPTIONS, 'crescendo').sorted.map(([n]) => n), ['Scales']);
});

test('a dynamics filter with no data here is left out, and the two filters combine', () => {
  const sessions = [session(
    tech({ group: 'A', dynamics: ['p'], articulation: { rh: 'legato', lh: 'legato' } }),
    tech({ group: 'B', dynamics: ['p'], articulation: { rh: 'staccato', lh: 'staccato' } }),
    tech({ group: 'C', dynamics: ['f'], articulation: { rh: 'legato', lh: 'legato' } }),
  )];
  assert.deepEqual(techniqueBreakdown(sessions, 'all', OPTIONS, 'ff').activeDynamics, []);
  assert.equal(techniqueBreakdown(sessions, 'all', OPTIONS, 'ff').sorted.length, 3);
  const both = techniqueBreakdown(sessions, 'legato', OPTIONS, 'p');
  assert.deepEqual(both.sorted.map(([n]) => n), ['A'], 'legato AND piano');
});

// ── filters as toggles ──────────────────────────────────────────────────────────────────────────

test('a filter is a list of the choices on; the older single value still works', () => {
  assert.deepEqual(selectionOf(['a', 'b']), ['a', 'b']);
  assert.deepEqual(selectionOf([]), []);
  assert.deepEqual(selectionOf('all'), [], '"all" is nothing switched on');
  assert.deepEqual(selectionOf(undefined), []);
  assert.deepEqual(selectionOf(null), []);
  assert.deepEqual(selectionOf('legato'), ['legato']);
  assert.deepEqual(selectionOf(2), [2], 'octaves are numbers');
  assert.deepEqual(selectionOf(['all', 'a', null]), ['a'], 'a leftover "all" or empty entry is ignored');
});

test('tapping a toggle switches it on, tapping it again switches it off, and the others are left alone', () => {
  assert.deepEqual(toggleFilter([], 'legato'), ['legato']);
  assert.deepEqual(toggleFilter(['legato'], 'staccato'), ['legato', 'staccato']);
  assert.deepEqual(toggleFilter(['legato', 'staccato'], 'legato'), ['staccato']);
  assert.deepEqual(toggleFilter(['legato'], 'legato'), [], 'switching the last one off means everything again');
  assert.deepEqual(toggleFilter('all', 'p'), ['p'], 'from the older "nothing chosen" value');
  assert.deepEqual(toggleFilter([1], 2), [1, 2], 'numbers too');
});

test('several articulations on at once show segments with any of them, in either hand', () => {
  const sessions = [session(
    tech({ group: 'A', articulation: { rh: 'legato', lh: 'legato' } }),
    tech({ group: 'B', articulation: { rh: 'staccato', lh: 'legato' } }),
    tech({ group: 'C', articulation: { rh: 'tenuto', lh: 'tenuto' } }),
    tech({ group: 'D' }),
  )];
  const out = techniqueBreakdown(sessions, ['staccato', 'tenuto'], OPTIONS);
  assert.deepEqual(out.activeArticulations, ['staccato', 'tenuto']);
  assert.deepEqual(out.sorted.map(([n]) => n).sort(), ['B', 'C']);
  assert.deepEqual(techniqueBreakdown(sessions, ['legato', 'tenuto'], OPTIONS).sorted.map(([n]) => n).sort(), ['A', 'B', 'C']);
  assert.equal(techniqueBreakdown(sessions, [], OPTIONS).sorted.length, 4, 'nothing on is everything');
});

test('several dynamics on at once show segments with any of them', () => {
  const sessions = [session(
    tech({ group: 'A', dynamics: ['p'] }), tech({ group: 'B', dynamics: ['f', 'crescendo'] }),
    tech({ group: 'C', dynamics: ['mf'] }), tech({ group: 'D' }),
  )];
  assert.deepEqual(techniqueBreakdown(sessions, [], OPTIONS, ['p', 'crescendo']).sorted.map(([n]) => n).sort(), ['A', 'B']);
  assert.deepEqual(techniqueBreakdown(sessions, [], OPTIONS, ['p', 'crescendo']).activeDynamics, ['p', 'crescendo']);
});

test('the articulation and dynamics filters apply together: any articulation chosen AND any dynamic chosen', () => {
  const sessions = [session(
    tech({ group: 'A', articulation: { rh: 'legato', lh: 'legato' }, dynamics: ['p'] }),
    tech({ group: 'B', articulation: { rh: 'staccato', lh: 'staccato' }, dynamics: ['f'] }),
    tech({ group: 'C', articulation: { rh: 'legato', lh: 'legato' }, dynamics: ['f'] }),
    tech({ group: 'D', articulation: { rh: 'tenuto', lh: 'tenuto' }, dynamics: ['p'] }),
  )];
  const out = techniqueBreakdown(sessions, ['legato', 'staccato'], OPTIONS, ['p']);
  assert.deepEqual(out.sorted.map(([n]) => n), ['A'], 'legato or staccato, and piano');
  assert.deepEqual(techniqueBreakdown(sessions, ['legato', 'staccato'], OPTIONS, ['p', 'f']).sorted.map(([n]) => n).sort(), ['A', 'B', 'C']);
});

test('choices with no data are dropped, and if none are left it shows everything', () => {
  const sessions = [session(tech({ group: 'A', articulation: { rh: 'legato', lh: 'legato' }, dynamics: ['p'] }), tech({ group: 'B' }))];
  const out = techniqueBreakdown(sessions, ['legato', 'accented'], OPTIONS, ['p', 'ff']);
  assert.deepEqual(out.activeArticulations, ['legato']);
  assert.deepEqual(out.activeDynamics, ['p']);
  const none = techniqueBreakdown(sessions, ['accented'], OPTIONS, ['ff']);
  assert.deepEqual([none.activeArticulations, none.activeDynamics], [[], []]);
  assert.equal(none.sorted.length, 2);
});

test('scale coverage with several choices on shows entries with any of them', () => {
  const sessions = [session(
    tech({ scales: [{ scale: 'C major', motion: 'parallel', octaves: 1 }, { scale: 'D major', motion: 'contrary', octaves: 2 }, { scale: 'E major', motion: 'parallel', octaves: 4 }] }),
    tech({ octaves: 3, scales: [{ scale: 'F major', interval: 'third' }, { scale: 'G major', interval: 'sixth' }, { scale: 'A major', interval: 'tenth' }] }),
  )];
  const keys = f => Object.keys(scaleCoverage(sessions, f).counts).sort();
  assert.deepEqual(keys({ octaves: [1, 2] }), ['C', 'D']);
  assert.deepEqual(keys({ octaves: [3, 4] }), ['A', 'E', 'F', 'G']);
  assert.deepEqual(keys({ interval: ['third', 'sixth'] }), ['F', 'G']);
  assert.deepEqual(keys({ motion: ['contrary'] }), ['D']);
  assert.deepEqual(keys({ interval: ['third', 'tenth'], motion: [] }), ['A', 'F'], 'an empty list is no filter');
});

test('scale coverage filters combine: any of the motions AND any of the octaves', () => {
  const sessions = [session(tech({ scales: [
    { scale: 'C major', motion: 'parallel', octaves: 1 }, { scale: 'D major', motion: 'contrary', octaves: 1 },
    { scale: 'E major', motion: 'parallel', octaves: 2 }, { scale: 'F major', motion: 'contrary', octaves: 2 },
  ] }))];
  const keys = f => Object.keys(scaleCoverage(sessions, f).counts).sort();
  assert.deepEqual(keys({ motion: ['contrary'], octaves: [1, 2] }), ['D', 'F']);
  assert.deepEqual(keys({ motion: ['parallel', 'contrary'], octaves: [2] }), ['E', 'F']);
  assert.deepEqual(keys({ motion: ['parallel', 'contrary'], octaves: [1, 2] }), ['C', 'D', 'E', 'F']);
});
