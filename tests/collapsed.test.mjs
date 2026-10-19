// Tests for remembering which sections are folded (src/utils/collapsed.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/collapsed.js'), 'utf8');
const { parseCollapsed, serializeCollapsed, toggleCollapsed } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('a saved list comes back as it was saved', () => {
  assert.deepEqual(parseCollapsed(serializeCollapsed(['library', 'growth'])), ['library', 'growth']);
  assert.deepEqual(parseCollapsed(serializeCollapsed([])), []);
});

test('nothing saved, or something unreadable, means nothing is folded', () => {
  for (const raw of [undefined, null, '', '[]', 'not json', '{"a":1}', '42', 'null']) {
    assert.deepEqual(parseCollapsed(raw), [], String(raw));
  }
});

test('non-text entries in a saved list are ignored', () => {
  assert.deepEqual(parseCollapsed('["library", 3, null, "growth", {"x":1}]'), ['library', 'growth']);
});

test('toggling folds an open section and opens a folded one', () => {
  assert.deepEqual(toggleCollapsed([], 'library'), ['library']);
  assert.deepEqual(toggleCollapsed(['library'], 'library'), []);
  assert.deepEqual(toggleCollapsed(['library', 'growth'], 'library'), ['growth']);
  assert.deepEqual(toggleCollapsed(['growth'], 'library'), ['growth', 'library']);
});

test('toggling returns a new list and leaves the old one alone', () => {
  const before = ['library'];
  const after = toggleCollapsed(before, 'growth');
  assert.notEqual(after, before);
  assert.deepEqual(before, ['library']);
});

test('toggling twice is a no-op', () => {
  const start = ['a', 'b'];
  assert.deepEqual(toggleCollapsed(toggleCollapsed(start, 'c'), 'c'), start);
});
