// Tests for the practice insights (src/utils/insights.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/insights.js'), 'utf8');
const {
  tempoProgress, describeTempo, staleScales, agoLabel,
  lessonAssignments, setAssignmentDone,
  suggestScope, energyLinks, describeLink,
  emptyTarget, parseTarget, serializeTarget, targetHasContent, describeRequirement, readiness, splitScales, joinScales,
} =
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

// ── lesson assignments ───────────────────────────────────────────────────────────────────────

const lesson = (id, date, segments) => ({ id, date, segments });
const aSeg = (extra) => ({ type: 'repertoire', assignment: 'Hands together, bars 1-8', ...extra });
const NOW = '2026-10-19';

test('an assignment is open until a later session practises the same piece', () => {
  const lessons = [lesson('l1', '2026-10-05', [aSeg({ id: 'g1', compositionId: 'c2' })])];
  const open = lessonAssignments(lessons, [session('2026-10-04', [rep('c2', null)])], NOW, [{ id: 'c2', title: 'Ocean View' }]);
  assert.equal(open.items[0].status, 'open', 'practice before the lesson does not count');
  assert.equal(open.items[0].label, 'Ocean View');
  assert.equal(open.open, 1);

  const covered = lessonAssignments(lessons, [session('2026-10-08', [rep('c2', null)]), session('2026-10-12', [rep('c2', null)])], NOW);
  assert.equal(covered.items[0].status, 'covered');
  assert.equal(covered.items[0].coveredOn, '2026-10-08', 'the first session after the lesson');
  assert.equal(covered.open, 0);
});

test('practice on the lesson day itself does not cover it', () => {
  const lessons = [lesson('l1', '2026-10-05', [aSeg({ id: 'g1', compositionId: 'c2' })])];
  assert.equal(lessonAssignments(lessons, [session('2026-10-05', [rep('c2')])], NOW).items[0].status, 'open');
});

test('a ticked assignment is done, even with no practice logged', () => {
  const lessons = [lesson('l1', '2026-10-05', [aSeg({ id: 'g1', compositionId: 'c2', assignmentDone: '2026-10-07' })])];
  const [it] = lessonAssignments(lessons, [], NOW).items;
  assert.equal(it.status, 'done');
  assert.equal(it.doneOn, '2026-10-07');
});

test('a technique assignment that names scales needs one of them; one that does not needs the group', () => {
  const named = lesson('l1', '2026-10-05', [{ type: 'technique', group: 'Scales', scales: [{ scale: 'Bb major' }], assignment: 'Even, slow' }]);
  const other = session('2026-10-08', [{ type: 'technique', group: 'Scales', scales: ['C major'] }]);
  const right = session('2026-10-09', [{ type: 'technique', group: 'Scales', scales: [{ scale: 'bb MAJOR', octaves: 2 }] }]);
  assert.equal(lessonAssignments([named], [other], NOW).items[0].status, 'open');
  assert.equal(lessonAssignments([named], [other, right], NOW).items[0].status, 'covered');

  const groupOnly = lesson('l2', '2026-10-05', [{ type: 'technique', group: 'Sight-reading', assignment: 'Daily' }]);
  assert.equal(lessonAssignments([groupOnly], [session('2026-10-06', [{ type: 'technique', group: 'Sight-reading' }])], NOW).items[0].status, 'covered');
  assert.equal(lessonAssignments([groupOnly], [session('2026-10-06', [{ type: 'technique', group: 'Hanon' }])], NOW).items[0].status, 'open');
});

test('an unlinked piece is matched by title', () => {
  const lessons = [lesson('l1', '2026-10-05', [aSeg({ id: 'g1', title: 'Gymnopédie' })])];
  assert.equal(lessonAssignments(lessons, [session('2026-10-06', [{ type: 'repertoire', title: 'gymnopédie' }])], NOW).items[0].status, 'covered');
});

test('segments with no assignment text are not items', () => {
  const lessons = [lesson('l1', '2026-10-05', [aSeg({ id: 'g1', assignment: '   ' }), aSeg({ id: 'g2', assignment: '' }), aSeg({ id: 'g3', assignment: undefined })])];
  assert.deepEqual(lessonAssignments(lessons, [], NOW), { items: [], open: 0, lessonDate: null });
});

