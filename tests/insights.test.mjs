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
  runThroughsOf, runThroughStats, describeRunThroughs, formatRunThroughs, suggestNextTempo, nextTempos, tempoSuggestionMap, tempoStalled, tempoTrajectory, pieceReport, spotLabel, parseSpots, addSpot, setSpotFixed, removeSpot, openSpots, openSpotsLine, weeklyReviewDue, weeklyReview, weeklyText, suggestScales, lessonBrief, briefText, shortDate,
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

// ── run-throughs ──────────

const RT = (compositionId, runThroughs, extra = {}) => ({ type: 'repertoire', compositionId, runThroughs, ...extra });

test('a run-through count is a whole number from zero to 99; anything else is zero', () => {
  assert.equal(runThroughsOf({ runThroughs: 3 }), 3);
  assert.equal(runThroughsOf({ runThroughs: '4' }), 4, 'typed like the BPM, so it may be text');
  assert.equal(runThroughsOf({ runThroughs: 2.9 }), 2);
  assert.equal(runThroughsOf({ runThroughs: 250 }), 99, 'a slip of the finger can\'t swamp the totals');
  for (const bad of [0, -3, '', 'abc', null, undefined, NaN]) assert.equal(runThroughsOf({ runThroughs: bad }), 0, `${bad}`);
  assert.equal(runThroughsOf(undefined), 0);
  assert.equal(runThroughsOf({}), 0);
});

test('run-throughs are totalled per piece, with the last month, the last date and the best single go', () => {
  const sessions = [
    session('2026-08-01', [RT('c1', 2)]),
    session('2026-10-10', [RT('c1', 3), RT('c2', 1)]),
    session('2026-10-18', [RT('c1', 5)]),
  ];
  const out = runThroughStats(sessions, [{ id: 'c1', title: 'Minuet in F' }, { id: 'c2', title: 'Gymnopédie' }], NOW);
  const minuet = out.find(p => p.compositionId === 'c1');
  assert.equal(minuet.name, 'Minuet in F');
  assert.equal(minuet.total, 10);
  assert.equal(minuet.recent, 8, 'the August one is more than 30 days ago');
  assert.equal(minuet.lastDate, '2026-10-18');
  assert.equal(minuet.segments, 3);
  assert.equal(minuet.best, 5);
  assert.deepEqual(out.map(p => p.name), ['Minuet in F', 'Gymnopédie'], 'most recent activity first');
});

test('the last-month window includes today and the 29 days before it, not the 30th', () => {
  const edge = (date) => runThroughStats([session(date, [RT('c1', 1)])], [], NOW)[0].recent;
  assert.equal(edge('2026-10-19'), 1);
  assert.equal(edge('2026-09-20'), 1, '29 days back is inside');
  assert.equal(edge('2026-09-19'), 0, '30 days back is outside');
});

