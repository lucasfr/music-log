// "Log tempo as clean" in the practice timer: the metronome's tempo becomes the segment's clean tempo
// (withCleanTempo, src/utils/insights.js), and goes to the log form with the segment (src/utils/timerLog.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = async file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src/utils', file), 'utf8')).toString('base64'));
const { withCleanTempo, tempoProgress } = await load('insights.js');
const { timerToLogSegments } = await load('timerLog.js');

const piece = { id: 'a', type: 'repertoire', title: 'Minuet', compositionId: 'c1', plannedMinutes: 10 };

test('the metronome\'s tempo becomes the segment\'s clean tempo', () => {
  assert.equal(withCleanTempo(piece, 84).tempo, 84);
  assert.equal(withCleanTempo({ ...piece, tempo: 70 }, 84).tempo, 84, 'replacing an earlier one');
});

test('the tempo is rounded and kept within the metronome\'s own range', () => {
  assert.equal(withCleanTempo(piece, 83.6).tempo, 84);
  assert.equal(withCleanTempo(piece, '90').tempo, 90, 'typed as text');
  assert.equal(withCleanTempo(piece, 500).tempo, 240);
  assert.equal(withCleanTempo(piece, 10).tempo, 30);
});

test('something that is not a usable tempo clears it', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'fast']) {
    assert.equal('tempo' in withCleanTempo({ ...piece, tempo: 70 }, bad), false, String(bad));
  }
});

test('the rest of the segment is untouched, and the segment passed in is not changed', () => {
  const seg = { ...piece, runThroughs: 2, dynamics: ['p'] };
  const out = withCleanTempo(seg, 84);
  assert.deepEqual({ ...out, tempo: undefined }, { ...seg, tempo: undefined });
  assert.equal('tempo' in seg, false);
});

test('a finished timer hands the clean tempo to the log form, for pieces and exercises', () => {
  const out = timerToLogSegments([
    { id: 'a', type: 'repertoire', title: 'Minuet', compositionId: 'c1', tempo: 84 },
    { id: 'b', type: 'technique', title: 'Hanon', tempo: '96' },
  ], () => 10);
  assert.deepEqual(out.map(s => s.tempo), [84, 96]);
});

test('the log form gets no tempo key when none was logged', () => {
  const out = timerToLogSegments([
    { id: 'a', type: 'repertoire', title: 'Minuet' },
    { id: 'b', type: 'technique', title: 'Hanon', tempo: 0 },
    { id: 'c', type: 'technique', title: 'Scales', tempo: 'x' },
  ], () => 5);
  assert.deepEqual(out.map(s => 'tempo' in s), [false, false, false]);
});

test('a tempo logged from the timer feeds the tempo progress once the session is saved', () => {
  const [seg] = timerToLogSegments([{ id: 'a', type: 'repertoire', title: 'Minuet', compositionId: 'c1', tempo: 84 }], () => 10);
  const items = tempoProgress([{ id: 's', date: '2026-10-19', segments: [seg] }], [{ id: 'c1', title: 'Minuet', tempo: 92 }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].latest, 84);
  assert.equal(items[0].target, 92);
});
