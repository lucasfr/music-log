// Tests for what your energy rating goes with (src/utils/energyInsight.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/utils/energyInsight.js'), 'utf8');
const { energyInsight, MIN_RATED, MIN_GROUP, ENERGY_NOTE } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

let n = 0;
// A session with the things the insight reads. `progress` is how many progress tags its one segment has.
const session = ({ energy, duration = 30, enjoyment = 4, progress = 1, felt = 3 } = {}) => ({
  id: `s${++n}`, date: '2026-10-01', energy, duration, enjoyment,
  segments: [{ id: `g${n}`, type: 'repertoire', feltDifficulty: felt, progress: Array.from({ length: progress }, (_, i) => `p${i}`) }],
});
const many = (count, opts) => Array.from({ length: count }, () => session(opts));
const group = (result, key) => result.groups.find(g => g.key === key);

test('with too few rated sessions it says how many it has, and says nothing else', () => {
  const r = energyInsight(many(MIN_RATED - 1, { energy: 1 }));
  assert.equal(r.ready, false);
  assert.equal(r.rated, MIN_RATED - 1);
  assert.equal(r.needed, 1);
  assert.match(r.reason, new RegExp(`You have ${MIN_RATED - 1}`));
  assert.equal('lines' in r, false);
});

test('sessions with no energy rating are not counted: unset is not neutral, but 0 is', () => {
  const unset = [undefined, null, ''].flatMap(energy => many(5, { energy }));
  assert.equal(energyInsight(unset).rated, 0);
  const zeros = energyInsight(many(MIN_RATED, { energy: 0 }));
  assert.equal(zeros.rated, MIN_RATED, 'an energy of 0 is a real rating');
});

test('twelve sessions at one energy level are not enough to compare, and it says so', () => {
  const r = energyInsight(many(MIN_RATED, { energy: 0 }));
  assert.equal(r.ready, false);
  assert.equal(r.needed, 0);
  assert.match(r.reason, /one energy level/);
});

test('both ends need a few sessions each', () => {
  const r = energyInsight([...many(MIN_GROUP - 1, { energy: 2 }), ...many(10, { energy: -2 })]);
  assert.equal(r.ready, false, 'two high-energy sessions is too few');
});

test('a clear difference is reported on each measure, in the direction it goes, with the numbers', () => {
  const sessions = [
    ...many(6, { energy: 2, duration: 40, progress: 2, enjoyment: 5, felt: 2 }),
    ...many(6, { energy: -2, duration: 20, progress: 0, enjoyment: 3, felt: 4 }),
  ];
  const r = energyInsight(sessions);
  assert.equal(r.ready, true);
  assert.equal(r.lines.length, 4);
  assert.match(r.lines[0], /longer when your energy is high: 40 min a session on average, against 20 min/);
  assert.match(r.lines[1], /progress is ticked off on high-energy days: 2\.0 progress tags a session, against 0\.0/);
  assert.match(r.lines[2], /enjoy high-energy sessions more: 5\.0 out of 5, against 3\.0/);
  assert.match(r.lines[3], /Pieces feel easier when your energy is high: felt difficulty 2\.0, against 4\.0/);
  assert.equal(r.note, ENERGY_NOTE);
});

test('the other way round is said the other way round', () => {
  const r = energyInsight([
    ...many(5, { energy: 1, duration: 20, progress: 0, enjoyment: 3, felt: 4 }),
    ...many(5, { energy: -1, duration: 45, progress: 2, enjoyment: 5, felt: 2 }),
    ...many(2, { energy: 0 }),
  ]);
  assert.match(r.lines[0], /longer when your energy is low: 45 min/);
  assert.match(r.lines[1], /More progress is ticked off on low-energy days/);
  assert.match(r.lines[2], /enjoy low-energy sessions more/);
  assert.match(r.lines[3], /Pieces feel harder when your energy is high: felt difficulty 4\.0, against 2\.0/);
});

test('sessions that look alike give "no clear difference", not an invented one', () => {
  const r = energyInsight([...many(6, { energy: 2 }), ...many(6, { energy: -2 })]);
  assert.equal(r.ready, true);
  assert.deepEqual(r.lines.length, 1);
  assert.match(r.lines[0], /No clear difference yet/);
});

test('a small gap is not reported: four minutes, or a tenth of a point, is noise', () => {
  const r = energyInsight([
    ...many(6, { energy: 2, duration: 34, progress: 1, enjoyment: 4, felt: 3 }),
    ...many(6, { energy: -2, duration: 30, progress: 1, enjoyment: 4, felt: 3 }),
  ]);
  assert.match(r.lines[0], /No clear difference/);
});

test('a measure with too little behind it is left out: three or more sessions at each end that have it', () => {
  const sessions = [
    ...many(6, { energy: 2, duration: 40, enjoyment: 0 }),     // enjoyment never rated
    ...many(6, { energy: -2, duration: 20, enjoyment: 0 }),
  ];
  const r = energyInsight(sessions);
  assert.ok(r.lines.some(l => /longer when your energy is high/.test(l)));
  assert.ok(!r.lines.some(l => /enjoy/.test(l)), 'no enjoyment line from sessions with no enjoyment');
});

test('the groups hold what the table shows: sessions at each end, and the averages', () => {
  const r = energyInsight([
    ...many(4, { energy: 2, duration: 40, enjoyment: 5, progress: 2, felt: 2 }),
    ...many(3, { energy: 1, duration: 20, enjoyment: 3, progress: 0, felt: 4 }),
    ...many(2, { energy: 0, duration: 10 }),
    ...many(3, { energy: -2, duration: 10 }),
  ]);
  assert.deepEqual(r.groups.map(g => [g.key, g.sessions]), [['low', 3], ['okay', 2], ['high', 7]]);
  assert.equal(Math.round(group(r, 'high').minutes), Math.round((4 * 40 + 3 * 20) / 7));
  assert.equal('counts' in group(r, 'high'), false, 'the bookkeeping is not part of the answer');
});

test('missing durations, junk segments and empty entries do not break it, and the input is untouched', () => {
  const sessions = [
    null, undefined, {}, { energy: 1, segments: 'oops' }, { energy: 1, segments: [null, { progress: 'x' }] },
    ...many(6, { energy: 2, duration: undefined }), ...many(6, { energy: -2, duration: 0 }),
  ];
  const copy = JSON.parse(JSON.stringify(sessions));
  assert.doesNotThrow(() => energyInsight(sessions));
  assert.deepEqual(JSON.parse(JSON.stringify(sessions)), copy);
  assert.equal(energyInsight(null).ready, false);
  assert.equal(energyInsight(undefined).ready, false);
});

test('energy kept as text still counts, and nothing in between is lost', () => {
  const r = energyInsight([...many(6, { energy: '2' }), ...many(6, { energy: '-2' })]);
  assert.equal(r.ready, true);
  assert.equal(group(r, 'high').sessions, 6);
  assert.equal(group(r, 'low').sessions, 6);
});
