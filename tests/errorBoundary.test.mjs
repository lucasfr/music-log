// Tests for the error boundary's helpers (src/utils/errorBoundary.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/utils/errorBoundary.js'), 'utf8');
const { describeError, resetKeysChanged } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

test('an Error becomes its message on one line', () => {
  assert.equal(describeError(new Error('Cannot read properties of undefined\n  (reading \'map\')')), "Cannot read properties of undefined (reading 'map')");
});

test('things that are not Errors still read sensibly', () => {
  assert.equal(describeError('boom'), 'boom');
  assert.equal(describeError({ code: 7 }), '{"code":7}');
  assert.equal(describeError(null), 'Unknown error');
  assert.equal(describeError(undefined), 'Unknown error');
  assert.equal(describeError(new Error('   ')), 'Unknown error');
});

test('a long message is cut, and the cut one is no longer than the limit', () => {
  const out = describeError(new Error('x'.repeat(500)), 40);
  assert.equal(out.length, 40);
  assert.ok(out.endsWith('…'));
});

test('a value that cannot be turned into JSON does not throw', () => {
  const loop = {}; loop.self = loop;
  assert.doesNotThrow(() => describeError(loop));
});

test('the boundary resets only when a reset key changes', () => {
  assert.equal(resetKeysChanged(['light'], ['light']), false);
  assert.equal(resetKeysChanged(['light'], ['dark']), true);
  assert.equal(resetKeysChanged([], []), false);
  assert.equal(resetKeysChanged(['a'], ['a', 'b']), true);
  assert.equal(resetKeysChanged(undefined, undefined), false);
  assert.equal(resetKeysChanged([NaN], [NaN]), false, 'NaN is the same as NaN here');
});
