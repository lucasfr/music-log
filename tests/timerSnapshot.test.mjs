// Tests for saving and restoring a practice timer (src/utils/timerSnapshot.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/timerSnapshot.js'), 'utf8');
const { buildSnapshot, parseSnapshot, snapshotSummary, worthResuming, SNAPSHOT_MAX_AGE_MS, SNAPSHOT_KEY } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const NOW = 1_800_000_000_000;
const MIN = 60000;
const segments = [
  { id: 'a', type: 'technique', title: 'Hanon', plannedMinutes: 10 },
  { id: 'b', type: 'repertoire', title: 'Minuet in F', compositionId: 'c1', plannedMinutes: 15 },
];

test('a paused timer is saved with the time it has banked', () => {
  const snap = buildSnapshot({ segments, currentIndex: 1, elapsedMs: [10 * MIN, 3 * MIN], runStart: null, isRunning: false, now: NOW });
  assert.deepEqual(snap.elapsedMs, [10 * MIN, 3 * MIN]);
  assert.equal(snap.currentIndex, 1);
  assert.equal(snap.savedAt, NOW);
});

test('a running timer is saved with its live time added to the current segment', () => {
  const snap = buildSnapshot({ segments, currentIndex: 1, elapsedMs: [10 * MIN, 3 * MIN], runStart: NOW - 90000, isRunning: true, now: NOW });
  assert.equal(snap.elapsedMs[1], 3 * MIN + 90000);
  assert.equal(snap.elapsedMs[0], 10 * MIN, 'other segments are untouched');
});

test('building a snapshot does not change the timer state it was given', () => {
  const elapsedMs = [0, MIN];
  buildSnapshot({ segments, currentIndex: 1, elapsedMs, runStart: NOW - 5000, isRunning: true, now: NOW });
  assert.deepEqual(elapsedMs, [0, MIN]);
});

test('a snapshot survives being saved as text and read back', () => {
  const snap = buildSnapshot({ segments, currentIndex: 0, elapsedMs: [2 * MIN, 0], runStart: null, isRunning: false, now: NOW });
  assert.deepEqual(parseSnapshot(JSON.stringify(snap), NOW + 5 * MIN), snap);
});

test('nothing saved, or damage, means nothing to resume', () => {
  for (const raw of [undefined, null, '', 'not json', '[]', '42', 'null', '{}']) assert.equal(parseSnapshot(raw, NOW), null, String(raw));
});

test('a snapshot older than six hours is a different day, not an interruption', () => {
  const snap = JSON.stringify(buildSnapshot({ segments, currentIndex: 0, elapsedMs: [0, 0], runStart: null, isRunning: false, now: NOW }));
  assert.ok(parseSnapshot(snap, NOW + SNAPSHOT_MAX_AGE_MS));
  assert.equal(parseSnapshot(snap, NOW + SNAPSHOT_MAX_AGE_MS + 1), null);
});

test('a snapshot from the future (a clock that moved) is not trusted', () => {
  const snap = JSON.stringify(buildSnapshot({ segments, currentIndex: 0, elapsedMs: [0, 0], runStart: null, isRunning: false, now: NOW + 10 * MIN }));
  assert.equal(parseSnapshot(snap, NOW), null);
});

test('a snapshot with the wrong shape is refused rather than restored into a broken timer', () => {
  const ok = buildSnapshot({ segments, currentIndex: 0, elapsedMs: [0, 0], runStart: null, isRunning: false, now: NOW });
  const bad = [
    { ...ok, v: 2 }, { ...ok, segments: [] }, { ...ok, segments: [{ title: 'x' }] },
    { ...ok, currentIndex: 5 }, { ...ok, currentIndex: -1 }, { ...ok, currentIndex: 0.5 },
    { ...ok, elapsedMs: [0] }, { ...ok, elapsedMs: [0, -1] }, { ...ok, elapsedMs: [0, 'x'] }, { ...ok, savedAt: 'x' },
  ];
  for (const s of bad) assert.equal(parseSnapshot(JSON.stringify(s), NOW), null, JSON.stringify(s).slice(0, 60));
});

test('the summary names the segments, how far through, and how long ago', () => {
  const snap = buildSnapshot({ segments, currentIndex: 1, elapsedMs: [10 * MIN, 3 * MIN], runStart: null, isRunning: false, now: NOW });
  assert.deepEqual(snapshotSummary(snap, NOW + 12 * MIN), { names: 'Hanon, Minuet in F', used: 13, planned: 25, ago: '12 min ago' });
  assert.equal(snapshotSummary(snap, NOW + 30000).ago, 'just now');
  assert.equal(snapshotSummary(snap, NOW + 185 * MIN).ago, '3 h ago');
});

test('the summary shortens a long plan and names untitled segments', () => {
  const many = ['A', 'B', 'C', 'D', 'E'].map((t, i) => ({ id: `s${i}`, type: 'repertoire', title: t, plannedMinutes: 5 }));
  const snap = buildSnapshot({ segments: many, currentIndex: 0, elapsedMs: many.map(() => 0), runStart: null, isRunning: false, now: NOW });
  assert.equal(snapshotSummary(snap, NOW).names, 'A, B, C +2 more');
  const untitled = buildSnapshot({ segments: [{ id: 'x', type: 'technique', plannedMinutes: 5 }, { id: 'y', type: 'repertoire', plannedMinutes: 5 }], currentIndex: 0, elapsedMs: [0, 0], runStart: null, isRunning: false, now: NOW });
  assert.equal(snapshotSummary(untitled, NOW).names, 'Technical work, Piece');
});

test('the preference key is stable', () => { assert.equal(SNAPSHOT_KEY, 'timerSnapshot'); });

test('a timer needs a minute of practice to be worth offering back', () => {
  const mk = elapsedMs => buildSnapshot({ segments, currentIndex: 0, elapsedMs, runStart: null, isRunning: false, now: NOW });
  assert.equal(worthResuming(mk([0, 0])), false);
  assert.equal(worthResuming(mk([59999, 0])), false);
  assert.equal(worthResuming(mk([MIN, 0])), true);
  assert.equal(worthResuming(mk([30000, 30000])), true, 'it is the total across segments');
});