test('the latest lesson shows everything; older lessons only what is still open, and only for four weeks', () => {
  const lessons = [
    lesson('old', '2026-09-01', [aSeg({ id: 'a', compositionId: 'x' })]),                       // 48 days: too old
    lesson('mid', '2026-10-01', [aSeg({ id: 'b', compositionId: 'y' }), aSeg({ id: 'c', compositionId: 'z', assignmentDone: '2026-10-03' })]),
    lesson('new', '2026-10-12', [aSeg({ id: 'd', compositionId: 'w', assignmentDone: '2026-10-13' })]),
  ];
  const out = lessonAssignments(lessons, [], NOW);
  assert.deepEqual(out.items.map(i => i.segmentId), ['d', 'b'], 'new: all; mid: only the open one; old: gone');
  assert.equal(out.lessonDate, '2026-10-12');
  assert.equal(out.open, 1);
});

test('lessons dated in the future are ignored', () => {
  assert.equal(lessonAssignments([lesson('f', '2026-12-01', [aSeg({ id: 'a', compositionId: 'x' })])], [], NOW).items.length, 0);
});

test('ticking and un-ticking marks the right segment and never changes the original', () => {
  const l = lesson('l1', '2026-10-05', [aSeg({ id: 'g1' }), aSeg({ id: 'g2' })]);
  const ticked = setAssignmentDone(l, { segmentId: 'g2' }, true, NOW);
  assert.equal(ticked.segments[0].assignmentDone, undefined);
  assert.equal(ticked.segments[1].assignmentDone, NOW);
  assert.equal(l.segments[1].assignmentDone, undefined, 'the lesson passed in is untouched');
  const back = setAssignmentDone(ticked, { segmentId: 'g2' }, false, NOW);
  assert.ok(!('assignmentDone' in back.segments[1]), 'un-ticking removes the field rather than leaving false');
});

test('a segment saved without an id is found by its position', () => {
  const l = lesson('l1', '2026-10-05', [aSeg({}), aSeg({})]);
  const [first] = lessonAssignments([l], [], NOW).items;
  assert.equal(first.segmentId, undefined);
  const ticked = setAssignmentDone(l, { segmentId: first.segmentId, segmentIndex: 1 }, true, NOW);
  assert.equal(ticked.segments[1].assignmentDone, NOW);
  assert.equal(ticked.segments[0].assignmentDone, undefined);
});

// ── energy and scope ─────────────────────────────────────────────────────────────────────────

const day = (n, energy, duration, enjoyment, segments = []) => ({ id: `d${n}`, date: `2026-09-${String(n).padStart(2, '0')}`, energy, duration, enjoyment, segments });

test('at an energy level you get the usual minutes, mix and enjoyment from sessions at that level', () => {
  const sessions = [
    day(1, 1, 30, 4, [{ type: 'technique', duration: 10 }, { type: 'repertoire', duration: 20 }]),
    day(2, 1, 40, 5, [{ type: 'technique', duration: 20 }, { type: 'repertoire', duration: 20 }]),
    day(3, 1, 35, 3, [{ type: 'technique', duration: 15 }, { type: 'repertoire', duration: 20 }]),
    day(4, -2, 10, 2, [{ type: 'technique', duration: 10 }]),
  ];
  const out = suggestScope(sessions, 1);
  assert.equal(out.enough, true);
  assert.equal(out.widened, false);
  assert.equal(out.n, 3);
  assert.equal(out.minutes, 35, 'the median of 30, 35 and 40');
  assert.ok(Math.abs(out.techniqueShare - 45 / 105) < 1e-9);
  assert.ok(Math.abs(out.repertoireShare - 60 / 105) < 1e-9);
  assert.equal(out.avgEnjoyment, 4);
});

test('with too few at exactly that level it widens to the levels either side, and says so', () => {
  const sessions = [day(1, 0, 20, 3), day(2, 1, 30, 4), day(3, -1, 25, 3), day(4, 2, 60, 5)];
  const out = suggestScope(sessions, 0);
  assert.equal(out.widened, true);
  assert.equal(out.n, 3, '-1, 0 and +1; the +2 session is two away');
  assert.equal(out.minutes, 25);
});