test('only repertoire segments count, and pieces with no library entry are followed by title', () => {
  const sessions = [session('2026-10-18', [
    { type: 'technique', runThroughs: 9 },
    { type: 'repertoire', title: 'Free piece', runThroughs: 2 },
    { type: 'repertoire', title: 'free piece', runThroughs: 1 },
    { type: 'repertoire', runThroughs: 7 },            // no piece and no title: nowhere to put it
    RT('c1', 0), RT('c1', ''),
  ])];
  const out = runThroughStats(sessions, [], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Free piece');
  assert.equal(out[0].total, 3);
});

test('run-throughs dated after today are ignored, and none gives an empty list', () => {
  assert.deepEqual(runThroughStats([session('2026-12-01', [RT('c1', 4)])], [], NOW), []);
  assert.deepEqual(runThroughStats([], [], NOW), []);
  assert.deepEqual(runThroughStats(undefined, undefined, NOW), []);
});

test('describeRunThroughs', () => {
  assert.equal(describeRunThroughs({ total: 1, recent: 1 }), '1 run-through');
  assert.equal(describeRunThroughs({ total: 6, recent: 2 }), '6 run-throughs, 2 in the last month');
  assert.equal(describeRunThroughs({ total: 6, recent: 6 }), '6 run-throughs');
  assert.equal(describeRunThroughs({ total: 6, recent: 0 }), '6 run-throughs');
  assert.equal(describeRunThroughs({ total: 0, recent: 0 }), 'none yet');
  assert.equal(describeRunThroughs(undefined), 'none yet');
});

// ── scales for today ──────────

const sc = (name, extra = {}) => ({ scale: name, motion: 'parallel', octaves: 2, interval: 'unison', ...extra });
const playedOn = (date, group, ...entries) => session(date, [{ type: 'technique', group, scales: entries }]);

test('requirements never practised come before stale ones, and recent ones come last', () => {
  const t = target({ scales: [sc('A major'), sc('B major'), sc('C major'), sc('D major')] });
  const sessions = [playedOn('2026-10-17', 'Scales', sc('A major')), playedOn('2026-09-01', 'Scales', sc('B major'))];   // A recent, B stale, C and D never
  const out = suggestScales(t, sessions, NOW, 10);
  assert.deepEqual(out.map(x => x.status), ['never', 'never', 'stale', 'recent']);
  assert.deepEqual(out.slice(2).map(x => x.name), ['B major', 'A major']);
  assert.deepEqual(out.map(x => x.fromTarget), [true, true, true, true]);
});

test('stale requirements go in the order they have been left, longest first', () => {
  const t = target({ scales: [sc('A major'), sc('B major'), sc('C major')] });
  const sessions = [playedOn('2026-09-10', 'Scales', sc('A major')), playedOn('2026-08-01', 'Scales', sc('B major')), playedOn('2026-09-25', 'Scales', sc('C major'))];
  assert.deepEqual(suggestScales(t, sessions, NOW, 10).map(x => x.name), ['B major', 'A major', 'C major']);
});

test('the reason says it plainly, and today reads as today', () => {
  const t = target({ scales: [sc('A major'), sc('B major'), sc('C major')] });
  const sessions = [playedOn('2026-09-26', 'Scales', sc('A major')), playedOn('2026-10-19', 'Scales', sc('B major'))];   // A: 23 days ago
  const byName = Object.fromEntries(suggestScales(t, sessions, NOW, 10).map(x => [x.name, x.reason]));
  assert.equal(byName['C major'], 'not practised yet');
  assert.equal(byName['A major'], 'last played 3 weeks ago');
  assert.equal(byName['B major'], 'played today');
});

test('scales outside the target that have been dropped for two weeks come before the target\'s recent ones', () => {
  const t = target({ scales: [sc('A major')] });
  const sessions = [playedOn('2026-10-18', 'Scales', sc('A major')), playedOn('2026-09-01', 'Scales', sc('F# major'))];
  const out = suggestScales(t, sessions, NOW, 10);
  assert.deepEqual(out.map(x => [x.name, x.fromTarget]), [['F# major', false], ['A major', true]]);
});

test('a scale and an arpeggio of the same name are different things, and are not listed twice', () => {
  const t = target({ scales: [sc('G major')], arpeggios: [sc('G major')] });
  const sessions = [playedOn('2026-08-01', 'Scales', sc('G major'))];
  const out = suggestScales(t, sessions, NOW, 10);
  assert.deepEqual(out.map(x => `${x.group}:${x.status}`), ['Arpeggios:never', 'Scales:stale']);
  assert.equal(out.length, 2);
});

test('without a target the suggestions are the scales you used to play and have dropped', () => {
  const sessions = [playedOn('2026-08-01', 'Scales', 'C major'), playedOn('2026-09-15', 'Arpeggios', 'D major'), playedOn('2026-10-17', 'Scales', 'E major')];
  const out = suggestScales(null, sessions, NOW, 10);
  assert.deepEqual(out.map(x => x.name), ['C major', 'D major']);
  assert.deepEqual(suggestScales(null, [], NOW), []);
  assert.deepEqual(suggestScales(target(), [], NOW), [], 'a target with no requirements asks for nothing');
});

test('the limit is respected', () => {
  const t = target({ scales: Array.from({ length: 12 }, (_, i) => sc(`${'ABCDEFGHIJKL'[i]} major`)) });
  assert.equal(suggestScales(t, [], NOW).length, 5);
  assert.equal(suggestScales(t, [], NOW, 3).length, 3);
  assert.equal(suggestScales(t, [], NOW, 20).length, 12);
});

test('never-practised requirements are shown in an order that changes from day to day, but not within a day', () => {
  const names = Array.from({ length: 12 }, (_, i) => `${'ABCDEFGHIJKL'[i]} major`);
  const t = target({ scales: names.map(n => sc(n)) });
  const day = d => suggestScales(t, [], d, 12).map(x => x.name).join(',');
  assert.equal(day('2026-10-19'), day('2026-10-19'), 'the same on the same day');
  const orders = new Set(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map(day));
  assert.ok(orders.size >= 3, 'a different order on most days');
  assert.deepEqual(day('2026-10-19').split(',').sort(), names, 'always the same set');
});

test('a requirement is described as the target states it', () => {
  const t = target({ scales: [sc('E major', { motion: 'contrary' })] });
  assert.equal(suggestScales(t, [], NOW)[0].label, 'E major, 2 oct, contrary');
});

// ── the summary for a lesson ──────────

const rseg = (compositionId, extra = {}) => ({ type: 'repertoire', compositionId, duration: 10, ...extra });
const comps2 = [{ id: 'c1', title: 'Minuet in F', tempo: 92 }, { id: 'c2', title: 'Ocean View' }];

function story() {
  const lessons = [
    lesson('l0', '2026-09-20', [aSeg({ id: 'old', compositionId: 'c2', assignment: 'Left hand alone', feedback: 'Older note' })]),
    lesson('l1', '2026-10-05', [
      aSeg({ id: 'a1', compositionId: 'c2', assignment: 'Hands together, bars 1-8', feedback: 'Shape the melody' }),
      aSeg({ id: 'a2', compositionId: 'c1', assignment: 'Clean the trill' }),
    ].map(g => g)),
  ];
  lessons[1].teacher = 'Kerrin';
  lessons[1].wins = 'Pedalling clicked';
  // 'pedalling' appears once (on 17 Oct), so it must not be listed as a recurring challenge.
  const sessions = [
    session('2026-10-05', [rseg('c1', { tempo: 70, duration: 99 })]),          // the lesson day: its minutes are not counted, its BPM is the baseline
    session('2026-10-02', [rseg('c1', { tempo: 65 })]),                        // earlier still
    { ...session('2026-10-08', [rseg('c1', { tempo: 76, runThroughs: 1, challenges: ['tempo'], duration: 20 }), { type: 'technique', group: 'Scales', duration: 15, scales: ['Bb major'], challenges: ['evenness'] }]), energy: 1, enjoyment: 4, wins: 'First clean run', duration: 35 },
    { ...session('2026-10-12', [rseg('c1', { tempo: 88, runThroughs: 3, challenges: ['tempo', 'evenness'], progress: ['breakthrough'] }), rseg('c2', { duration: 25, challenges: ['tempo'] }), { type: 'technique', group: 'Arpeggios', duration: 5, scales: [{ scale: 'Eb major' }] }]), energy: 0, enjoyment: 5, wins: '', duration: 40 },
    { ...session('2026-10-17', [rseg('c1', { duration: 10, runThroughs: 2, challenges: ['pedalling'] })]), energy: -1, tomorrowFocus: 'Bars 9-16 slowly', duration: 10 },
  ];
  return { lessons, sessions };
}

test('the summary covers practice after the last lesson, and not the lesson day or earlier', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  assert.deepEqual(b.period, { hasLesson: true, since: '2026-10-05', from: '2026-10-05', days: 14 });
  assert.equal(b.totals.sessions, 3);
  assert.equal(b.totals.practiceDays, 3);
  assert.equal(b.totals.minutes, 35 + 40 + 10);
  assert.equal(b.totals.avgMinutes, 28);
  assert.equal(b.totals.avgEnergy, 0, '+1, 0 and -1');
  assert.equal(b.totals.avgEnjoyment, 4.5, 'only the two sessions that have one');
});

test('pieces show minutes, run-throughs and tempo from where it stood at the lesson to where it is now', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  const minuet = b.pieces.find(p => p.compositionId === 'c1');
  assert.equal(minuet.name, 'Minuet in F');
  assert.equal(minuet.sessions, 3);
  assert.equal(minuet.runThroughs, 6);
  assert.deepEqual(minuet.tempo, { from: 70, to: 88, change: 18, target: 92 }, 'the baseline is the last BPM logged on or before the lesson day');
  assert.equal(b.pieces.find(p => p.compositionId === 'c2').tempo, null, 'no BPM logged for it');
  assert.equal(b.runThroughs, 6);
  assert.deepEqual(b.pieces.map(p => p.name), ['Minuet in F', 'Ocean View'], 'most time first');
});

