// Backing up preferences with the JSON backup. The backup has always carried sessions, lessons and pieces; the
// settings that make the app yours (rest days, goals, grade target, mock exam history, scale tempos, sight-reading
// attempts, saved routines, next lesson and its questions) lived only on the device, so restoring on a new one
// lost them. These pick which preferences go in the file and which of a file's preferences may be restored.
// Pure (the preference reader is passed in), so it's unit-tested in plain Node, see tests/prefsBackup.test.mjs.
//
// Restoring never overwrites: a preference is only filled in when this device has nothing (or the default) for
// it, so an older backup cannot undo what you have set since.

export const BACKUP_PREF_KEYS = [
  'restDays', 'weeklyGoalMin', 'monthGoalHours', 'yearGoalHours', 'gradeTarget', 'mockExamHistory',
  'scaleTempos', 'sightAttempts', 'timerRoutines', 'nextLesson', 'teacherQuestions',
];
const MAX_VALUE = 200000;   // characters; a stored preference larger than this is not carried

// A stored value that means "nothing set yet" for any of the keys.
const isUnset = v => v === null || v === undefined || v === '' || v === '[]' || v === '{}' || v === '0';

// -> { [key]: string } for the preferences that are set, to put in the backup under `prefs`.
export function collectPrefs(getPref) {
  const out = {};
  for (const key of BACKUP_PREF_KEYS) {
    const v = getPref(key, null);
    if (typeof v === 'string' && !isUnset(v) && v.length <= MAX_VALUE) out[key] = v;
  }
  return out;
}

// What a restore should set: [{ key, value }] for the file's preferences that are on the list, are text, are not
// oversized, and that this device has not set. Anything else in the file is ignored.
export function planPrefsRestore(filePrefs, getPref) {
  if (!filePrefs || typeof filePrefs !== 'object' || Array.isArray(filePrefs)) return [];
  const out = [];
  for (const key of BACKUP_PREF_KEYS) {
    const value = filePrefs[key];
    if (typeof value !== 'string' || isUnset(value) || value.length > MAX_VALUE) continue;
    if (isUnset(getPref(key, null))) out.push({ key, value });
  }
  return out;
}

// One line for the import result: "3 settings restored", or '' when none were.
export function describePrefsRestore(plan) {
  const n = (plan || []).length;
  return n ? `${n} ${n === 1 ? 'setting' : 'settings'} restored` : '';
}