test('with too little data it says there is not enough rather than guessing', () => {
  assert.deepEqual(suggestScope([day(1, 1, 30, 4), day(2, 1, 30, 4)], 1), { enough: false, n: 2 });
  assert.deepEqual(suggestScope([], 0), { enough: false, n: 0 });
});

test('sessions with no energy or no duration are left out', () => {
  const sessions = [day(1, null, 30, 4), day(2, undefined, 30, 4), day(3, '', 30, 4), day(4, 1, 0, 4), day(5, 1, null, 4)];
  assert.deepEqual(suggestScope(sessions, 1), { enough: false, n: 0 });
});

test('minutes are rounded to the nearest five, never below five; a mix needs segment times', () => {
  const sessions = [day(1, 2, 2, 5), day(2, 2, 3, 5), day(3, 2, 4, 5)];
  const out = suggestScope(sessions, 2);
  assert.equal(out.minutes, 5);
  assert.equal(out.techniqueShare, null);
  assert.equal(out.repertoireShare, null);
});

test('enjoyment is averaged only over sessions that have one', () => {
  const sessions = [day(1, 0, 20, 4), day(2, 0, 20, null), day(3, 0, 20, 0), day(4, 0, 20, 2)];
  assert.equal(suggestScope(sessions, 0).avgEnjoyment, 3);
  assert.equal(suggestScope([day(1, 0, 20, null), day(2, 0, 20, null), day(3, 0, 20, null)], 0).avgEnjoyment, null);
});

test('energy and enjoyment: a clear positive link is found, and nothing is claimed from too few sessions', () => {
  const many = [];
  for (let i = 0; i < 12; i++) many.push(day(i + 1, (i % 5) - 2, 20 + i, 3 + ((i % 5) - 2) * 0.4 + 0.8));
  const links = energyLinks(many);
  assert.equal(links.n, 12);
  assert.ok(links.enjoyment > 0.9);
  assert.equal(energyLinks(many.slice(0, 9)).enjoyment, null);
  assert.equal(energyLinks([]).n, 0);
});

test('no variation in energy gives no link rather than a division by zero', () => {
  const flat = Array.from({ length: 12 }, (_, i) => day(i + 1, 1, 20 + i, 3 + (i % 3)));
  const links = energyLinks(flat);
  assert.equal(links.enjoyment, null);
  assert.equal(links.minutes, null);
});

test('describeLink uses plain words, the direction, and says what goes up or down', () => {
  assert.equal(describeLink(null), null);
  assert.equal(describeLink(0.1), 'no clear link');
  assert.equal(describeLink(0.3), 'a weak link (higher energy goes with higher enjoyment)');
  assert.equal(describeLink(-0.5), 'a moderate link (higher energy goes with lower enjoyment)');
  assert.equal(describeLink(0.8, 'length'), 'a strong link (higher energy goes with longer sessions)');
  assert.equal(describeLink(-0.3, 'length'), 'a weak link (higher energy goes with shorter sessions)');
});

// ── grade target and readiness ───────────────────────────────────────────────────────────────

const entry = (scale, extra = {}) => ({ scale, motion: 'parallel', octaves: 2, interval: 'unison', ...extra });
const target = (over = {}) => ({ ...emptyTarget(), name: 'Target', grade: 'Grade 4', date: '2026-12-31', ...over });
const logged = (date, group, ...entries) => session(date, [{ type: 'technique', group, scales: entries }]);

test('a requirement is met by a matching logged scale; recent, stale or never depends on when', () => {
  const t = target({ scales: [entry('Bb major'), entry('Eb major'), entry('B minor')] });
  const sessions = [
    logged('2026-10-15', 'Scales', entry('Bb major')),   // 4 days
    logged('2026-09-01', 'Scales', entry('Eb major')),   // 48 days
  ];
  const r = readiness(t, sessions, [], NOW);
  assert.deepEqual(r.scales.map(x => x.status), ['recent', 'stale', 'never']);
  assert.deepEqual(r.counts, { total: 3, recent: 1, stale: 1, never: 1 });
  assert.equal(r.scales[0].daysSince, 4);
});