test('with no earlier reading the first one in the window is the starting point, and a single one has no change', () => {
  const lessons = [lesson('l1', '2026-10-05', [])];
  const two = lessonBrief(lessons, [session('2026-10-08', [rseg('c1', { tempo: 60 })]), session('2026-10-12', [rseg('c1', { tempo: 72 })])], comps2, NOW);
  assert.deepEqual(two.pieces[0].tempo, { from: 60, to: 72, change: 12, target: 92 });
  const one = lessonBrief(lessons, [session('2026-10-12', [rseg('c1', { tempo: 72 })])], comps2, NOW);
  assert.deepEqual(one.pieces[0].tempo, { from: null, to: 72, change: null, target: 92 });
});

test('a challenge counts only when it kept coming up, with the pieces it was about', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  assert.deepEqual(b.challenges.map(c => [c.tag, c.count]), [['tempo', 3], ['evenness', 2]], 'a tag seen once is left out');
  assert.deepEqual(b.challenges[0].where, ['Minuet in F', 'Ocean View']);
  assert.deepEqual(b.challenges[1].where.sort(), ['Minuet in F', 'Scales']);
  assert.deepEqual(b.progress, [{ tag: 'breakthrough', count: 1 }]);
});

test('wins newest first, blanks skipped; technique and scales are summarised', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  assert.deepEqual(b.wins, [{ date: '2026-10-08', text: 'First clean run' }]);
  assert.deepEqual(b.technique.map(t => [t.name, t.minutes]), [['Scales', 15], ['Arpeggios', 5]]);
  assert.deepEqual(b.scales, { scales: 1, arpeggios: 1, names: ['Bb major', 'Eb major'] });
  assert.equal(b.plannedNext, 'Bars 9-16 slowly');
});

test('open assignments from the lesson, and what the teacher said, are included', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  assert.equal(b.assignments.lessonDate, '2026-10-05');
  assert.deepEqual(b.assignments.open, [], 'both were practised since, so they are covered, not open');
  assert.equal(b.assignments.covered, 2);
  assert.deepEqual(b.lastLesson.feedback, [{ label: 'Ocean View', text: 'Shape the melody' }]);
  assert.equal(b.lastLesson.teacher, 'Kerrin');
  const open = lessonBrief(lessons, [], comps2, NOW);
  assert.deepEqual(open.assignments.open.map(a => a.label).sort(), ['Minuet in F', 'Ocean View']);
});

test('with no lesson logged it covers the last four weeks, and says so', () => {
  const b = lessonBrief([], [session('2026-10-01', [rseg('c1')]), session('2026-09-01', [rseg('c1')])], comps2, NOW);
  assert.deepEqual(b.period, { hasLesson: false, since: null, from: '2026-09-21', days: 28 });
  assert.equal(b.totals.sessions, 1);
  assert.equal(b.lastLesson, null);
  assert.equal(lessonBrief([], [], comps2, NOW, { fallbackDays: 7 }).period.from, '2026-10-12');
});

test('an empty stretch gives an empty, well-formed summary', () => {
  const b = lessonBrief([lesson('l1', '2026-10-18', [])], [], comps2, NOW);
  assert.equal(b.totals.sessions, 0);
  assert.deepEqual([b.pieces, b.wins, b.challenges, b.progress, b.technique], [[], [], [], [], []]);
  assert.equal(b.totals.avgEnergy, null);
  assert.equal(b.plannedNext, null);
  assert.ok(briefText(b).includes('No practice logged in this time.'));
});

test('lessons dated in the future are ignored', () => {
  const b = lessonBrief([lesson('f', '2026-12-01', []), lesson('p', '2026-10-01', [])], [session('2026-10-10', [rseg('c1')])], comps2, NOW);
  assert.equal(b.period.since, '2026-10-01');
});

