import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllPayload, parseImportJSON, planImport } from '../src/utils/backup.js';

// The fields added to pieces for "From memory" and "Tricky spots" must survive an export and a restore
// (a field that is listed by hand anywhere in the backup would be dropped without a word).
const piece = {
  id: 'p1', title: 'Sonatina', composer: 'Clementi', status: 'learning', keys: ['C'], timeSigs: ['4/4'],
  memorised: true, memorisedAt: '2026-10-10', lastFromMemory: '2026-10-28',
  spots: [{ id: 'spot-1', bars: '9-12', status: 'open', added: '2026-10-01' }],
  updated_at: '2026-10-28T10:00:00.000Z', created_at: '2026-10-01T10:00:00.000Z',
};

test('memorised fields and spots are in the export, under extra', () => {
  const payload = buildAllPayload([], [], [piece], new Date('2026-11-01T12:00:00Z'));
  const out = payload.compositions[0];
  assert.deepEqual(out.extra.memorised, true);
  assert.equal(out.extra.memorisedAt, '2026-10-10');
  assert.equal(out.extra.lastFromMemory, '2026-10-28');
  assert.equal(out.extra.spots.length, 1);
});

test('a restore on an empty device brings every one of them back', () => {
  const payload = buildAllPayload([], [], [piece]);
  const parsed = parseImportJSON(JSON.stringify(payload));
  const plan = planImport(parsed, {});
  assert.equal(plan.compositions.length, 1);
  const back = plan.compositions[0];
  assert.equal(back.id, 'p1');
  assert.equal(back.memorised, true);
  assert.equal(back.memorisedAt, '2026-10-10');
  assert.equal(back.lastFromMemory, '2026-10-28');
  assert.deepEqual(back.spots, piece.spots);
});

test('importing the same backup twice changes nothing', () => {
  const payload = JSON.stringify(buildAllPayload([], [], [piece]));
  const first = planImport(parseImportJSON(payload), {});
  const second = planImport(parseImportJSON(payload), { compositions: first.compositions });
  assert.equal(second.compositions.length, 0);
  assert.equal(second.stats.compositions.skipped, 1);
});

test('a newer copy in a backup updates the memorised date on the device', () => {
  const older = { ...piece, lastFromMemory: '2026-10-01', updated_at: '2026-10-01T10:00:00.000Z' };
  const payload = JSON.stringify(buildAllPayload([], [], [piece]));
  const plan = planImport(parseImportJSON(payload), { compositions: [older] });
  assert.equal(plan.compositions.length, 1);
  assert.equal(plan.compositions[0].lastFromMemory, '2026-10-28');
});

test('a piece with no memory fields exports and restores without gaining any', () => {
  const plain = { id: 'p2', title: 'Prelude', updated_at: '2026-10-01T10:00:00.000Z' };
  const back = planImport(parseImportJSON(JSON.stringify(buildAllPayload([], [], [plain]))), {}).compositions[0];
  assert.equal('memorised' in back, false);
  assert.equal('lastFromMemory' in back, false);
});
