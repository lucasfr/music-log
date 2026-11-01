import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllPayload, parseImportJSON, planImport } from '../src/utils/backup.js';
import { collectPrefs, planPrefsRestore } from '../src/utils/prefsBackup.js';

const store = obj => (key, fallback = null) => (key in obj ? obj[key] : fallback);
const NOW = new Date('2026-11-01T12:00:00Z');

test('the backup carries preferences under prefs, and nothing extra when there are none', () => {
  assert.deepEqual(buildAllPayload([], [], [], NOW, { restDays: '[0]' }).prefs, { restDays: '[0]' });
  assert.equal('prefs' in buildAllPayload([], [], [], NOW), false);
  assert.equal('prefs' in buildAllPayload([], [], [], NOW, {}), false);
  assert.equal('prefs' in buildAllPayload([], [], [], NOW, null), false);
});

test('reading a file brings its preferences back, and a file without any gives none', () => {
  const withPrefs = parseImportJSON(JSON.stringify(buildAllPayload([], [], [], NOW, { gradeTarget: '{"grade":"Grade 5"}' })));
  assert.deepEqual(withPrefs.prefs, { gradeTarget: '{"grade":"Grade 5"}' });
  const without = parseImportJSON(JSON.stringify(buildAllPayload([], [], [], NOW)));
  assert.equal('prefs' in without, false);
  assert.equal('prefs' in parseImportJSON(JSON.stringify({ sessions: [], prefs: 'nonsense' })), false);
  assert.equal('prefs' in parseImportJSON(JSON.stringify({ sessions: [], prefs: [1] })), false);
});

test('importing records still ignores preferences, and an older file with no prefs still imports', () => {
  const parsed = parseImportJSON(JSON.stringify({ version: 1, sessions: [{ date: '2026-10-01', duration_minutes: 20, segments: [] }] }));
  assert.equal(planImport(parsed, {}).sessions.length, 1);
});

test('a full round trip: export from one device, restore on a fresh one, nothing overwritten on another', () => {
  const deviceA = { restDays: '[0,6]', yearGoalHours: '100', mockExamHistory: '[{"date":"2026-10-20","total":600,"count":6,"flagged":[]}]', theme: 'dark' };
  const file = JSON.parse(JSON.stringify(buildAllPayload([], [], [], NOW, collectPrefs(store(deviceA)))));
  assert.equal('theme' in file.prefs, false);

  const fresh = planPrefsRestore(parseImportJSON(JSON.stringify(file)).prefs, store({}));
  assert.deepEqual(Object.fromEntries(fresh.map(p => [p.key, p.value])), { restDays: '[0,6]', yearGoalHours: '100', mockExamHistory: deviceA.mockExamHistory });

  const deviceB = planPrefsRestore(parseImportJSON(JSON.stringify(file)).prefs, store({ yearGoalHours: '150' }));
  assert.deepEqual(deviceB.map(p => p.key).sort(), ['mockExamHistory', 'restDays']);       // the year goal already set here is kept
});