test('the text reads as a short report', () => {
  const { lessons, sessions } = story();
  const text = briefText(lessonBrief(lessons, sessions, comps2, NOW));
  const lines = text.split('\n');
  assert.equal(lines[0], 'Since my last lesson on 5 Oct 2026 (14 days ago)');
  assert.ok(text.includes('Practice: 3 sessions on 3 days, 1h 25m (about 28 min each).'));
  assert.ok(text.includes('Energy averaged 0 and enjoyment 4.5 out of 5.'));
  assert.ok(text.includes('- Minuet in F: 3 sessions, 40m, 70 → 88 bpm (+18), target 92, 6 run-throughs'));
  assert.ok(text.includes('- Ocean View: 1 session, 25m'));
  assert.ok(text.includes('Scales and arpeggios: 1 scale and 1 arpeggio practised (Bb major, Eb major).'));
  assert.ok(text.includes('- 8 Oct: First clean run'));
  assert.ok(text.includes('- tempo (3 times: Minuet in F, Ocean View)'));
  assert.ok(text.includes('Progress marked: breakthrough 1x.'));
  assert.ok(text.includes('What Kerrin said last time\n- Ocean View: Shape the melody'));
  assert.ok(text.includes('Planned next: Bars 9-16 slowly'));
  assert.ok(!/[*#_`]/.test(text.replace(/_/g, '')), 'no formatting characters');
});

test('the text lists what is still open, and uses plain wording with no lesson on record', () => {
  const { lessons } = story();
  assert.ok(briefText(lessonBrief(lessons, [], comps2, NOW)).includes('Still open from the lesson\n- '));
  assert.equal(briefText(lessonBrief([], [], comps2, NOW)).split('\n')[0], 'The last 28 days (no lesson logged yet)');
});

test('shortDate', () => {
  assert.equal(shortDate('2026-10-05'), '5 Oct');
  assert.equal(shortDate('2026-12-25', true), '25 Dec 2026');
  assert.equal(shortDate('2026-01-31'), '31 Jan');
});

test('formatRunThroughs reads naturally and is null when none were logged', () => {
  assert.equal(formatRunThroughs({ runThroughs: 3 }), '3 run-throughs');
  assert.equal(formatRunThroughs({ runThroughs: '1' }), '1 run-through');
  for (const none of [{}, { runThroughs: 0 }, { runThroughs: '' }, { runThroughs: 'x' }, undefined]) assert.equal(formatRunThroughs(none), null);
});

// ── the next tempo ────────────────────────────────────────────────────────────────────────────

const series = (readings, target = null) => {
  const points = readings.map(([date, bpm]) => ({ date, bpm }));
  const last = points[points.length - 1];
  return { points, latest: last.bpm, lastDate: last.date, target };
};

test('the step is about 5% of the last clean reading, between 2 and 6 bpm', () => {
  const next = latest => suggestNextTempo(series([['2026-10-10', latest]]), NOW);
  assert.equal(next(40).step, 2, '5% of 40 is 2');
  assert.equal(next(30).step, 2, 'never less than 2');
  assert.equal(next(60).step, 3);
  assert.equal(next(100).step, 5);
  assert.equal(next(160).step, 6, 'never more than 6');
  assert.equal(next(200).step, 6);
  assert.deepEqual(next(100), { kind: 'step', bpm: 105, from: 100, step: 5, reason: '5 above your last clean 100.' });
});

test('the step stops at the piece\'s own tempo', () => {
  const out = suggestNextTempo(series([['2026-10-10', 90]], 92), NOW);
  assert.equal(out.bpm, 92);
  assert.equal(out.step, 2);
  assert.equal(out.kind, 'step');
  assert.equal(suggestNextTempo(series([['2026-10-10', 91]], 92), NOW).step, 1, 'one short of the target is a step of one');
});

test('at or above the target there is nothing to climb, and it says so', () => {
  const at = suggestNextTempo(series([['2026-10-10', 92]], 92), NOW);
  assert.deepEqual([at.kind, at.bpm, at.step], ['at-target', 92, 0]);
  assert.match(at.reason, /reached the 92 target/);
  assert.equal(suggestNextTempo(series([['2026-10-10', 120]], 92), NOW).kind, 'at-target');
});

test('without a target it keeps stepping up', () => {
  assert.equal(suggestNextTempo(series([['2026-10-10', 80]]), NOW).bpm, 84);
});

test('three readings that have sat within 1 bpm for a week or more halve the step', () => {
  const flat = suggestNextTempo(series([['2026-10-01', 80], ['2026-10-06', 80], ['2026-10-12', 81]]), NOW);
  assert.equal(flat.kind, 'small-step');
  assert.equal(flat.step, 2, 'half of 4, but never less than 2');
  assert.equal(flat.bpm, 83);
  assert.match(flat.reason, /smaller step/);
  const big = suggestNextTempo(series([['2026-10-01', 160], ['2026-10-06', 160], ['2026-10-12', 161]]), NOW);
  assert.equal(big.step, 3, 'half of 6');
});

test('it is not stalled when the readings span under a week, differ by more than 1, or there are fewer than three', () => {
  assert.equal(suggestNextTempo(series([['2026-10-10', 80], ['2026-10-12', 80], ['2026-10-14', 80]]), NOW).kind, 'step', 'only 4 days');
  assert.equal(suggestNextTempo(series([['2026-10-01', 80], ['2026-10-06', 82], ['2026-10-12', 80]]), NOW).kind, 'step', 'a spread of 2');
  assert.equal(suggestNextTempo(series([['2026-10-01', 80], ['2026-10-12', 80]]), NOW).kind, 'step', 'only two readings');
});

test('only the last three readings decide whether it has stalled', () => {
  const rising = suggestNextTempo(series([['2026-09-01', 70], ['2026-09-10', 70], ['2026-10-01', 80], ['2026-10-06', 80], ['2026-10-12', 81]]), NOW);
  assert.equal(rising.kind, 'small-step', 'the earlier climb does not hide a recent plateau');
});

test('after four weeks without a reading it starts again from the last one', () => {
  const back = suggestNextTempo(series([['2026-09-21', 80]]), NOW);   // 28 days ago
  assert.deepEqual([back.kind, back.bpm, back.step], ['return', 80, 0]);
  assert.equal(suggestNextTempo(series([['2026-09-22', 80]]), NOW).kind, 'step', '27 days ago is still recent');
});

test('the suggestion always stays inside the metronome\'s 30 to 240', () => {
  assert.equal(suggestNextTempo(series([['2026-10-10', 239]]), NOW).bpm, 240);
  assert.equal(suggestNextTempo(series([['2026-10-10', 240]]), NOW).bpm, 240);
  assert.equal(suggestNextTempo(series([['2026-10-10', 20]]), NOW).bpm, 30);
});

test('a suggestion for each piece and exercise, and a map for the metronome with only the ones that have a step', () => {
  const comps = [{ id: 'c1', title: 'Minuet', tempo: 92 }, { id: 'c2', title: 'Ocean View', tempo: 80 }, { id: 'c3', title: 'Old piece' }];
  const sessions = [
    session('2026-10-10', [rep('c1', 70), rep('c2', 80), rep('c3', 60), tech('Hanon', 'Hanon 1', 90)]),
    session('2026-08-01', [rep('c3', 60)]),
  ];
  const all = nextTempos(sessions, comps, NOW);
  assert.deepEqual(all.map(x => [x.name, x.kind]).sort(), [['Hanon \u00b7 Hanon 1', 'technique'], ['Minuet', 'piece'], ['Ocean View', 'piece'], ['Old piece', 'piece']].sort());
  const map = tempoSuggestionMap(sessions, comps, NOW);
  assert.deepEqual(map, { c1: 74, c3: 63 }, 'Ocean View is at its target and Hanon is an exercise, so neither is in the map');
});

test('readings dated after today are ignored, and nothing logged gives nothing', () => {
  assert.deepEqual(nextTempos([session('2026-12-01', [rep('c1', 70)])], [], NOW), []);
  assert.deepEqual(tempoSuggestionMap([], [], NOW), {});
  assert.deepEqual(tempoSuggestionMap(undefined, undefined, NOW), {});
});

// ── the week in review ────────────────────────────────────────────────────────────────────────

// NOW is Monday 19 October 2026, so the week reviewed is Monday 12 to Sunday 18 October.
function weekStory() {
  const sessions = [
    { ...session('2026-10-06', [rseg('c1', { tempo: 60, duration: 20 })]), duration: 20 },                       // the week before: 5-11 Oct
    { ...session('2026-10-09', [rseg('c1', { duration: 15 })]), duration: 15 },
    { ...session('2026-10-11', [rseg('c1', { tempo: 70, duration: 10 })]), duration: 10 },                       // its Sunday: the last reading before the week
    { ...session('2026-10-12', [rseg('c1', { tempo: 76, runThroughs: 2, challenges: ['tempo'], duration: 20 }), { type: 'technique', group: 'Scales', duration: 10, scales: ['Bb major'] }]), energy: 1, enjoyment: 4, wins: 'Clean left hand', duration: 30 },
    { ...session('2026-10-18', [rseg('c1', { tempo: 88, runThroughs: 1, challenges: ['tempo'], duration: 25 })]), energy: 0, enjoyment: 5, tomorrowFocus: 'Bars 9-16', duration: 25 },
    session('2026-10-19', [rseg('c1', { tempo: 99, duration: 99 })]),                                            // today: not in last week
  ];
  const comps = [{ id: 'c1', title: 'Minuet in F', tempo: 92, status: 'learning' }, { id: 'c2', title: 'Ocean View', status: 'consolidating' }, { id: 'c3', title: 'Dream', status: 'ambition' }];
  return { sessions, comps };
}

test('the review is offered on Monday, Tuesday and Wednesday only', () => {
  assert.deepEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(weeklyReviewDue),
    [true, true, true, false, false, false, false]);
});

test('it reviews the last full Monday-to-Sunday week, whichever day of this week it is', () => {
  for (const day of ['2026-10-19', '2026-10-21', '2026-10-25']) {
    const r = weeklyReview([], [], [], day);
    assert.deepEqual(r.week, { from: '2026-10-12', to: '2026-10-18' }, day);
    assert.equal(r.brief.period.label, 'Week of 12 Oct to 18 Oct');
    assert.equal(r.brief.period.days, 7);
  }
  assert.deepEqual(weeklyReview([], [], [], '2026-10-26').week, { from: '2026-10-19', to: '2026-10-25' }, 'the next Monday moves on');
});

test('only that week\'s practice counts: the Sunday before and today are outside it', () => {
  const { sessions, comps } = weekStory();
  const r = weeklyReview([], sessions, comps, NOW);
  assert.equal(r.brief.totals.sessions, 2);
  assert.equal(r.brief.totals.minutes, 55);
  assert.equal(r.brief.totals.practiceDays, 2);
  assert.deepEqual(r.brief.wins, [{ date: '2026-10-12', text: 'Clean left hand' }]);
  assert.equal(r.brief.plannedNext, 'Bars 9-16');
});

test('it is compared with the week before', () => {
  const { sessions, comps } = weekStory();
  const r = weeklyReview([], sessions, comps, NOW);
  assert.deepEqual(r.previous, { sessions: 3, minutes: 45 });
  assert.ok(weeklyText(r).includes('Compared with the week before: 10m more (2 sessions against 3).'));
  const timed = (date, minutes) => ({ ...session(date, [rseg('c1', { duration: minutes })]), duration: minutes });
  const quiet = weeklyReview([], [timed('2026-10-06', 60), timed('2026-10-13', 30)], comps2, NOW);
  assert.ok(weeklyText(quiet).includes('30m less (1 session against 1)'));
  const same = weeklyReview([], [timed('2026-10-06', 30), timed('2026-10-13', 30)], comps2, NOW);
  assert.ok(weeklyText(same).includes('the same time'));
});

test('tempo is shown from where it stood at the end of the week before to where it ended the week', () => {
  const { sessions, comps } = weekStory();
  const minuet = weeklyReview([], sessions, comps, NOW).brief.pieces.find(p => p.compositionId === 'c1');
  assert.deepEqual(minuet.tempo, { from: 70, to: 88, change: 18, target: 92 }, 'from the Sunday reading to the last one that week');
  assert.equal(minuet.runThroughs, 3);
  assert.equal(minuet.minutes, 45);
});

test('what to carry forward: scales left for two weeks and pieces being worked on that have gone quiet', () => {
  const { sessions, comps } = weekStory();
  const sessionsWithOld = [...sessions, session('2026-09-20', [{ type: 'technique', group: 'Arpeggios', scales: ['D major'], duration: 5 }])];
  const r = weeklyReview([], sessionsWithOld, comps, NOW);
  assert.deepEqual(r.carry.scales.map(x => x.name), ['D major'], 'Bb major was played on the 12th, 7 days ago');
  assert.deepEqual(r.carry.pieces.map(p => [p.name, p.daysSince]), [['Ocean View', null]], 'never practised; Minuet was played today and Dream is only an ambition');
  const text = weeklyText(r);
  assert.ok(text.includes('To carry into this week\n- Scales to revisit: D major (4 weeks ago)'));
  assert.ok(text.includes('- Pieces not played for a week: Ocean View (not yet)'));
});

test('pieces count as quiet from seven days, most overdue first, at most three', () => {
  const comps = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id.toUpperCase(), status: 'learning' }));
  const sessions = [
    session('2026-10-12', [rseg('a')]),   // 7 days: quiet
    session('2026-10-13', [rseg('b')]),   // 6 days: not yet
    session('2026-09-01', [rseg('c')]),
    session('2026-10-01', [rseg('d')]),
  ];
  assert.deepEqual(weeklyReview([], sessions, comps, NOW).carry.pieces.map(p => p.name), ['C', 'D', 'A']);
  const many = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, title: id, status: 'learning' }));
  assert.equal(weeklyReview([], [], many, NOW).carry.pieces.length, 3);
});

