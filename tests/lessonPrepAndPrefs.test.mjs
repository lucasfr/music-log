import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNextLesson, dayBefore, lessonCountdown, parseQuestions, serializeQuestions, addQuestion, removeQuestion, questionsText,
} from '../src/utils/lessonPrep.js';
import { collectPrefs, planPrefsRestore, describePrefsRestore, BACKUP_PREF_KEYS } from '../src/utils/prefsBackup.js';

let n = 0;
const id = () => `q${n++}`;

test('the stored lesson date: valid dates only', () => {
  assert.equal(parseNextLesson('2026-11-10'), '2026-11-10');
  for (const bad of ['', null, undefined, 'soon', '2026-13-45', '10/11/2026']) assert.equal(parseNextLesson(bad), '', String(bad));
});

test('dayBefore crosses month, year and leap-day boundaries by calendar', () => {
  assert.equal(dayBefore('2026-11-10'), '2026-11-09');
  assert.equal(dayBefore('2026-11-01'), '2026-10-31');
  assert.equal(dayBefore('2027-01-01'), '2026-12-31');
  assert.equal(dayBefore('2028-03-01'), '2028-02-29');
  assert.equal(dayBefore('2026-10-26'), '2026-10-25');          // the day the UK clocks go back
  assert.equal(dayBefore('nope'), '');
});

test('the countdown: today, tomorrow, days, and passed', () => {
  assert.equal(lessonCountdown('2026-11-01', '2026-11-01').line, 'Your lesson is today.');
  assert.equal(lessonCountdown('2026-11-02', '2026-11-01').line, 'Your lesson is tomorrow.');
  assert.deepEqual(lessonCountdown('2026-11-10', '2026-11-01'), { days: 9, passed: false, line: 'Your lesson is in 9 days.' });
  const gone = lessonCountdown('2026-10-30', '2026-11-01');
  assert.equal(gone.passed, true);
  assert.equal(gone.days, -2);
  assert.equal(lessonCountdown('', '2026-11-01'), null);
  assert.equal(lessonCountdown('2026-11-10', 'garbage'), null);
});

test('the countdown counts calendar days across the clocks changing', () => {
  assert.equal(lessonCountdown('2026-10-27', '2026-10-24').days, 3);   // spans the 25-hour day
  assert.equal(lessonCountdown('2026-03-30', '2026-03-27').days, 3);   // and the 23-hour day
});

test('questions: added, cleaned, de-duplicated, capped and removed', () => {
  let list = addQuestion([], '  Why does bar 12   feel awkward? ', '2026-11-01', id);
  assert.deepEqual(list.map(q => q.text), ['Why does bar 12 feel awkward?']);
  assert.equal(list[0].added, '2026-11-01');
  assert.equal(addQuestion(list, '', '2026-11-01', id).length, 1);
  assert.equal(addQuestion(list, '   ', '2026-11-01', id).length, 1);
  assert.equal(addQuestion(list, 'why does BAR 12 feel awkward?', '2026-11-01', id).length, 1);
  assert.equal(addQuestion(list, 'x'.repeat(500), '2026-11-01', id)[1].text.length, 200);
  list = addQuestion(list, 'Pedalling in the coda?', '2026-11-02', id);
  assert.equal(removeQuestion(list, list[0].id).length, 1);
  let many = [];
  for (let i = 0; i < 40; i++) many = addQuestion(many, `Question ${i}`, '2026-11-01', id);
  assert.equal(many.length, 30);
});

test('questions survive a round trip and junk is dropped', () => {
  const list = addQuestion(addQuestion([], 'One?', '2026-11-01', id), 'Two?', '2026-11-02', id);
  assert.deepEqual(parseQuestions(serializeQuestions(list)), list);
  assert.deepEqual(parseQuestions('nope'), []);
  assert.deepEqual(parseQuestions('{"a":1}'), []);
  assert.deepEqual(parseQuestions(JSON.stringify([null, 4, { text: '' }, { text: 'Ok?', added: 'yesterday' }])), [{ id: 'ok?', text: 'Ok?', added: '' }]);
});

test('the text for the lesson summary', () => {
  assert.equal(questionsText([]), '');
  assert.equal(questionsText(undefined), '');
  const list = addQuestion(addQuestion([], 'One?', '2026-11-01', id), 'Two?', '2026-11-02', id);
  assert.equal(questionsText(list), 'Questions for your teacher:\n1. One?\n2. Two?');
});

// ── backing up preferences ──

const store = obj => (key, fallback = null) => (key in obj ? obj[key] : fallback);

test('collectPrefs takes only listed keys that are set, and not the defaults', () => {
  const got = collectPrefs(store({ restDays: '[0]', weeklyGoalMin: '0', monthGoalHours: '10', yearGoalHours: '', gradeTarget: '{"grade":"Grade 5"}', mockExamHistory: '[]', theme: 'dark', secretToken: 'abc' }));
  assert.deepEqual(got, { restDays: '[0]', monthGoalHours: '10', gradeTarget: '{"grade":"Grade 5"}' });
});

test('every listed key is collected when set', () => {
  const all = Object.fromEntries(BACKUP_PREF_KEYS.map(k => [k, 'x']));
  assert.deepEqual(Object.keys(collectPrefs(store(all))).sort(), [...BACKUP_PREF_KEYS].sort());
});

test('oversized and non-text values are not carried', () => {
  assert.deepEqual(collectPrefs(store({ gradeTarget: 'x'.repeat(200001), restDays: 5, nextLesson: ['a'] })), {});
});

test('a restore fills only what this device has not set', () => {
  const file = { restDays: '[0]', monthGoalHours: '10', gradeTarget: '{"grade":"Grade 5"}', yearGoalHours: '100' };
  const plan = planPrefsRestore(file, store({ monthGoalHours: '20', yearGoalHours: '0', gradeTarget: '' }));
  assert.deepEqual(plan, [
    { key: 'restDays', value: '[0]' },
    { key: 'yearGoalHours', value: '100' },
    { key: 'gradeTarget', value: '{"grade":"Grade 5"}' },
  ]);                                                                  // monthGoalHours is kept: this device already has 20
});

test('a restore ignores keys that are not on the list, junk values, and a bad file', () => {
  assert.deepEqual(planPrefsRestore({ theme: 'dark', syncOutbox: '{}', restDays: 7, nextLesson: '' }, store({})), []);
  for (const bad of [null, undefined, 'x', 5, ['restDays']]) assert.deepEqual(planPrefsRestore(bad, store({})), []);
});

test('a restore on a fresh device brings everything back, and what a backup carries round-trips', () => {
  const device = { restDays: '[0,6]', gradeTarget: '{"grade":"Grade 5"}', teacherQuestions: '[{"text":"Why?"}]' };
  const carried = collectPrefs(store(device));
  const plan = planPrefsRestore(carried, store({}));
  assert.deepEqual(Object.fromEntries(plan.map(p => [p.key, p.value])), device);
});

test('describePrefsRestore', () => {
  assert.equal(describePrefsRestore([]), '');
  assert.equal(describePrefsRestore(undefined), '');
  assert.equal(describePrefsRestore([{ key: 'a', value: 'b' }]), '1 setting restored');
  assert.equal(describePrefsRestore([{}, {}, {}]), '3 settings restored');
});