test('fewer octaves than required does not meet it; more does', () => {
  const t = target({ scales: [entry('D major', { octaves: 2 })] });
  assert.equal(readiness(t, [logged('2026-10-15', 'Scales', entry('D major', { octaves: 1 }))], [], NOW).scales[0].status, 'never');
  assert.equal(readiness(t, [logged('2026-10-15', 'Scales', entry('D major', { octaves: 4 }))], [], NOW).scales[0].status, 'recent');
});

test('contrary motion and parallel motion are different requirements', () => {
  const t = target({ scales: [entry('E major', { motion: 'contrary' })] });
  assert.equal(readiness(t, [logged('2026-10-15', 'Scales', entry('E major'))], [], NOW).scales[0].status, 'never');
  assert.equal(readiness(t, [logged('2026-10-15', 'Scales', entry('E major', { motion: 'contrary' }))], [], NOW).scales[0].status, 'recent');
});

test('a scale logged as an arpeggio does not meet a scale requirement, and the reverse', () => {
  const t = target({ scales: [entry('Ab major')], arpeggios: [entry('Ab major')] });
  const r = readiness(t, [logged('2026-10-15', 'Arpeggios', entry('Ab major'))], [], NOW);
  assert.equal(r.scales[0].status, 'never');
  assert.equal(r.arpeggios[0].status, 'recent');
});

test('a legacy plain-string scale counts, using the octaves of its segment', () => {
  const t = target({ scales: [entry('C major', { octaves: 2 })] });
  const withOct = session('2026-10-15', [{ type: 'technique', group: 'Scales', octaves: 2, scales: ['C major'] }]);
  const without = session('2026-10-15', [{ type: 'technique', group: 'Scales', scales: ['C major'] }]);
  assert.equal(readiness(t, [withOct], [], NOW).scales[0].status, 'recent');
  assert.equal(readiness(t, [without], [], NOW).scales[0].status, 'never', 'no octave information means one octave');
});

test('times practised and the last date use every matching entry', () => {
  const t = target({ scales: [entry('G major')] });
  const sessions = [logged('2026-09-01', 'Scales', entry('G major')), logged('2026-10-10', 'Scales', entry('G major')), logged('2026-10-12', 'Scales', entry('A major'))];
  const [r] = readiness(t, sessions, [], NOW).scales;
  assert.equal(r.times, 2);
  assert.equal(r.lastDate, '2026-10-10');
});

test('pieces of the target grade are counted, with how many are performance-ready', () => {
  const comps = [
    { id: 'a', title: 'A', grade: 'Grade 4', status: 'performance-ready' },
    { id: 'b', title: 'B', grade: 'Grade 4', status: 'learning' },
    { id: 'c', title: 'C', grade: 'Grade 4', status: 'ambition' },   // not something you are working towards
    { id: 'd', title: 'D', grade: 'Grade 3', status: 'performance-ready' },
  ];
  const { pieces } = readiness(target(), [], comps, NOW);
  assert.equal(pieces.candidates, 2);
  assert.equal(pieces.ready, 1);
  assert.equal(pieces.short, 2, 'three needed, one ready');
  assert.deepEqual(pieces.list.map(p => p.id), ['a', 'b']);
});

test('with no grade set there are no candidate pieces', () => {
  const { pieces } = readiness(target({ grade: '' }), [], [{ id: 'a', grade: 'Grade 4', status: 'learning' }], NOW);
  assert.equal(pieces.candidates, 0);
});

test('sight-reading counts the last four weeks only', () => {
  const sr = (date, mins) => session(date, [{ type: 'technique', group: 'Sight-reading', duration: mins }]);
  const r = readiness(target(), [sr('2026-10-15', 5), sr('2026-10-01', 10), sr('2026-09-20', 20), sr('2026-12-01', 99)], [], NOW);
  assert.deepEqual(r.sightReading, { sessions: 2, minutes: 15 }, '20 Sep is 29 days ago; the future one is ignored');
});

