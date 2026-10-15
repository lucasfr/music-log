// Tests for the remote record helpers (src/db/records.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/db/records.js'), 'utf8');
const { fromRemoteComposition } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

// What the sync merge does when the remote row wins (see mergeRows in src/db/sync.js).
const mergeRemoteWins = (local, remote) => ({ ...local, ...fromRemoteComposition(remote) });

test('time_sigs becomes timeSigs, so the metronome can read a piece that came from another device', () => {
  const c = fromRemoteComposition({ id: 'a', title: 'Minuet', time_sigs: ['3/4'], tempo: 92 });
  assert.deepEqual(c.timeSigs, ['3/4']);
  assert.equal('time_sigs' in c, false);
  assert.equal(c.tempo, 92);
});

test('a piece pulled from Supabase gives the metronome both its tempo and its time signature', () => {
  // the same reads MetronomeControl does
  const c = fromRemoteComposition({ id: 'a', time_sigs: ['6/8'], tempo: '72' });
  assert.equal(Number(c?.tempo) || 90, 72);
  assert.equal((c?.timeSigs && c.timeSigs[0]) || '4/4', '6/8');
});

test('time_sigs may arrive as a JSON string or not at all', () => {
  assert.deepEqual(fromRemoteComposition({ time_sigs: '["2/4","3/4"]' }).timeSigs, ['2/4', '3/4']);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: null }), false);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: [] }), false);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: 'not json' }), false);
  assert.equal('timeSigs' in fromRemoteComposition({}), false);
});

test('tempo is a whole number, and a missing, zero or junk tempo is left out rather than set to null', () => {
  assert.equal(fromRemoteComposition({ tempo: '92' }).tempo, 92);
  assert.equal(fromRemoteComposition({ tempo: 91.6 }).tempo, 92);
  for (const bad of [null, undefined, '', 0, -5, 'fast', NaN]) {
    assert.equal('tempo' in fromRemoteComposition({ tempo: bad }), false, `tempo ${String(bad)} is dropped`);
  }
});

test('an empty remote tempo or time signature does not wipe what this device already has', () => {
  const local = { id: 'a', title: 'Minuet', tempo: 100, timeSigs: ['3/4'] };
  const merged = mergeRemoteWins(local, { id: 'a', title: 'Minuet', tempo: null, time_sigs: null, updated_at: '2026-10-14T10:00:00Z' });
  assert.equal(merged.tempo, 100);
  assert.deepEqual(merged.timeSigs, ['3/4']);
});

test('a real remote tempo and time signature do replace the local ones', () => {
  const local = { id: 'a', tempo: 100, timeSigs: ['3/4'] };
  const merged = mergeRemoteWins(local, { id: 'a', tempo: 80, time_sigs: ['4/4'] });
  assert.equal(merged.tempo, 80);
  assert.deepEqual(merged.timeSigs, ['4/4']);
});

test('created_at is mirrored to createdAt without overwriting one that is already there', () => {
  assert.equal(fromRemoteComposition({ created_at: '2026-01-01T00:00:00Z' }).createdAt, '2026-01-01T00:00:00Z');
  assert.equal(fromRemoteComposition({ created_at: 'x', createdAt: 'y' }).createdAt, 'y');
});

test('other fields are left alone, the input is not mutated, and bad input is returned as is', () => {
  const row = { id: 'a', title: 'T', composer: 'C', keys: [{ root: 'C', mode: 'major' }], updated_at: 'u', time_sigs: ['4/4'] };
  const copy = JSON.parse(JSON.stringify(row));
  const out = fromRemoteComposition(row);
  assert.deepEqual(row, copy, 'input untouched');
  assert.equal(out.title, 'T');
  assert.deepEqual(out.keys, [{ root: 'C', mode: 'major' }]);
  assert.equal(out.updated_at, 'u');
  assert.equal(fromRemoteComposition(null), null);
  assert.equal(fromRemoteComposition(undefined), undefined);
});
