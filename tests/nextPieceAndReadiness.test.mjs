import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestNextPieces } from '../src/utils/nextPiece.js';
import { readinessScore, requiredScore, WEIGHTS } from '../src/utils/readinessScore.js';

const P = (id, title, status, extra = {}) => ({ id, title, status, grade: 'Grade 5', ...extra });

// ── next piece ──

test('no grade or no pieces needed means nothing to say', () => {
  assert.equal(suggestNextPieces([], null), null);
  assert.equal(suggestNextPieces([], { grade: '', piecesNeeded: 3 }), null);
  assert.equal(suggestNextPieces([], { grade: 'Grade 5', piecesNeeded: 0 }), null);
  assert.equal(suggestNextPieces([], { grade: 'Grade 5' }), null);
});

test('enough ready: says so, and suggests nothing more', () => {
  const r = suggestNextPieces([P('a', 'A', 'performance-ready'), P('b', 'B', 'performance-ready'), P('c', 'C', 'learning')], { grade: 'Grade 5', piecesNeeded: 2 });
  assert.equal(r.shortfall, 0);
  assert.deepEqual(r.candidates, []);
  assert.equal(r.line, 'You have 2 pieces performance-ready for Grade 5, enough for the 2 needed.');
});

test('a shortfall: the closest to ready first (consolidating, learning, new, ambition), then by title', () => {
  const comps = [P('1', 'Zed', 'new'), P('2', 'Amber', 'ambition'), P('3', 'Mid', 'learning'), P('4', 'Near', 'consolidating'), P('5', 'Done', 'performance-ready')];
  const r = suggestNextPieces(comps, { grade: 'Grade 5', piecesNeeded: 3 }, 4);
  assert.deepEqual(r.candidates.map(c => c.title), ['Near', 'Mid', 'Zed', 'Amber']);
  assert.equal(r.ready, 1);
  assert.equal(r.shortfall, 2);
  assert.equal(r.line, '1 of 3 performance-ready for Grade 5. Closest to ready: Near, Mid.');
  assert.equal(r.candidates[0].reason, 'nearly there, consolidating');
});

test('not enough pieces in the library at that grade: says how many to add', () => {
  const r = suggestNextPieces([P('a', 'A', 'performance-ready'), P('b', 'B', 'learning')], { grade: 'Grade 5', piecesNeeded: 4 });
  assert.equal(r.shortfall, 3);
  assert.equal(r.line, '1 of 4 performance-ready for Grade 5, and only 1 more piece in your library at that grade: add 2 more.');
});

test('other grades and shelved pieces do not count', () => {
  const r = suggestNextPieces([P('a', 'A', 'performance-ready', { grade: 'Grade 4' }), P('b', 'B', 'performance-ready', { status: 'shelved' }), P('c', 'C', 'learning')], { grade: 'Grade 5', piecesNeeded: 1 });
  assert.equal(r.ready, 0);
  assert.deepEqual(r.candidates.map(c => c.title), ['C']);
});

test('the limit is respected and the input is not changed', () => {
  const comps = Object.freeze([P('1', 'A', 'new'), P('2', 'B', 'new'), P('3', 'C', 'new')].map(Object.freeze));
  assert.equal(suggestNextPieces(comps, { grade: 'Grade 5', piecesNeeded: 3 }, 2).candidates.length, 2);
  assert.equal(suggestNextPieces(comps, { grade: 'Grade 5', piecesNeeded: 3 }, 0).candidates.length, 0);
});

// ── readiness score ──

const full = { scales: { recent: 8, total: 10 }, pieces: { ready: 2, needed: 3 }, sight: { sessions: 3 }, mock: { flagged: 2, count: 8 }, daysLeft: 30 };

test('the weights add up, and a perfect score is 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, v) => a + v, 0), 100);
  const r = readinessScore({ scales: { recent: 5, total: 5 }, pieces: { ready: 3, needed: 3 }, sight: { sessions: 9 }, mock: { flagged: 0, count: 6 }, daysLeft: 10 });
  assert.equal(r.score, 100);
  assert.equal(r.status, 'on track');
});

test('a full set: each part contributes by its weight', () => {
  const r = readinessScore(full);
  // scales 0.8*35 + pieces 0.667*35 + sight 0.5*10 + mock 0.75*20 = 28 + 23.33 + 5 + 15 = 71.33
  assert.equal(r.score, 71);
  assert.deepEqual(r.parts.map(p => p.key), ['scales', 'pieces', 'sight', 'mock']);
  assert.deepEqual(r.parts.map(p => p.percent), [80, 67, 50, 75]);
  assert.equal(r.weakest.key, 'sight');
});

test('a part with nothing to measure is left out and the rest share its weight', () => {
  const r = readinessScore({ scales: { recent: 5, total: 10 }, pieces: { ready: 3, needed: 3 }, daysLeft: null });
  assert.deepEqual(r.parts.map(p => p.key), ['scales', 'pieces']);
  assert.equal(r.score, 75);                                   // (0.5*35 + 1*35) / 70
  assert.equal(readinessScore({ scales: { recent: 0, total: 0 }, pieces: { ready: 0, needed: 0 } }), null);
  assert.equal(readinessScore({}), null);
  assert.equal(readinessScore(null), null);
});

test('on track depends on how long is left: the same score is fine early and behind late', () => {
  const base = { scales: { recent: 5, total: 10 }, pieces: { ready: 1, needed: 2 } };       // 50
  assert.equal(readinessScore({ ...base, daysLeft: 200 }).status, 'on track');
  assert.equal(readinessScore({ ...base, daysLeft: 60 }).status, 'on track');
  assert.equal(readinessScore({ ...base, daysLeft: 30 }).status, 'behind');
  assert.equal(readinessScore({ ...base, daysLeft: 7 }).status, 'behind');
  assert.deepEqual([requiredScore(null), requiredScore(200), requiredScore(60), requiredScore(30), requiredScore(7)], [70, 30, 50, 70, 85]);
});

test('the line names the weakest part when behind, and the days to go', () => {
  const r = readinessScore({ scales: { recent: 1, total: 10 }, pieces: { ready: 2, needed: 2 }, daysLeft: 20 });
  assert.equal(r.status, 'behind');
  assert.equal(r.line, 'Readiness 55: behind with 20 days to go. Weakest: scales and arpeggios (1 of 10 practised in the last 3 weeks).');
  assert.match(readinessScore({ scales: { recent: 9, total: 10 }, pieces: { ready: 2, needed: 2 }, daysLeft: 1 }).line, /^Readiness \d+: on track with 1 day to go\.$/);
});

test('counts are kept in range: more recent than total, more ready than needed, more flagged than the exam had', () => {
  const r = readinessScore({ scales: { recent: 99, total: 10 }, pieces: { ready: 9, needed: 3 }, mock: { flagged: 50, count: 4 } });
  assert.deepEqual(r.parts.map(p => p.percent), [100, 100, 0]);
  assert.ok(r.score >= 0 && r.score <= 100);
});

test('the weakest part breaks ties by weight, so the bigger one is named', () => {
  const r = readinessScore({ scales: { recent: 0, total: 5 }, pieces: { ready: 0, needed: 2 } });
  assert.equal(r.weakest.key, 'scales');                       // both 0; equal weights keep the first
  const t = readinessScore({ scales: { recent: 0, total: 5 }, sight: { sessions: 0 } });
  assert.equal(t.weakest.key, 'scales');                       // scales weigh more than sight-reading
});