test('days left until the date, and none when no date is set', () => {
  assert.equal(readiness(target({ date: '2026-12-31' }), [], [], NOW).daysLeft, 73);
  assert.equal(readiness(target({ date: '' }), [], [], NOW).daysLeft, null);
  assert.equal(readiness(target({ date: '2026-10-01' }), [], [], NOW).daysLeft, -18, 'a passed date is negative');
});

test('a target survives being stored; junk is cleaned or rejected', () => {
  const t = target({ scales: [entry('Bb major'), entry('E major', { motion: 'contrary' })], arpeggios: [entry('B minor', { octaves: 3 })], piecesNeeded: 3 });
  assert.deepEqual(parseTarget(serializeTarget(t)), t);
  assert.equal(parseTarget('nope'), null);
  assert.equal(parseTarget('[1]'), null);
  assert.equal(parseTarget(null), null);
  const messy = parseTarget(JSON.stringify({ name: ' x ', date: 'tomorrow', piecesNeeded: 99, scales: ['C major', { scale: 'D major', octaves: 9, motion: 'sideways', interval: 'fifth' }, {}, null, 7] }));
  assert.equal(messy.name, 'x');
  assert.equal(messy.date, '');
  assert.equal(messy.piecesNeeded, 10);
  assert.deepEqual(messy.scales, [
    { scale: 'C major', motion: 'parallel', octaves: 1, interval: 'unison' },
    { scale: 'D major', motion: 'parallel', octaves: 4, interval: 'unison' },
  ]);
});

test('an empty target has nothing to show; one with scales or pieces does', () => {
  assert.equal(targetHasContent(null), false);
  assert.equal(targetHasContent(emptyTarget()), false);
  assert.equal(targetHasContent(target({ scales: [entry('C major')] })), true);
  assert.equal(targetHasContent(target({ piecesNeeded: 3, grade: 'Grade 4' })), true);
  assert.equal(targetHasContent(target({ piecesNeeded: 3, grade: '' })), false);
});

test('describeRequirement', () => {
  assert.equal(describeRequirement({ name: 'Bb major', octaves: 2, motion: 'parallel', interval: 'unison' }), 'Bb major, 2 oct');
  assert.equal(describeRequirement({ name: 'C harmonic minor', octaves: 2, motion: 'contrary', interval: 'unison' }), 'C harmonic minor, 2 oct, contrary');
  assert.equal(describeRequirement({ name: 'G major', octaves: 2, motion: 'parallel', interval: 'third' }), 'G major, 2 oct, in 3rds');
});

test('the same key can be required in both motions, and each list keeps its own motion', () => {
  const similar = [entry('Eb major'), entry('Bb major', { motion: 'contrary' })];   // the second was flipped by a tap
  const contrary = [entry('Eb major', { motion: 'parallel' })];                      // and this one too
  const joined = joinScales(similar, contrary);
  assert.deepEqual(joined.map(e => `${e.scale}:${e.motion}`), ['Eb major:parallel', 'Bb major:parallel', 'Eb major:contrary']);
  const t = target({ scales: joined });
  const r = readiness(t, [logged('2026-10-15', 'Scales', entry('Eb major', { motion: 'contrary' }))], [], NOW);
  assert.deepEqual(r.scales.map(x => x.status), ['never', 'never', 'recent'], 'contrary is a separate requirement from similar motion');
});

test('splitting and joining a target\'s scales loses nothing', () => {
  const scales = [entry('A major'), entry('E major', { motion: 'contrary' }), entry('G major', { interval: 'third' })];
  const { similar, contrary } = splitScales(scales);
  assert.deepEqual(joinScales(similar, contrary).map(e => e.scale).sort(), ['A major', 'E major', 'G major']);
  assert.equal(similar.length, 2);
  assert.equal(contrary.length, 1);
  assert.deepEqual(splitScales(undefined), { similar: [], contrary: [] });
});

test('legacy string entries from a picker are given the defaults, and blanks are dropped', () => {
  assert.deepEqual(joinScales(['C major', '', null, { scale: '' }], []), [{ scale: 'C major', octaves: 1, interval: 'unison', motion: 'parallel' }]);
});
