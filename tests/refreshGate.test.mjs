// Tests for the refresh gate (src/utils/refreshGate.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/refreshGate.js'), 'utf8');
const { createRefreshGate } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('the first refresh starts straight away', () => {
  const c = clock();
  assert.equal(createRefreshGate({ now: c.now }).tryStart(), true);
});

test('a refresh does not start while another is still running, even when forced', () => {
  const c = clock();
  const gate = createRefreshGate({ now: c.now });
  assert.equal(gate.tryStart(), true);
  c.advance(120000);
  assert.equal(gate.tryStart(), false);
  assert.equal(gate.tryStart(true), false, 'forcing does not run two at once');
  assert.equal(gate.running, true);
  gate.finish();
  assert.equal(gate.running, false);
});

test('a burst of events starts one refresh: nothing within the minimum gap, then it is allowed again', () => {
  const c = clock();
  const gate = createRefreshGate({ minGapMs: 30000, now: c.now });
  assert.equal(gate.tryStart(), true);
  gate.finish();
  c.advance(5000);
  assert.equal(gate.tryStart(), false, 'the app came back to the foreground again almost at once');
  c.advance(24999);
  assert.equal(gate.tryStart(), false, '29.999 seconds is still too soon');
  c.advance(1);
  assert.equal(gate.tryStart(), true, 'exactly the gap is enough');
});

test('forcing skips the gap, so a network that has just come back is not made to wait', () => {
  const c = clock();
  const gate = createRefreshGate({ minGapMs: 30000, now: c.now });
  gate.tryStart(); gate.finish();
  c.advance(2000);
  assert.equal(gate.tryStart(true), true);
});

test('a refresh that finishes lets the next one start once the gap has passed; the gap counts from the start', () => {
  const c = clock();
  const gate = createRefreshGate({ minGapMs: 30000, now: c.now });
  gate.tryStart();
  c.advance(40000);          // a slow refresh
  gate.finish();
  assert.equal(gate.tryStart(), true, 'it started 40 seconds ago, so another is allowed straight away');
});

test('a refresh that fails still frees the gate, so a later one can run', () => {
  const c = clock();
  const gate = createRefreshGate({ minGapMs: 1000, now: c.now });
  gate.tryStart();
  gate.finish();             // called from a finally block whether the refresh worked or not
  c.advance(1000);
  assert.equal(gate.tryStart(), true);
});

test('the defaults are a 30 second gap and the real clock', () => {
  const gate = createRefreshGate();
  assert.equal(gate.tryStart(), true);
  gate.finish();
  assert.equal(gate.tryStart(), false);
});
