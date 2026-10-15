// Tests for sorting the piece library (sortPieces in src/utils/planning.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/planning.js'), 'utf8');
const { sortPieces, PIECE_SORTS } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const lib = [
  { id: 'c', title: 'Clair de Lune', grade: 'Grade 8' },
  { id: 'a', title: 'A Town with an Ocean View', grade: 'Grade 4' },
  { id: 'm', title: 'Minuet K.2', grade: 'Grade 3' },
  { id: 'x', title: 'Adiyo Kerida' },                       // no grade
  { id: 'g', title: 'Gymnop\u00e9die No. 1', grade: 'Grade 3' },
];
const sessions = [
  { date: '2026-10-01', segments: [{ compositionId: 'm' }, { compositionId: 'g' }] },
  { date: '2026-10-10', segments: [{ compositionId: 'a' }] },
  { date: '2026-10-05', segments: [{ compositionId: 'a' }, { type: 'technique' }] },
];
const ids = list => list.map(p => p.id);

test('A-Z sorts by title (a space sorts before a letter, so "A Town" comes before "Adiyo")', () => {
  assert.deepEqual(ids(sortPieces(lib, sessions, 'title')), ['a', 'x', 'c', 'g', 'm']);
});

test('recent puts the most recently practised first, uses the latest date, and never-practised last', () => {
  // a: 10 Oct (the latest of its two sessions); g and m: 1 Oct (a tie, so by title);
  // x and c: never practised (a tie, so by title)
  assert.deepEqual(ids(sortPieces(lib, sessions, 'recent')), ['a', 'g', 'm', 'x', 'c']);
});

test('grade goes easiest first, ties by title, ungraded last', () => {
  assert.deepEqual(ids(sortPieces(lib, sessions, 'grade')), ['g', 'm', 'a', 'c', 'x']);
});

test('sorting returns a copy and leaves the library alone', () => {
  const before = ids(lib);
  const out = sortPieces(lib, sessions, 'grade');
  assert.notEqual(out, lib);
  assert.deepEqual(ids(lib), before);
});

test('an unknown mode falls back to A-Z, and missing input is safe', () => {
  assert.deepEqual(ids(sortPieces(lib, sessions, 'nonsense')), ids(sortPieces(lib, sessions, 'title')));
  assert.deepEqual(sortPieces(undefined, undefined), []);
  assert.deepEqual(ids(sortPieces(lib, undefined, 'recent')), ['a', 'x', 'c', 'g', 'm'], 'no sessions: nobody has been practised, so A-Z');
});

test('pieces without a title do not break any sort', () => {
  for (const mode of ['title', 'recent', 'grade']) assert.equal(sortPieces([{ id: '1' }, { id: '2', title: 'B' }], [], mode).length, 2);
});

test('the sort options the screen offers are the ones the function understands', () => {
  assert.deepEqual(PIECE_SORTS.map(s => s.key), ['title', 'recent', 'grade']);
});