test('an empty week gives a short, well-formed review', () => {
  const r = weeklyReview([], [], [], NOW);
  const text = weeklyText(r);
  assert.equal(text.split('\n')[0], 'Week of 12 Oct to 18 Oct');
  assert.ok(text.includes('No practice logged in this time.'));
  assert.ok(!text.includes('Compared with the week before'), 'nothing to compare when neither week has practice');
});

test('the lesson summary is unchanged by the weekly window', () => {
  const { lessons, sessions } = story();
  const b = lessonBrief(lessons, sessions, comps2, NOW);
  assert.equal(b.period.label, undefined);
  assert.equal(briefText(b).split('\n')[0], 'Since my last lesson on 5 Oct 2026 (14 days ago)');
});

test('at most three scales are carried forward, the longest-neglected first', () => {
  const sessions = [
    session('2026-09-01', [{ type: 'technique', group: 'Scales', scales: ['A major'] }]),
    session('2026-08-01', [{ type: 'technique', group: 'Scales', scales: ['B major'] }]),
    session('2026-09-10', [{ type: 'technique', group: 'Scales', scales: ['C major'] }]),
    session('2026-07-01', [{ type: 'technique', group: 'Scales', scales: ['D major'] }]),
    session('2026-09-15', [{ type: 'technique', group: 'Scales', scales: ['E major'] }]),
  ];
  assert.deepEqual(weeklyReview([], sessions, [], NOW).carry.scales.map(x => x.name), ['D major', 'B major', 'A major']);
});

// ── stalled, and on track ─────────────────────────────────────────────────────────────────

test('a piece has stalled when its last three readings have sat still for a week', () => {
  const out = tempoStalled(series([['2026-10-01', 80], ['2026-10-06', 80], ['2026-10-12', 81]], 92), NOW);
  assert.deepEqual(out, { bpm: 81, since: '2026-10-01', days: 18 });
  assert.ok(tempoStalled(series([['2026-10-01', 80], ['2026-10-06', 80], ['2026-10-12', 81]]), NOW), 'a piece with no tempo of its own can still stall');
});

