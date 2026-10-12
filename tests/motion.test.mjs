// Tests for the motion helpers (src/utils/motion.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/motion.js'), 'utf8');
const { DURATION, STAGGER_STEP, STAGGER_MAX, delayFor, clampFraction } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('delayFor staggers neighbours by the step, starting at the base', () => {
  assert.equal(delayFor(0), 0);
  assert.equal(delayFor(1), STAGGER_STEP);
  assert.equal(delayFor(3), 3 * STAGGER_STEP);
  assert.equal(delayFor(2, 100), 100 + 2 * STAGGER_STEP, 'a base delay shifts the whole group');
});

test('delayFor is capped, so a long list never makes anyone wait', () => {
  assert.equal(delayFor(1000), STAGGER_MAX);
  assert.equal(delayFor(50, 100), STAGGER_MAX);
  assert.equal(delayFor(5, 0, 100, 250), 250, 'custom step and cap');
  for (let i = 0; i < 200; i++) assert.ok(delayFor(i) <= STAGGER_MAX);
});

test('delayFor treats missing, negative and non-numeric indexes as the first item', () => {
  for (const bad of [undefined, null, -3, NaN, 'x']) assert.equal(delayFor(bad), 0, `${bad}`);
});

test('the whole stagger never takes longer than the cap plus one entrance', () => {
  assert.ok(STAGGER_MAX + DURATION.enter < 1000, 'the last card is in place in under a second');
  assert.ok(DURATION.enter > 0 && DURATION.fill > 0);
});

test('clampFraction keeps a bar inside its track, whatever it is given', () => {
  assert.equal(clampFraction(0.4), 0.4);
  assert.equal(clampFraction(0), 0);
  assert.equal(clampFraction(1), 1);
  assert.equal(clampFraction(1.7), 1);
  assert.equal(clampFraction(-0.2), 0);
  for (const bad of [NaN, undefined, null, 'abc', Infinity]) assert.equal(clampFraction(bad), 0, `${bad}`);
  assert.equal(clampFraction('0.5'), 0.5, 'numeric strings are fine');
});
