import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// src/utils/insights.js is loaded by several tests (insights, todayPlan, cleanTempo, timerLog) from its source text,
// as a data: URL, and a data: URL cannot resolve a relative import. So the file must have no imports: anything
// it needs from another module is passed in by the caller (see the `opts` of buildTodayPlan). Adding an import
// to it fails four other test files at load, with no message about why, so this test says it plainly.

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/insights.js'), 'utf8');

test('insights.js has no import or require statements (see the comment at the top of that file)', () => {
  const found = source.split('\n').map((line, i) => ({ line, n: i + 1 })).filter(x => /^\s*(import\s|import\(|.*\brequire\()/.test(x.line));
  assert.deepEqual(found.map(x => `line ${x.n}: ${x.line.trim()}`), [], 'insights.js must stay self-contained: pass what it needs in through the options of buildTodayPlan instead');
});

test('insights.js loads from a data: URL, the way the other tests load it', async () => {
  const mod = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(typeof mod.buildTodayPlan, 'function');
  assert.equal(typeof mod.setSpotTempo, 'function');
  assert.equal(typeof mod.addSpotReps, 'function');
});