test('it has not stalled while the readings still move, are too close together, or are too few', () => {
  assert.equal(tempoStalled(series([['2026-10-01', 80], ['2026-10-06', 82], ['2026-10-12', 80]], 92), NOW), null, 'a spread of 2');
  assert.equal(tempoStalled(series([['2026-10-10', 80], ['2026-10-12', 80], ['2026-10-14', 80]], 92), NOW), null, 'only 4 days');
  assert.equal(tempoStalled(series([['2026-10-01', 80], ['2026-10-12', 80]], 92), NOW), null, 'two readings');
  assert.equal(tempoStalled(undefined, NOW), null);
});

test('a piece at its own tempo, or left for a month, has not stalled', () => {
  assert.equal(tempoStalled(series([['2026-10-01', 92], ['2026-10-06', 92], ['2026-10-12', 92]], 92), NOW), null, 'nothing left to climb');
  assert.equal(tempoStalled(series([['2026-08-20', 80], ['2026-08-27', 80], ['2026-09-02', 80]], 92), NOW), null, 'a break is not a plateau');
});

const EXAM = '2026-12-14';   // eight weeks from NOW

test('a piece at its tempo is done, and one with no tempo has no projection', () => {
  assert.equal(tempoTrajectory(series([['2026-10-10', 92]], 92), EXAM, NOW).status, 'reached');
  assert.equal(tempoTrajectory(series([['2026-10-10', 120]], 92), EXAM, NOW).status, 'reached');
  assert.equal(tempoTrajectory(series([['2026-10-10', 80]]), EXAM, NOW), null);
  assert.equal(tempoTrajectory(undefined, EXAM, NOW), null);
});

test('without a future exam date there is nothing to be on track for, and it says how to fix that', () => {
  for (const date of [null, undefined, '', '2026-10-19', '2026-10-01']) {
    const t = tempoTrajectory(series([['2026-10-10', 80]], 92), date, NOW);
    assert.equal(t.status, 'no-date', String(date));
    assert.match(t.message, /exam date/);
  }
});

test('with too few readings it gives the pace needed and does not pretend to know yours', () => {
  const one = tempoTrajectory(series([['2026-10-10', 80]], 92), EXAM, NOW);
  assert.equal(one.status, 'unknown');
  assert.equal(one.needPerWeek, 1.5, '12 bpm over 8 weeks');
  assert.equal(one.ratePerWeek, null);
  assert.equal(one.projected, null);
  assert.equal(tempoTrajectory(series([['2026-10-14', 78], ['2026-10-19', 80]], 92), EXAM, NOW).status, 'unknown', 'readings under a week apart say nothing about a weekly pace');
  assert.equal(tempoTrajectory(series([['2026-08-01', 60], ['2026-09-01', 70]], 92), EXAM, NOW).status, 'unknown', 'readings older than four weeks are not your pace now');
});

test('a pace that would get there is on track', () => {
  const t = tempoTrajectory(series([['2026-09-28', 72], ['2026-10-19', 80]], 92), EXAM, NOW);
  assert.equal(t.status, 'on-track');
  assert.equal(t.needPerWeek, 1.5);
  assert.equal(t.ratePerWeek, 2.7, '8 bpm over 3 weeks');
  assert.equal(t.projected, 102);
  assert.equal(t.weeksLeft, 8);
  assert.match(t.message, /On track.*1\.5 bpm a week.*92 by 14 Dec.*2\.7/);
});

test('a pace that would fall short is behind, and says where it would end up', () => {
  const t = tempoTrajectory(series([['2026-09-28', 78], ['2026-10-19', 80]], 92), EXAM, NOW);
  assert.equal(t.status, 'behind');
  assert.equal(t.ratePerWeek, 0.7);
  assert.equal(t.projected, 86);
  assert.match(t.message, /Behind: 1\.5 bpm a week is needed to reach 92 by 14 Dec, but you are managing 0\.7.*about 86/);
});

