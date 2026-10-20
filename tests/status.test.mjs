// Tests for how a piece's status is derived (src/utils/status.js).  Run with: npm test
//
// The clock-change cases only mean something in a timezone with daylight saving, so this file sets its
// own (each test file runs in its own process). UK clocks went forward on 2026-03-29.
process.env.TZ = 'Europe/London';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/status.js'), 'utf8');
const {
  PROGRESS_TAG_TO_STATUS, STATUS_RANK, RANK_TO_STATUS, SHELVED_AFTER_DAYS,
  deriveCompositionStatus, deriveStatusHistory,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const TODAY = '2026-10-19';
const log = (date, progress = [], minutes = 10, id = 'c1') => ({ id: date, date, segments: [{ compositionId: id, progress, duration: minutes }] });
const status = (sessions, { lessons = [], manual = null, today = TODAY } = {}) => deriveCompositionStatus('c1', sessions, lessons, manual, today);
const history = (sessions, { lessons = [], manual = null, today = TODAY } = {}) => deriveStatusHistory('c1', sessions, lessons, manual, today);

test('the constants hang together', () => {
  assert.equal(SHELVED_AFTER_DAYS, 60);
  assert.deepEqual(RANK_TO_STATUS.map(s => STATUS_RANK[s]), [0, 1, 2, 3], 'each rank names its status');
  for (const s of Object.values(PROGRESS_TAG_TO_STATUS)) assert.ok(s in STATUS_RANK, `${s} is a stage`);
  assert.equal(PROGRESS_TAG_TO_STATUS.breakthrough, undefined, 'a single session\'s feel is not a stage');
  assert.equal(PROGRESS_TAG_TO_STATUS.plateau, undefined);
});

// ── the status now ──────────────────────────────────────────────────────────────────────────

test('a piece with nothing logged is an ambition; one log is new; a second makes it learning', () => {
  assert.equal(status([]), 'ambition');
  assert.equal(status([log('2026-10-10', [], 10, 'other')]), 'ambition', 'another piece\'s practice does not count');
  assert.equal(status([log('2026-10-10')]), 'new');
  assert.equal(status([log('2026-10-10'), log('2026-10-12')]), 'learning');
});

test('progress tags move a piece up, and only the stage tags count', () => {
  assert.equal(status([log('2026-10-10', ['consolidation'])]), 'consolidating');
  assert.equal(status([log('2026-10-10', ['performance-ready'])]), 'performance-ready');
  assert.equal(status([log('2026-10-10', ['breakthrough', 'plateau'])]), 'new');
  assert.equal(status([log('2026-10-10', ['new-piece'])]), 'new');
});

test('the highest stage reached is kept when later sessions do not repeat the tag', () => {
  assert.equal(status([log('2026-10-01', ['performance-ready']), log('2026-10-10'), log('2026-10-15')]), 'performance-ready');
  assert.equal(status([log('2026-10-01', ['consolidation']), log('2026-10-10', ['new-piece'])]), 'consolidating', 'a lower tag does not move it back');
});

test('lessons count as practice for the piece', () => {
  const lesson = { id: 'l', date: '2026-10-12', segments: [{ compositionId: 'c1', progress: ['consolidation'] }] };
  assert.equal(status([log('2026-10-10')], { lessons: [lesson] }), 'consolidating');
  assert.equal(status([], { lessons: [lesson] }), 'consolidating');
});

test('a piece left for 60 days is shelved, on the 60th day and not the 59th', () => {
  assert.equal(status([log('2026-08-20')]), 'shelved', '60 days before 19 Oct');
  assert.equal(status([log('2026-08-21')]), 'new', '59 days');
});

test('the 60 days are calendar days, including across the clocks going forward', () => {
  assert.equal(status([log('2026-03-28')], { today: '2026-05-27' }), 'shelved', '60 days over the spring change; it used to be shelved a day late');
  assert.equal(status([log('2026-03-28')], { today: '2026-05-26' }), 'new');
});

test('shelving does not depend on what time of day it is: the date is all that is used', () => {
  assert.equal(status([log('2026-08-20')], { today: '2026-10-19' }), 'shelved');
  assert.equal(status([log('2026-08-20')], { today: '2026-10-19' }), status([log('2026-08-20')], { today: '2026-10-19' }));
});

test('shelving by hand holds until something is logged after that date', () => {
  assert.equal(status([log('2026-10-10')], { manual: '2026-10-15' }), 'shelved');
  assert.equal(status([log('2026-10-15')], { manual: '2026-10-15' }), 'shelved', 'a log on the day itself does not un-shelve it');
  assert.equal(status([log('2026-10-10'), log('2026-10-16')], { manual: '2026-10-15' }), 'learning', 'practice after it resumes');
});

test('missing input does not throw', () => {
  assert.equal(deriveCompositionStatus('c1', undefined, undefined, null, TODAY), 'ambition');
  assert.deepEqual(deriveStatusHistory('c1', undefined, undefined, null, TODAY), []);
});

// ── the history ─────────────────────────────────────────────────────────────────────────────

test('one log is one stretch from that day to today', () => {
  assert.deepEqual(history([log('2026-10-01', [], 20)]), [{ status: 'new', start: '2026-10-01', end: TODAY, count: 1, minutes: 20 }]);
  assert.deepEqual(history([]), []);
});

test('each stage is one row, with how many logs and minutes it covers', () => {
  const rows = history([log('2026-10-01', [], 10), log('2026-10-05', [], 15), log('2026-10-09', [], 5)]);
  assert.deepEqual(rows.map(r => [r.status, r.start, r.end, r.count, r.minutes]), [
    ['new', '2026-10-01', '2026-10-05', 1, 10],
    ['learning', '2026-10-05', TODAY, 2, 20],
  ]);
});

test('logs come out in date order whatever order they were given in', () => {
  const a = history([log('2026-10-09'), log('2026-10-01'), log('2026-10-05')]);
  const b = history([log('2026-10-01'), log('2026-10-05'), log('2026-10-09')]);
  assert.deepEqual(a, b);
});

test('a gap of more than 60 days shows a shelved stretch, and exactly 60 does not', () => {
  const rows = history([log('2026-01-01'), log('2026-04-15')], { today: '2026-04-20' });
  assert.deepEqual(rows.map(r => r.status), ['new', 'shelved', 'learning']);
  assert.deepEqual([rows[1].start, rows[1].end, rows[1].count], ['2026-03-02', '2026-04-15', 0]);
  assert.deepEqual(history([log('2026-01-01'), log('2026-03-02')], { today: '2026-03-10' }).map(r => r.status), ['new', 'learning'], '60 days exactly: still active');
});

test('a gap of 61 days over the clocks going forward still shows as shelved (it used to be counted as 60)', () => {
  assert.deepEqual(history([log('2026-02-01'), log('2026-04-03')], { today: '2026-04-10' }).map(r => r.status), ['new', 'shelved', 'learning']);
});

test('a piece last logged long ago ends with a shelved stretch up to today', () => {
  const rows = history([log('2026-05-01')]);
  assert.deepEqual(rows.map(r => r.status), ['new', 'shelved']);
  assert.equal(rows[1].end, TODAY);
});

test('shelving by hand clips the history at that date and ends it shelved', () => {
  const rows = history([log('2026-08-20', [], 25)], { manual: '2026-09-01' });
  assert.deepEqual(rows, [
    { status: 'new', start: '2026-08-20', end: '2026-09-01', count: 1, minutes: 25 },
    { status: 'shelved', start: '2026-09-01', end: TODAY, count: 0, minutes: 0 },
  ]);
});

test('the history and the status now agree about the latest stage', () => {
  const cases = [
    [log('2026-10-10')],
    [log('2026-10-01'), log('2026-10-10', ['consolidation'])],
    [log('2026-06-01')],
    [log('2026-10-10', ['performance-ready']), log('2026-10-12')],
  ];
  for (const sessions of cases) {
    const rows = history(sessions);
    assert.equal(rows[rows.length - 1].status, status(sessions), JSON.stringify(sessions.map(s => s.date)));
  }
});
