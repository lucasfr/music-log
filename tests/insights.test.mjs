// Tests for the practice insights (src/utils/insights.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/insights.js'), 'utf8');
const { tempoProgress, describeTempo, staleScales, agoLabel } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const session = (date, segments) => ({ id: date, date, segments });
const rep = (compositionId, tempo, extra = {}) => ({ type: 'repertoire', compositionId, tempo, ...extra });
const tech = (group, title, tempo, extra = {}) => ({ type: 'technique', group, title, tempo, ...extra });

// ── tempo progression ────────────────────────────────────────────────────────────────────

test('a piece is followed over time, against its reference tempo', () => {
  const sessions = [
    session('2026-09-01', [rep('c1', 60)]),
    session('2026-09-15', [rep('c1', 72)]),
    session('2026-10-01', [rep('c1', 80)]),
  ];
  const [p] = tempoProgress(sessions, [{ id: 'c1', title: 'Minuet in F', tempo: '92' }]);
  assert.equal(p.name, 'Minuet in F');
  assert.deepEqual(p.points.map(x => x.bpm), [60, 72, 80]);
  assert.equal(p.first, 60);
  assert.equal(p.latest, 80);
  assert.equal(p.change, 20);
  assert.equal(p.target, 92);
  assert.equal(p.reachedTarget, false);
  assert.ok(Math.abs(p.fractionOfTarget - 80 / 92) < 1e-9);
});

test('latest is the most recent date, not the fastest, and best is the fastest', () => {
  const sessions = [session('2026-09-01', [rep('c1', 90)]), session('2026-10-01', [rep('c1', 70)])];
  const [p] = tempoProgress(sessions, []);
  assert.equal(p.latest, 70);
  assert.equal(p.best, 90);
  assert.equal(p.change, -20);
});

test('sessions are read in date order whatever order they are given in', () => {
  const sessions = [session('2026-10-01', [rep('c1', 80)]), session('2026-09-01', [rep('c1', 60)])];
  const [p] = tempoProgress(sessions, []);
  assert.deepEqual(p.points.map(x => x.date), ['2026-09-01', '2026-10-01']);
  assert.equal(p.latest, 80);
});

test('two entries on one day count once, the faster', () => {
  const sessions = [session('2026-10-01', [rep('c1', 70)]), { id: 'b', date: '2026-10-01', segments: [rep('c1', 76)] }];
  const [p] = tempoProgress(sessions, []);
  assert.deepEqual(p.points, [{ date: '2026-10-01', bpm: 76 }]);
});

test('reaching the target is recognised, and the fraction never goes above 1', () => {
  const [p] = tempoProgress([session('2026-10-01', [rep('c1', 100)])], [{ id: 'c1', title: 'X', tempo: 92 }]);
  assert.equal(p.reachedTarget, true);
  assert.equal(p.fractionOfTarget, 1);
});

test('a piece with no reference tempo has no target', () => {
  const [p] = tempoProgress([session('2026-10-01', [rep('c1', 80)])], [{ id: 'c1', title: 'X' }]);
  assert.equal(p.target, null);
  assert.equal(p.fractionOfTarget, null);
  assert.equal(p.reachedTarget, false);
});

test('segments with no tempo, or a blank or zero one, are ignored', () => {
  const sessions = [session('2026-10-01', [rep('c1', ''), rep('c1', 0), rep('c1', null), rep('c1', 'abc'), rep('c1', undefined)])];
  assert.deepEqual(tempoProgress(sessions, []), []);
});

test('tempo typed as text is read as a number', () => {
  const [p] = tempoProgress([session('2026-10-01', [rep('c1', '84')])], []);
  assert.equal(p.latest, 84);
});

test('different technique exercises are different series; the same label is one', () => {
  const sessions = [
    session('2026-10-01', [tech('Hanon', 'Hanon 1', 80), tech('Hanon', 'Hanon 2', 60)]),
    session('2026-10-05', [tech('Hanon', 'hanon 1', 88)]), // different case, same exercise
  ];
  const out = tempoProgress(sessions, []);
  assert.equal(out.length, 2);
  const h1 = out.find(p => p.name === 'Hanon · Hanon 1');
  assert.deepEqual(h1.points.map(x => x.bpm), [80, 88]);
});

test('a repertoire segment with no library piece is followed by its title; with neither it is skipped', () => {
  const sessions = [
    session('2026-10-01', [{ type: 'repertoire', title: 'Gymnopédie', tempo: 66 }]),
    session('2026-10-08', [{ type: 'repertoire', title: 'gymnopédie', tempo: 70 }, { type: 'repertoire', tempo: 90 }]),
  ];
  const out = tempoProgress(sessions, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].change, 4);
});