test('a tempo that has not risen, or has fallen, is behind in plain words', () => {
  for (const [a, b] of [[80, 80], [84, 80]]) {
    const t = tempoTrajectory(series([['2026-09-28', a], ['2026-10-19', b]], 92), EXAM, NOW);
    assert.equal(t.status, 'behind');
    assert.match(t.message, /hasn't risen in the last four weeks/);
  }
});

test('with under a week to go, all of the gap is needed at once', () => {
  const t = tempoTrajectory(series([['2026-09-28', 78], ['2026-10-19', 80]], 92), '2026-10-24', NOW);
  assert.equal(t.needPerWeek, 12);
  assert.equal(t.status, 'behind');
});

test('a pace that lands exactly on the target is on track', () => {
  const t = tempoTrajectory(series([['2026-10-05', 77], ['2026-10-19', 80]], 92), EXAM, NOW);
  assert.equal(t.ratePerWeek, 1.5);
  assert.equal(t.projected, 92);
  assert.equal(t.status, 'on-track');
});

// ── a piece's page ────────────────────────────────────────────────────────────────────────────

function pieceStory() {
  const piece = { id: 'c1', title: 'Minuet in F', composer: 'Mozart', status: 'consolidating', grade: 'Grade 3', tempo: '92', notes: '  LH Alberti  ' };
  const sessions = [
    { ...session('2026-09-20', [rseg('c1', { tempo: 70, duration: 20, section: 'Bars 1-8' })]), id: 's1' },
    { ...session('2026-10-05', [rseg('c1', { tempo: 76, duration: 15, runThroughs: 2 }), rseg('c2', { duration: 30, tempo: 99 })]), id: 's2' },
    { ...session('2026-10-12', [rseg('c1', { tempo: 80, duration: 10, runThroughs: 3 }), rseg('c1', { duration: 5 }), { type: 'technique', group: 'Hanon', compositionId: 'c1', duration: 40, tempo: 120 }]), id: 's3' },
    { ...session('2026-10-25', [rseg('c1', { tempo: 99, duration: 99 })]), id: 'future' },
  ];
  const lessons = [
    lesson('l1', '2026-10-01', [aSeg({ id: 'a', compositionId: 'c1', assignment: 'Clean the trill', feedback: 'Lighter left hand' }), aSeg({ id: 'b', compositionId: 'c2', assignment: 'Other piece' })]),
    lesson('l2', '2026-10-08', [aSeg({ id: 'c', compositionId: 'c1', assignment: '', feedback: 'Better' }), aSeg({ id: 'd', compositionId: 'c1', assignment: '' })]),
  ];
  return { piece, sessions, lessons };
}

test('a piece\'s page counts what has been practised: sessions, minutes and when', () => {
  const { piece, sessions, lessons } = pieceStory();
  const r = pieceReport(piece, sessions, lessons, NOW, '2026-12-14');
  assert.deepEqual(r.practice, { sessions: 3, minutes: 50, firstDate: '2026-09-20', lastDate: '2026-10-12', daysSince: 7 }, 'repertoire only, nothing from the future');
  assert.equal(r.title, 'Minuet in F');
  assert.deepEqual(r.notes, [{ label: 'Notes', text: 'LH Alberti' }], 'trimmed');
  assert.deepEqual([r.composer, r.status, r.grade], ['Mozart', 'consolidating', 'Grade 3']);
});

test('its tempo, next step and projection come from its own readings only', () => {
  const { piece, sessions, lessons } = pieceStory();
  const r = pieceReport(piece, sessions, lessons, NOW, '2026-12-14');
  assert.deepEqual(r.tempo.points.map(p => p.bpm), [70, 76, 80], 'not the other piece\'s 99, not the technique 120, not the future');
  assert.equal(r.tempo.target, 92);
  assert.equal(r.next.bpm, 84);
  assert.equal(r.trajectory.status, 'on-track', '10 bpm in 3 weeks is more than the 1.5 a week needed');
  assert.equal(r.stalled, null);
});

test('its run-throughs and its recent sessions, newest first', () => {
  const { piece, sessions, lessons } = pieceStory();
  const r = pieceReport(piece, sessions, lessons, NOW);
  assert.equal(r.runThroughs.total, 5);
  assert.deepEqual(r.recent.map(x => [x.date, x.minutes, x.tempo, x.runThroughs]), [
    ['2026-10-12', 10, 80, 3], ['2026-10-12', 5, null, 0], ['2026-10-05', 15, 76, 2], ['2026-09-20', 20, 70, 0],
  ]);
  assert.equal(r.recent[3].section, 'Bars 1-8');
});

test('what your teacher said about it is listed newest first, and other pieces are left out', () => {
  const { piece, sessions, lessons } = pieceStory();
  const r = pieceReport(piece, sessions, lessons, NOW);
  assert.deepEqual(r.fromLessons, [
    { date: '2026-10-08', assignment: null, feedback: 'Better', done: false },
    { date: '2026-10-01', assignment: 'Clean the trill', feedback: 'Lighter left hand', done: false },
  ], 'a lesson segment with neither is not listed');
});

test('a piece that has never been practised has an empty but well-formed page', () => {
  const r = pieceReport({ id: 'new', title: 'Dream' }, [], [], NOW);
  assert.deepEqual(r.practice, { sessions: 0, minutes: 0, firstDate: null, lastDate: null, daysSince: null });
  assert.deepEqual([r.tempo, r.next, r.stalled, r.trajectory, r.runThroughs], [null, null, null, null, null]);
  assert.deepEqual([r.recent, r.fromLessons], [[], []]);
  assert.equal(r.composer, null);
  assert.equal(pieceReport(null, [], [], NOW), null);
});

test('at most eight recent sessions and four lesson notes are shown', () => {
  const sessions = Array.from({ length: 12 }, (_, i) => ({ ...session(`2026-09-${String(i + 1).padStart(2, '0')}`, [rseg('c1', { duration: 5 })]), id: `s${i}` }));
  const lessons = Array.from({ length: 6 }, (_, i) => lesson(`l${i}`, `2026-09-${String(i + 10).padStart(2, '0')}`, [aSeg({ id: `a${i}`, compositionId: 'c1', feedback: `note ${i}` })]));
  const r = pieceReport({ id: 'c1', title: 'P' }, sessions, lessons, NOW);
  assert.equal(r.recent.length, 8);
  assert.equal(r.fromLessons.length, 4);
  assert.equal(r.practice.sessions, 12);
  assert.equal(r.recent[0].date, '2026-09-12', 'the newest');
});

// ── tricky spots ──────────────────────────────────────────────────────────────────────────

test('a spot reads naturally: a bare range of bars gets "Bars", anything else is as typed', () => {
  assert.equal(spotLabel('9-12'), 'Bars 9-12');
  assert.equal(spotLabel('9'), 'Bars 9');
  assert.equal(spotLabel('  9 \u2013 12 '), 'Bars 9 \u2013 12');
  assert.equal(spotLabel('the left hand jump'), 'the left hand jump');
  assert.equal(spotLabel('Bars 9-12'), 'Bars 9-12', 'already says it');
  assert.equal(spotLabel('  LH   jump '), 'LH jump', 'spaces tidied');
  assert.equal(spotLabel(''), '');
  assert.equal(spotLabel(undefined), '');
});

test('stored spots are cleaned: junk and blanks dropped, a spot listed once, the status made sensible', () => {
  const out = parseSpots([
    { id: 'a', bars: 'Bars 9-12', status: 'open', added: '2026-10-01' },
    { id: 'b', bars: 'bar 9\u201312', status: 'fixed' },
    { bars: 'LH jump', status: 'weird', added: '2026-10-02', fixed: '2026-10-09' },
    { id: 'c', bars: '   ' }, null, 'text', 7, { id: 'd' },
  ]);
  assert.deepEqual(out.map(x => x.bars), ['Bars 9-12', 'LH jump'], 'the same spot written two ways is one spot');
  assert.deepEqual(out[1], { id: 'lhjump', bars: 'LH jump', status: 'open', added: '2026-10-02', fixed: null }, 'a made-up status is open, and an open spot has no fixed date');
  assert.deepEqual(parseSpots(undefined), []);
  assert.deepEqual(parseSpots({}), []);
});

test('adding a spot puts it on the list, open, with the date', () => {
  let n = 0;
  const out = addSpot([], '  9-12 ', '2026-10-19', () => `id${++n}`);
  assert.deepEqual(out, [{ id: 'id1', bars: '9-12', status: 'open', added: '2026-10-19', fixed: null }]);
  assert.deepEqual(addSpot(out, 'LH jump', '2026-10-20', () => 'id2').map(x => x.id), ['id1', 'id2']);
});

test('nothing is added for blank text, or for a spot already open however it is written', () => {
  const one = addSpot([], 'Bars 9-12', '2026-10-19', () => 'a');
  assert.deepEqual(addSpot(one, '', '2026-10-20'), one);
  assert.deepEqual(addSpot(one, '   ', '2026-10-20'), one);
  assert.deepEqual(addSpot(one, 'bar 9 \u2013 12', '2026-10-20'), one);
  assert.deepEqual(addSpot(one, '9-12', '2026-10-20'), one);
});

test('a spot you had fixed comes back open when it goes wrong again', () => {
  const fixed = [{ id: 'a', bars: 'Bars 9-12', status: 'fixed', added: '2026-10-01', fixed: '2026-10-08' }];
  assert.deepEqual(addSpot(fixed, '9-12', '2026-10-20'), [{ id: 'a', bars: 'Bars 9-12', status: 'open', added: '2026-10-01', fixed: null }]);
});

test('ticking a spot off records the day, and can be undone; removing deletes it', () => {
  const list = [{ id: 'a', bars: '9-12', status: 'open', added: '2026-10-01', fixed: null }, { id: 'b', bars: 'LH jump', status: 'open', added: '2026-10-02', fixed: null }];
  const done = setSpotFixed(list, 'a', true, '2026-10-19');
  assert.deepEqual([done[0].status, done[0].fixed, done[1].status], ['fixed', '2026-10-19', 'open']);
  assert.deepEqual([setSpotFixed(done, 'a', false, '2026-10-20')[0].status, setSpotFixed(done, 'a', false, '2026-10-20')[0].fixed], ['open', null]);
  assert.deepEqual(removeSpot(list, 'a').map(x => x.id), ['b']);
  assert.deepEqual(setSpotFixed(list, 'nope', true, '2026-10-19'), list, 'an unknown id changes nothing');
  assert.equal(list[0].status, 'open', 'the list passed in is untouched');
});

test('the open spots, the longest-standing first, and how they read in a line', () => {
  const piece = { spots: [
    { id: 'a', bars: 'LH jump', status: 'open', added: '2026-10-10' },
    { id: 'b', bars: '9-12', status: 'open', added: '2026-10-01' },
    { id: 'c', bars: '1-4', status: 'fixed', added: '2026-09-01', fixed: '2026-09-10' },
  ] };
  assert.deepEqual(openSpots(piece).map(x => x.id), ['b', 'a']);
  assert.equal(openSpotsLine(piece), 'Bars 9-12, LH jump');
  assert.equal(openSpotsLine({}), '');
  assert.equal(openSpotsLine(undefined), '');
});

test('a piece\'s page lists its spots, open and fixed apart', () => {
  const piece = { id: 'c1', title: 'Minuet', spots: [{ id: 'a', bars: '9-12', status: 'open', added: '2026-10-01' }, { id: 'b', bars: '1-4', status: 'fixed', added: '2026-09-01', fixed: '2026-09-10' }] };
  const r = pieceReport(piece, [], [], NOW);
  assert.deepEqual(r.spots.open.map(x => x.id), ['a']);
  assert.deepEqual(r.spots.fixed.map(x => x.id), ['b']);
  assert.deepEqual(pieceReport({ id: 'x', title: 'Y' }, [], [], NOW).spots, { open: [], fixed: [] });
});

test('the lesson summary lists the open spots of the pieces you played since the lesson', () => {
  const { lessons, sessions } = story();
  const comps = [
    { id: 'c1', title: 'Minuet in F', tempo: 92, spots: [{ id: 'a', bars: '9-12', status: 'open', added: '2026-10-01' }] },
    { id: 'c2', title: 'Ocean View', spots: [{ id: 'b', bars: 'trill', status: 'fixed', added: '2026-10-01', fixed: '2026-10-05' }] },
    { id: 'c3', title: 'Not played', spots: [{ id: 'c', bars: '1-2', status: 'open', added: '2026-10-01' }] },
  ];
  const b = lessonBrief(lessons, sessions, comps, NOW);
  assert.deepEqual(b.spots, [{ name: 'Minuet in F', line: 'Bars 9-12' }]);
  assert.ok(briefText(b).includes('Tricky spots still open\n- Minuet in F: Bars 9-12'));
  assert.ok(!briefText(lessonBrief(lessons, sessions, comps2, NOW)).includes('Tricky spots'), 'nothing to say when there are none');
});

test('the weekly review carries the open spots of pieces being worked on, three at most', () => {
  const comps = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id.toUpperCase(), status: 'learning', spots: [{ id: `s${id}`, bars: '9-12', status: 'open', added: '2026-10-01' }] }));
  comps.push({ id: 'z', title: 'Shelved', status: 'shelved', spots: [{ id: 'sz', bars: '1-2', status: 'open' }] });
  const r = weeklyReview([], [], comps, NOW);
  assert.equal(r.carry.spots.length, 3);
  assert.deepEqual(r.carry.spots[0], { name: 'A', line: 'Bars 9-12' });
  assert.ok(weeklyText(r).includes('- Tricky spots to fix: A (Bars 9-12), B (Bars 9-12), C (Bars 9-12)'));
  assert.deepEqual(weeklyReview([], [], [{ id: 'q', title: 'Q', status: 'learning' }], NOW).carry.spots, []);
});

