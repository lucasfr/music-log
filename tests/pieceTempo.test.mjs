// Tests for the metronome's piece defaults (src/utils/pieceTempo.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/pieceTempo.js'), 'utf8');
const { pieceMetronomeDefaults } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('a piece with a tempo and time signature gives both to the metronome', () => {
  assert.deepEqual(pieceMetronomeDefaults({ tempo: 72, timeSigs: ['3/4'] }), { bpm: 72, sig: '3/4', hasTempo: true, hasSig: true });
});

test('a piece with neither falls back to 90 bpm and 4/4, and says it did', () => {
  for (const c of [null, undefined, {}, { tempo: null, timeSigs: [] }, { tempo: '', time_sigs: null }]) {
    assert.deepEqual(pieceMetronomeDefaults(c), { bpm: 90, sig: '4/4', hasTempo: false, hasSig: false });
  }
});

test('the first time signature is used, and tempo may be text', () => {
  const d = pieceMetronomeDefaults({ tempo: '104', timeSigs: ['6/8', '3/4'] });
  assert.equal(d.bpm, 104);
  assert.equal(d.sig, '6/8');
});

test('a piece stored as it came from Supabase (time_sigs) still works', () => {
  assert.equal(pieceMetronomeDefaults({ time_sigs: ['3/4'] }).sig, '3/4');
  assert.equal(pieceMetronomeDefaults({ time_sigs: '["2/4","3/4"]' }).sig, '2/4');
  assert.equal(pieceMetronomeDefaults({ time_sigs: '3/4' }).sig, '3/4');
});

test('an older piece with only the single time signature still works', () => {
  assert.equal(pieceMetronomeDefaults({ timeSig: '5/4' }).sig, '5/4');
  assert.equal(pieceMetronomeDefaults({ time_sig: '7/8' }).hasSig, true);
});

test('timeSigs wins over the older fields, and junk entries are skipped', () => {
  assert.equal(pieceMetronomeDefaults({ timeSigs: ['3/4'], timeSig: '4/4', time_sigs: ['2/4'] }).sig, '3/4');
  assert.equal(pieceMetronomeDefaults({ timeSigs: ['', 'waltz', '3/4'] }).sig, '3/4');
  assert.equal(pieceMetronomeDefaults({ timeSigs: ['waltz'] }).hasSig, false);
});

test('tempo is kept inside the metronome range of 30 to 240', () => {
  assert.equal(pieceMetronomeDefaults({ tempo: 400 }).bpm, 240);
  assert.equal(pieceMetronomeDefaults({ tempo: 5 }).bpm, 30);
  assert.equal(pieceMetronomeDefaults({ tempo: -3 }).hasTempo, false);
  assert.equal(pieceMetronomeDefaults({ tempo: 'fast' }).hasTempo, false);
});

test('the fallback can be changed', () => {
  assert.deepEqual(pieceMetronomeDefaults({}, { bpm: 60, sig: '3/4' }), { bpm: 60, sig: '3/4', hasTempo: false, hasSig: false });
});