test('the most recently practised comes first', () => {
  const sessions = [session('2026-09-01', [rep('old', 60)]), session('2026-10-10', [rep('new', 60)])];
  assert.deepEqual(tempoProgress(sessions, [{ id: 'old', title: 'Old' }, { id: 'new', title: 'New' }]).map(p => p.name), ['New', 'Old']);
});

test('describeTempo reads naturally', () => {
  const sessions = [session('2026-09-01', [rep('c1', 72)]), session('2026-10-01', [rep('c1', 88)])];
  const [p] = tempoProgress(sessions, [{ id: 'c1', title: 'X', tempo: 96 }]);
  assert.equal(describeTempo(p), '72 → 88 bpm (+16), 8 short of 96');
  const [one] = tempoProgress([session('2026-10-01', [rep('c2', 76)])], []);
  assert.equal(describeTempo(one), '76 bpm');
  const [done] = tempoProgress([session('2026-10-01', [rep('c3', 100)])], [{ id: 'c3', title: 'Z', tempo: 92 }]);
  assert.equal(describeTempo(done), '100 bpm, at the 92 target');
});

// ── scale staleness ──────────────────────────────────────────────────────────────────────────

const scales = (group, ...names) => ({ type: 'technique', group, scales: names.map(n => (typeof n === 'string' ? n : n)) });
const TODAY = '2026-10-19';

test('a scale not played for two weeks is stale; a recent one is not', () => {
  const sessions = [
    session('2026-09-20', [scales('Scales', 'Bb major')]),                       // 29 days
    session('2026-10-15', [scales('Scales', { scale: 'Eb major', octaves: 2 })]), // 4 days
  ];
  const out = staleScales(sessions, TODAY);
  assert.deepEqual(out.map(x => x.name), ['Bb major']);
  assert.equal(out[0].daysSince, 29);
});

test('the latest time counts, not the first', () => {
  const sessions = [session('2026-08-01', [scales('Scales', 'C major')]), session('2026-10-17', [scales('Scales', 'C major')])];
  assert.deepEqual(staleScales(sessions, TODAY), []);
  assert.equal(staleScales(sessions, TODAY, 1)[0].times, 2);
});

test('a scale and an arpeggio in the same key are tracked separately', () => {
  const sessions = [
    session('2026-09-01', [scales('Arpeggios', 'Bb major')]),
    session('2026-10-18', [scales('Scales', 'Bb major')]),
  ];
  const out = staleScales(sessions, TODAY);
  assert.deepEqual(out.map(x => `${x.kind}:${x.name}`), ['Arpeggios:Bb major']);
});

test('legacy plain-string entries and object entries are both read', () => {
  const sessions = [session('2026-08-01', [scales('Scales', 'A natural minor', { scale: 'E major', motion: 'contrary', octaves: 2 })])];
  assert.deepEqual(staleScales(sessions, TODAY).map(x => x.name).sort(), ['A natural minor', 'E major']);
});

test('the most overdue comes first, ties by name', () => {
  const sessions = [
    session('2026-09-01', [scales('Scales', 'B major')]),
    session('2026-08-01', [scales('Scales', 'F major', 'A major')]),
  ];
  assert.deepEqual(staleScales(sessions, TODAY).map(x => x.name), ['A major', 'F major', 'B major']);
});

test('only Scales and Arpeggios segments count, and future-dated entries are ignored', () => {
  const sessions = [
    session('2026-08-01', [{ type: 'technique', group: 'Hanon', scales: ['C major'] }, { type: 'repertoire', scales: ['D major'] }]),
    session('2026-12-01', [scales('Scales', 'G major')]),
  ];
  assert.deepEqual(staleScales(sessions, TODAY), []);
});

test('nothing logged gives nothing, and missing fields do not throw', () => {
  assert.deepEqual(staleScales([], TODAY), []);
  assert.deepEqual(staleScales(undefined, TODAY), []);
  assert.deepEqual(staleScales([session('2026-08-01', [{ group: 'Scales' }, { group: 'Scales', scales: null }])], TODAY), []);
});

test('day counting is by calendar date across the clocks going forward', () => {
  // UK clocks went forward on 29 Mar 2026, so that day has 23 hours. 2026-03-20 to 2026-04-03 is
  // 14 days, but a count made from milliseconds says 13.96 and rounds down to 13.
  const sessions = [session('2026-03-20', [scales('Scales', 'D major')])];
  assert.equal(staleScales(sessions, '2026-04-03', 14)[0].daysSince, 14);
});

test('agoLabel', () => {
  assert.equal(agoLabel(1), '1 day ago');
  assert.equal(agoLabel(9), '9 days ago');
  assert.equal(agoLabel(21), '3 weeks ago');
  assert.equal(agoLabel(75), '2 months ago');
});