test('spots on a shelved piece are not carried into the week, even when there is room', () => {
  const comps = [
    { id: 'z', title: 'Shelved', status: 'shelved', spots: [{ id: 'sz', bars: '1-2', status: 'open' }] },
    { id: 'l', title: 'Learning', status: 'learning', spots: [{ id: 'sl', bars: '3-4', status: 'open' }] },
  ];
  assert.deepEqual(weeklyReview([], [], comps, NOW).carry.spots.map(x => x.name), ['Learning']);
});

test('a piece\'s notes are the text fields the library keeps, labelled, in a fixed order, with blanks left out', () => {
  const r = pieceReport({
    id: 'c1', title: 'P', myNotes: ' keep it light ', technicalChallenges: 'Trill in bar 4', musicalFocus: '   ',
    kerrinNotes: 'Shape the line', teacherFeedback: '', practiceNotes: 'Hands apart first', info: 'From the grade 3 list',
  }, [], [], NOW);
  assert.deepEqual(r.notes, [
    { label: 'Technical challenges', text: 'Trill in bar 4' },
    { label: 'Practice notes', text: 'Hands apart first' },
    { label: 'Teacher notes', text: 'Shape the line' },
    { label: 'My notes', text: 'keep it light' },
    { label: 'About the piece', text: 'From the grade 3 list' },
  ]);
  assert.deepEqual(pieceReport({ id: 'x', title: 'Y' }, [], [], NOW).notes, []);
});
