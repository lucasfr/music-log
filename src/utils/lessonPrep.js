// Preparing for the next lesson: the date of it, a countdown, and a running list of questions for your teacher that
// you add to whenever something comes up and clear after the lesson. The date and the list are kept in
// preferences; the lesson summary (utils/insights.js lessonBrief) carries the list. Pure (no React Native
// imports), so it's unit-tested in plain Node, see tests/lessonPrep.test.mjs. Dates are local 'YYYY-MM-DD'
// strings, counted by calendar date.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = s => typeof s === 'string' && ISO.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());
const dayNumber = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const MAX_QUESTIONS = 30;
const MAX_TEXT = 200;

// The stored date, or '' when there is none or it is not a date.
export const parseNextLesson = raw => (validDate(String(raw || '')) ? String(raw) : '');

// The day before a date, as 'YYYY-MM-DD' (the evening a reminder goes out), or '' for a bad date.
export function dayBefore(date) {
  if (!validDate(date)) return '';
  const t = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
  t.setUTCDate(t.getUTCDate() - 1);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// -> null with no usable date; otherwise { days, passed, line }. `days` is whole calendar days from today.
export function lessonCountdown(date, today) {
  if (!validDate(date) || !validDate(today)) return null;
  const days = Math.round(dayNumber(date) - dayNumber(today));
  let line;
  if (days < 0) line = 'The date of your lesson has passed.';
  else if (days === 0) line = 'Your lesson is today.';
  else if (days === 1) line = 'Your lesson is tomorrow.';
  else line = `Your lesson is in ${days} days.`;
  return { days, passed: days < 0, line };
}

// ── Questions for the teacher ──

// Stored JSON to a clean list: { id, text, added }. Blank text is dropped.
export function parseQuestions(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach(x => {
      if (!x || typeof x !== 'object') return;
      const text = String(x.text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      out.push({ id: String(x.id || key), text, added: validDate(x.added) ? x.added : '' });
    });
    return out.slice(0, MAX_QUESTIONS);
  } catch {
    return [];
  }
}

export const serializeQuestions = list => JSON.stringify(parseQuestions(JSON.stringify(list || [])));

// The list with one more question (nothing is added for blank text, a repeat, or a full list).
export function addQuestion(list, text, today, makeId = () => `q-${Math.random().toString(36).slice(2, 9)}`) {
  const current = parseQuestions(JSON.stringify(list || []));
  const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
  if (!clean || current.length >= MAX_QUESTIONS || current.some(q => q.text.toLowerCase() === clean.toLowerCase())) return current;
  return [...current, { id: makeId(), text: clean, added: validDate(today) ? today : '' }];
}

export const removeQuestion = (list, id) => parseQuestions(JSON.stringify(list || [])).filter(q => q.id !== id);

// For the lesson summary: "Questions for your teacher:\n1. ...", or '' with none.
export function questionsText(list) {
  const qs = parseQuestions(JSON.stringify(list || []));
  if (!qs.length) return '';
  return ['Questions for your teacher:', ...qs.map((q, i) => `${i + 1}. ${q.text}`)].join('\n');
}
