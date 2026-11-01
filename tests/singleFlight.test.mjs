// Tests for running a task one at a time (src/utils/singleFlight.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/utils/singleFlight.js'), 'utf8');
const { singleFlight } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('a single call runs the task once', async () => {
  let runs = 0;
  const run = singleFlight(async () => { runs++; await sleep(5); });
  await run();
  assert.equal(runs, 1);
});

test('calls made while it runs never overlap it: one extra round, however many were asked for', async () => {
  let runs = 0, active = 0, maxActive = 0;
  const run = singleFlight(async () => {
    runs++; active++; maxActive = Math.max(maxActive, active);
    await sleep(15);
    active--;
  });
  await Promise.all([run(), run(), run(), run(), run()]);
  assert.equal(runs, 2, 'the first run plus one more');
  assert.equal(maxActive, 1, 'never two at once');
});

test('every caller waits for the extra round too', async () => {
  const finished = [];
  const run = singleFlight(async () => { await sleep(10); finished.push('round'); });
  const first = run();
  const second = run();
  await second;
  assert.equal(finished.length, 2, 'the second caller is released only after the round it asked for');
  await first;
});

test('the task is told when another run has been asked for, so it can skip a result the next round replaces', async () => {
  const shown = [];
  let round = 0;
  const run = singleFlight(async isStale => {
    const mine = ++round;
    await sleep(10);
    if (!isStale()) shown.push(mine);
  });
  const p = run();
  await sleep(2);
  run();                     // asked for while round 1 is still running
  await p;
  assert.deepEqual(shown, [2], 'round 1 saw it was out of date and showed nothing; round 2 showed');
});

test('after it has finished, a new call starts fresh', async () => {
  let runs = 0;
  const run = singleFlight(async isStale => { runs++; assert.equal(isStale(), false); });
  await run();
  await run();
  assert.equal(runs, 2);
});

test('a failing task rejects its callers and does not block later runs', async () => {
  let fail = true, runs = 0;
  const run = singleFlight(async () => { runs++; await sleep(2); if (fail) throw new Error('offline'); });
  await assert.rejects(run(), /offline/);
  fail = false;
  await run();
  assert.equal(runs, 2);
});

test('a task that throws before its first await does not block later runs either', async () => {
  let fail = true, runs = 0;
  const run = singleFlight(() => { runs++; if (fail) throw new Error('at once'); return Promise.resolve(); });
  await assert.rejects(run(), /at once/);
  fail = false;
  await run();
  assert.equal(runs, 2);
});
