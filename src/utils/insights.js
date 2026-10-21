// Practice insights computed from the log. Pure (no React Native imports), so they're unit-tested in
// plain Node, see tests/insights.test.mjs.
//
// Dates are local 'YYYY-MM-DD' strings throughout, compared by calendar date (never through
// toISOString(), which is UTC).

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Whole days from date a to date b, by calendar date (immune to daylight saving).
function daysBetween(a, b) {
  const n = s => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86400000;
  return Math.round(n(b) - n(a));
}

// ── Tempo progression ────────────────────────────────────────────────────────────────────────
//
// The BPM logged on a segment is the clean tempo you reached, entered by hand. This follows it over
// time for each exercise or piece: where it started, where it is, the best, and (for a library
// piece with a reference tempo) how close it is to the target.
//
// What counts as "the same thing":
//   - a repertoire segment: the library piece, else its title;
//   - a technique segment: its group and label together ("Hanon · Hanon 1-3"), so two different
//     Hanon exercises are two series. A technique segment with no label is just its group.
// Two entries on one day count as one point, the faster of the two.

const seriesKey = seg => {
  if (seg.type === 'repertoire') {
    if (seg.compositionId) return { key: `p:${seg.compositionId}`, name: null, compositionId: seg.compositionId, kind: 'piece' };
    const t = String(seg.title || '').trim();
    return t ? { key: `p:t:${t.toLowerCase()}`, name: t, compositionId: null, kind: 'piece' } : null;
  }
  const group = String(seg.group || '').trim();
  const label = String(seg.title || '').trim();
  if (!group && !label) return null;
  return { key: `t:${group.toLowerCase()}|${label.toLowerCase()}`, name: [group, label].filter(Boolean).join(' · '), compositionId: seg.compositionId || null, kind: 'technique' };
};

// -> [{ key, kind, name, compositionId, points: [{ date, bpm }], first, latest, best, change,
//       target, fractionOfTarget, reachedTarget, lastDate }], most recently practised first.
// `change` is latest minus first (0 for a single point). `target` is the piece's reference tempo
// when it has one. Series with a single point are included: one number is still worth showing.
export function tempoProgress(sessions, compositions = []) {
  const byKey = new Map();
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    const bpm = num(seg.tempo);
    if (bpm <= 0 || !s.date) return;
    const k = seriesKey(seg);
    if (!k) return;
    if (!byKey.has(k.key)) byKey.set(k.key, { ...k, days: new Map() });
    const days = byKey.get(k.key).days;
    days.set(s.date, Math.max(days.get(s.date) || 0, bpm));
  }));

  const comp = id => (compositions || []).find(c => c.id === id);
  const out = [];
  for (const entry of byKey.values()) {
    const points = [...entry.days.entries()].map(([date, bpm]) => ({ date, bpm })).sort((a, b) => a.date.localeCompare(b.date));
    const c = entry.compositionId ? comp(entry.compositionId) : null;
    const name = (c && c.title) || entry.name || 'Untitled';
    const target = c && num(c.tempo) > 0 ? Math.round(num(c.tempo)) : null;
    const latest = points[points.length - 1].bpm;
    out.push({
      key: entry.key, kind: entry.kind, name, compositionId: entry.compositionId,
      points,
      first: points[0].bpm,
      latest,
      best: Math.max(...points.map(p => p.bpm)),
      change: latest - points[0].bpm,
      target,
      fractionOfTarget: target ? Math.min(1, latest / target) : null,
      reachedTarget: target ? latest >= target : false,
      lastDate: points[points.length - 1].date,
    });
  }
  return out.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
}

// One line: "72 → 88 bpm (+16)", "76 bpm", "88 bpm, 8 short of 96".
export function describeTempo(p) {
  const head = p.points.length > 1 && p.first !== p.latest ? `${p.first} → ${p.latest} bpm` : `${p.latest} bpm`;
  const delta = p.points.length > 1 && p.change !== 0 ? ` (${p.change > 0 ? '+' : '−'}${Math.abs(p.change)})` : '';
  if (p.target && !p.reachedTarget) return `${head}${delta}, ${p.target - p.latest} short of ${p.target}`;
  if (p.target && p.reachedTarget) return `${head}${delta}, at the ${p.target} target`;
  return `${head}${delta}`;
}

// ── Scale and arpeggio staleness ─────────────────────────────────────────────────────────────
//
// A scale or arpeggio you have practised before but not lately. "Neglected pieces" only looks at
// the library; scales have no library entry, so they quietly drop out of rotation. Scales and
// arpeggios are told apart (Bb major as a scale is not Bb major as an arpeggio).

const nameOf = e => (typeof e === 'string' ? e : (e && e.scale) || '');

// -> [{ kind: 'Scales' | 'Arpeggios', name, lastDate, daysSince, times }], most overdue first,
// only those last practised at least `minDays` ago. `today` is 'YYYY-MM-DD'.
export function staleScales(sessions, today, minDays = 14) {
  const seen = new Map();
  (sessions || []).forEach(s => {
    if (!s.date || s.date > today) return;
    (s.segments || []).forEach(seg => {
      if (seg.group !== 'Scales' && seg.group !== 'Arpeggios') return;
      (seg.scales || []).forEach(e => {
        const name = nameOf(e);
        if (!name) return;
        const key = `${seg.group}|${name}`;
        const prev = seen.get(key);
        if (!prev) seen.set(key, { kind: seg.group, name, lastDate: s.date, times: 1 });
        else { prev.times += 1; if (s.date > prev.lastDate) prev.lastDate = s.date; }
      });
    });
  });
  return [...seen.values()]
    .map(x => ({ ...x, daysSince: daysBetween(x.lastDate, today) }))
    .filter(x => x.daysSince >= minDays)
    .sort((a, b) => b.daysSince - a.daysSince || a.name.localeCompare(b.name));
}

// A short label: "9 days ago", "3 weeks ago", "2 months ago".
export function agoLabel(days) {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// ── Lesson assignments ───────────────────────────────────────────────────────────────────────
//
// A lesson segment can carry an `assignment` ("what to practise before next lesson"). This turns
// those into a checklist. An item is done when you tick it (`assignmentDone` on the lesson
// segment, so it syncs and is backed up with the lesson), or covered automatically once a later
// practice session has a segment for the same thing:
//   - a piece: the same library piece (or, for an unlinked piece, the same title);
//   - a technique segment that names scales or arpeggios: the same group with at least one of them;
//   - any other technique segment: the same group.

const norm = v => String(v ?? '').trim().toLowerCase();
const scaleNames = list => (list || []).map(e => norm(typeof e === 'string' ? e : e && e.scale)).filter(Boolean);

function coversAssignment(lessonSeg, seg) {
  if (lessonSeg.type === 'repertoire') {
    if (lessonSeg.compositionId) return seg.compositionId === lessonSeg.compositionId;
    const t = norm(lessonSeg.title);
    return !!t && seg.type === 'repertoire' && norm(seg.title) === t;
  }
  if (!lessonSeg.group || seg.group !== lessonSeg.group) return false;
  const wanted = scaleNames(lessonSeg.scales);
  if (!wanted.length) return true;
  const done = new Set(scaleNames(seg.scales));
  return wanted.some(n => done.has(n));
}

function assignmentLabel(seg, compositions) {
  if (seg.type === 'repertoire') {
    const c = (compositions || []).find(x => x.id === seg.compositionId);
    return (c && c.title) || seg.title || 'Piece';
  }
  return seg.group || seg.title || 'Technique';
}

// -> { items, open, lessonDate }. Items are the assignments from your latest lesson that has any
// (whatever their state, so you can see them ticked off), plus any still open from earlier lessons
// within `windowDays`. Each item: { lessonId, segmentId, segmentIndex, lessonDate, text, label,
// status: 'open' | 'covered' | 'done', doneOn, coveredOn, daysSince }.
export function lessonAssignments(lessons, sessions, today, compositions = [], windowDays = 28) {
  const all = [];
  (lessons || []).forEach(l => (l.segments || []).forEach((seg, segmentIndex) => {
    const text = String(seg.assignment || '').trim();
    if (!text || !l.date || l.date > today) return;
    let coveredOn = null;
    (sessions || []).forEach(s => {
      if (!(s.date > l.date && s.date <= today)) return;
      if (!(s.segments || []).some(g => coversAssignment(seg, g))) return;
      if (!coveredOn || s.date < coveredOn) coveredOn = s.date;
    });
    const doneOn = seg.assignmentDone ? (typeof seg.assignmentDone === 'string' ? seg.assignmentDone : l.date) : null;
    all.push({
      lessonId: l.id, segmentId: seg.id, segmentIndex, lessonDate: l.date, text,
      label: assignmentLabel(seg, compositions),
      status: doneOn ? 'done' : coveredOn ? 'covered' : 'open',
      doneOn, coveredOn,
      daysSince: daysBetween(l.date, today),
    });
  }));
  if (!all.length) return { items: [], open: 0, lessonDate: null };
  const lessonDate = all.reduce((d, x) => (x.lessonDate > d ? x.lessonDate : d), '');
  const items = all
    .filter(x => x.lessonDate === lessonDate || (x.status === 'open' && x.daysSince <= windowDays))
    .sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
  return { items, open: items.filter(x => x.status === 'open').length, lessonDate };
}

// The lesson with one assignment ticked (or un-ticked). The segment is found by id, or by its
// position for any segment saved without one. A new object; the lesson passed in is untouched.
export function setAssignmentDone(lesson, ref, done, today) {
  const segments = (lesson.segments || []).map((seg, i) => {
    const hit = ref.segmentId !== undefined && ref.segmentId !== null ? seg.id === ref.segmentId : i === ref.segmentIndex;
    if (!hit) return seg;
    if (done) return { ...seg, assignmentDone: today };
    const { assignmentDone: _removed, ...rest } = seg; // eslint-disable-line no-unused-vars
    return rest;
  });
  return { ...lesson, segments };
}

// ── Energy and what you usually do with it ───────────────────────────────────────────────────
//
// Energy (-2 to +2) is logged with each session. This describes what you have actually done at each
// level: how long you play, how the time splits between technique and pieces, and how you rate the
// session. It describes habit, not cause: a short session on a low-energy day may be what you
// wanted, or just what fitted.

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = a => a.reduce((t, v) => t + v, 0) / a.length;
const usable = s => s.energy !== null && s.energy !== undefined && s.energy !== '' && Number.isFinite(Number(s.energy)) && num(s.duration) > 0;

function shareOfTechnique(sessions) {
  let tech = 0;
  let total = 0;
  sessions.forEach(s => (s.segments || []).forEach(seg => {
    const d = num(seg.duration);
    if (d <= 0 || (seg.type !== 'technique' && seg.type !== 'repertoire')) return;
    total += d;
    if (seg.type === 'technique') tech += d;
  }));
  return total > 0 ? tech / total : null;
}

// What your sessions at one energy level usually look like. With fewer than `min` sessions at
// exactly that level it widens to the levels either side (`widened`); with still fewer, there is
// not enough to say. -> { enough: false, n } or { enough: true, energy, n, widened, minutes,
// techniqueShare, repertoireShare, avgEnjoyment }. `minutes` is the median, to the nearest 5.
export function suggestScope(sessions, energy, min = 3) {
  const all = (sessions || []).filter(usable);
  let set = all.filter(s => Number(s.energy) === energy);
  let widened = false;
  if (set.length < min) {
    set = all.filter(s => Math.abs(Number(s.energy) - energy) <= 1);
    widened = true;
  }
  if (set.length < min) return { enough: false, n: set.length };
  const enjoy = set.filter(s => num(s.enjoyment) > 0).map(s => num(s.enjoyment));
  const tech = shareOfTechnique(set);
  return {
    enough: true, energy, n: set.length, widened,
    minutes: Math.max(5, Math.round(median(set.map(s => num(s.duration))) / 5) * 5),
    techniqueShare: tech,
    repertoireShare: tech === null ? null : 1 - tech,
    avgEnjoyment: enjoy.length ? Math.round(mean(enjoy) * 10) / 10 : null,
  };
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

// How energy lines up with enjoyment and with session length across all sessions.
// -> { n, enjoyment: r | null, minutes: r | null }; null until there are `min` sessions to go on.
export function energyLinks(sessions, min = 10) {
  const all = (sessions || []).filter(usable);
  if (all.length < min) return { n: all.length, enjoyment: null, minutes: null };
  const e = all.map(s => Number(s.energy));
  const withEnjoy = all.filter(s => num(s.enjoyment) > 0);
  return {
    n: all.length,
    enjoyment: withEnjoy.length >= min ? pearson(withEnjoy.map(s => Number(s.energy)), withEnjoy.map(s => num(s.enjoyment))) : null,
    minutes: pearson(e, all.map(s => num(s.duration))),
  };
}

// "no clear link", "a weak link (higher energy goes with higher enjoyment)". `what` is 'enjoyment'
// or 'length' (of the session), so the sentence says what goes up or down with energy.
const LINK_WORDS = { enjoyment: ['higher enjoyment', 'lower enjoyment'], length: ['longer sessions', 'shorter sessions'] };
export function describeLink(r, what = 'enjoyment') {
  if (r === null || r === undefined) return null;
  const a = Math.abs(r);
  if (a < 0.2) return 'no clear link';
  const strength = a < 0.4 ? 'a weak' : a < 0.6 ? 'a moderate' : 'a strong';
  const [up, down] = LINK_WORDS[what] || LINK_WORDS.enjoyment;
  return `${strength} link (higher energy goes with ${r > 0 ? up : down})`;
}

// ── Grade target and readiness ───────────────────────────────────────────────────────────────
//
// A target you set yourself: a grade, a date, the scales and arpeggios it asks for, and how many
// pieces. The requirement lists are entered by you (from the syllabus you are following) rather
// than built into the app, so the app never ships anyone's copyrighted syllabus listing, and it
// works for any exam board or for a teacher's own list. Entries use the same shape as the scale
// picker in the log: { scale, motion, octaves, interval }.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function cleanEntry(e) {
  const scale = typeof e === 'string' ? e : e && e.scale;
  if (!scale || typeof scale !== 'string') return null;
  if (typeof e === 'string') return { scale, motion: 'parallel', octaves: 1, interval: 'unison' };
  return {
    scale,
    motion: e.motion === 'contrary' ? 'contrary' : 'parallel',
    octaves: Math.min(4, Math.max(1, Math.round(num(e.octaves)) || 1)),
    interval: ['unison', 'third', 'sixth', 'tenth'].includes(e.interval) ? e.interval : 'unison',
  };
}

export function emptyTarget() {
  return { name: '', grade: '', date: '', piecesNeeded: 3, scales: [], arpeggios: [] };
}

// Stored JSON to a clean target, or null when there is none (or it is unreadable).
export function parseTarget(raw) {
  try {
    const t = JSON.parse(raw);
    if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
    const list = v => (Array.isArray(v) ? v.map(cleanEntry).filter(Boolean) : []);
    const pieces = Math.round(Number(t.piecesNeeded));
    return {
      name: String(t.name || '').trim().slice(0, 40),
      grade: String(t.grade || ''),
      date: ISO.test(String(t.date || '')) ? t.date : '',
      piecesNeeded: Number.isFinite(pieces) ? Math.min(10, Math.max(0, pieces)) : 3,
      scales: list(t.scales),
      arpeggios: list(t.arpeggios),
    };
  } catch {
    return null;
  }
}

export const serializeTarget = t => JSON.stringify(t);

// The target editor has three lists (scales, contrary-motion scales, arpeggios) because the picker
// holds one entry per name, and a syllabus often wants the same key in both motions. These split a
// target into those lists and join them back; each list forces its own motion, so tapping a name in
// the picker (which flips motion) cannot move an entry into the wrong list.
export function splitScales(scales) {
  return {
    similar: (scales || []).filter(e => e.motion !== 'contrary'),
    contrary: (scales || []).filter(e => e.motion === 'contrary'),
  };
}

export function joinScales(similar, contrary) {
  const name = e => (typeof e === 'string' ? e : e && e.scale);
  const as = motion => e => ({ ...(typeof e === 'string' ? { scale: e, octaves: 1, interval: 'unison' } : e), motion });
  return [
    ...(similar || []).filter(name).map(as('parallel')),
    ...(contrary || []).filter(name).map(as('contrary')),
  ];
}

// A target is worth showing once it asks for something.
export const targetHasContent = t => !!t && (t.scales.length + t.arpeggios.length > 0 || (t.piecesNeeded > 0 && !!t.grade));

const INTERVAL_WORDS = { third: 'in 3rds', sixth: 'in 6ths', tenth: 'in 10ths' };

// "Bb major, 2 oct", "C harmonic minor, 2 oct, contrary", "G major, 2 oct, in 3rds".
export function describeRequirement(r) {
  const bits = [`${r.octaves} oct`];
  if (r.motion === 'contrary') bits.push('contrary');
  if (INTERVAL_WORDS[r.interval]) bits.push(INTERVAL_WORDS[r.interval]);
  return `${r.name}, ${bits.join(', ')}`;
}

function practisedEntries(sessions, group, today) {
  const out = [];
  (sessions || []).forEach(s => {
    if (!s.date || s.date > today) return;
    (s.segments || []).forEach(seg => {
      if (seg.group !== group) return;
      (seg.scales || []).forEach(e => {
        const isStr = typeof e === 'string';
        const name = isStr ? e : e && e.scale;
        if (!name) return;
        out.push({
          name,
          octaves: (isStr ? 0 : num(e.octaves)) || num(seg.octaves) || 1,
          motion: !isStr && e.motion === 'contrary' ? 'contrary' : 'parallel',
          interval: (!isStr && e.interval) || 'unison',
          date: s.date,
        });
      });
    });
  });
  return out;
}

// How far along you are against a target. A requirement is met by a logged scale (or arpeggio)
// with the same name, motion and interval, played over at least the required octaves. `recent`
// means within `recentDays`; `stale` means practised but longer ago; `never` is not yet.
// -> { scales, arpeggios, counts, pieces, sightReading, daysLeft }
export function readiness(target, sessions, compositions, today, recentDays = 21) {
  const check = (reqs, group) => {
    const seen = practisedEntries(sessions, group, today);
    return reqs.map(r => {
      const hits = seen.filter(e => e.name === r.scale && e.motion === r.motion && e.interval === r.interval && e.octaves >= r.octaves);
      const lastDate = hits.reduce((d, h) => (h.date > d ? h.date : d), '') || null;
      const daysSince = lastDate ? daysBetween(lastDate, today) : null;
      return {
        group, name: r.scale, octaves: r.octaves, motion: r.motion, interval: r.interval,
        lastDate, daysSince, times: hits.length,
        status: !lastDate ? 'never' : daysSince <= recentDays ? 'recent' : 'stale',
      };
    });
  };
  const scales = check(target.scales, 'Scales');
  const arpeggios = check(target.arpeggios, 'Arpeggios');
  const all = [...scales, ...arpeggios];
  const count = status => all.filter(r => r.status === status).length;

  const candidates = target.grade
    ? (compositions || []).filter(c => c.grade === target.grade && c.status !== 'ambition')
    : [];
  const ready = candidates.filter(c => c.status === 'performance-ready').length;

  const cutoff = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 28);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  let srSessions = 0;
  let srMinutes = 0;
  (sessions || []).forEach(s => {
    if (!s.date || s.date < cutoff || s.date > today) return;
    const segs = (s.segments || []).filter(g => g.group === 'Sight-reading');
    if (!segs.length) return;
    srSessions += 1;
    srMinutes += segs.reduce((t, g) => t + num(g.duration), 0);
  });

  return {
    scales, arpeggios,
    counts: { total: all.length, recent: count('recent'), stale: count('stale'), never: count('never') },
    pieces: {
      needed: target.piecesNeeded, ready, candidates: candidates.length,
      list: candidates.map(c => ({ id: c.id, title: c.title || 'Untitled', status: c.status || 'new' })),
      short: Math.max(0, target.piecesNeeded - ready),
    },
    sightReading: { sessions: srSessions, minutes: srMinutes },
    daysLeft: target.date ? daysBetween(today, target.date) : null,
  };
}

// ── Small helpers for the sections below ──────────────────────────────────────────────────

function addDays(iso, n) {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "12 Oct", or "12 Oct 2026" with the year.
export function shortDate(iso, withYear = false) {
  return `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]}${withYear ? ` ${iso.slice(0, 4)}` : ''}`;
}

const minutesLabel = m => {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${r}m`;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Run-throughs ───────────────────────────────────────────────────────────────────────────
//
// A run-through is a full play of a piece from start to finish without stopping. It is what an exam
// asks for, and practice minutes don't show it. It is logged as a count on a repertoire segment
// (`runThroughs`, typed like the BPM, so it may be text). Anything blank, negative or not a number is
// zero, and a count is capped at 99 so a slip of the finger can't swamp the totals.

export function runThroughsOf(seg) {
  const n = Math.floor(Number(seg && seg.runThroughs));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

// Per piece (the library piece, else the title): how many run-throughs in all, and in the last
// `recentDays` days (today included), when the last one was, and how many practice segments they
// came from. Most recent activity first. -> [{ key, compositionId, name, total, recent, lastDate,
// segments, best }] where `best` is the most in a single segment.
export function runThroughStats(sessions, compositions, today, recentDays = 30) {
  const byKey = new Map();
  (sessions || []).forEach(s => {
    if (!s.date || s.date > today) return;
    (s.segments || []).forEach(seg => {
      if (seg.type !== 'repertoire') return;
      const n = runThroughsOf(seg);
      if (!n) return;
      const k = seriesKey(seg);
      if (!k) return;
      if (!byKey.has(k.key)) byKey.set(k.key, { key: k.key, compositionId: k.compositionId, fallbackName: k.name, total: 0, recent: 0, lastDate: '', segments: 0, best: 0 });
      const p = byKey.get(k.key);
      p.total += n;
      p.segments += 1;
      p.best = Math.max(p.best, n);
      if (daysBetween(s.date, today) < recentDays) p.recent += n;
      if (s.date > p.lastDate) p.lastDate = s.date;
    });
  });
  const titleOf = id => ((compositions || []).find(c => c.id === id) || {}).title;
  return [...byKey.values()]
    .map(({ fallbackName, ...p }) => ({ ...p, name: (p.compositionId && titleOf(p.compositionId)) || fallbackName || 'Untitled' }))
    .sort((a, b) => b.recent - a.recent || b.total - a.total || a.name.localeCompare(b.name));
}

// "6 run-throughs, 2 in the last month", or "none yet".
export function describeRunThroughs(p, recentLabel = 'in the last month') {
  if (!p || !p.total) return 'none yet';
  return `${plural(p.total, 'run-through')}${p.recent > 0 && p.recent < p.total ? `, ${p.recent} ${recentLabel}` : ''}`;
}

// "3 run-throughs" for one practice segment, or null when none were logged.
export function formatRunThroughs(seg) {
  const n = runThroughsOf(seg);
  return n ? plural(n, 'run-through') : null;
}

// A run-through count after adding `delta` (+1 or -1, from the practice timer's buttons), kept
// between 0 and 99. A blank or junk count is taken as zero.
export function bumpRunThroughs(current, delta) {
  return Math.min(99, Math.max(0, runThroughsOf({ runThroughs: current }) + delta));
}

// A segment with its clean tempo set from the metronome (the practice timer's "log tempo as clean"
// button): rounded, and kept within the metronome's own range of 30 to 240 bpm. Something that is not
// a usable number clears the tempo. A new object; the segment passed in is untouched.
export function withCleanTempo(seg, bpm) {
  const { tempo: _previous, ...rest } = seg; // eslint-disable-line no-unused-vars
  const n = Math.round(Number(bpm));
  return Number.isFinite(n) && n > 0 ? { ...rest, tempo: clampBpm(n) } : rest;
}

// ── Scales for today ──────────────────────────────────────────────────────────────────────────
//
// Which scales and arpeggios to practise today. If you have a grade target its requirements come
// first (the ones you have never practised, then the ones left longest), then scales you have
// played before but dropped for two weeks or more that aren't in the target, and only then
// requirements you have already played lately, longest ago first, so the list never runs dry.
// Never-practised requirements are put in an order that changes each day (from the date), so a
// long list doesn't always show the same few; everything else is by how long it has been.

function dayHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const reasonFor = (status, daysSince) => {
  if (status === 'never') return 'not practised yet';
  const when = daysSince === 0 ? 'today' : agoLabel(daysSince);
  return status === 'stale' ? `last played ${when}` : `played ${when}`;
};

// -> [{ group: 'Scales' | 'Arpeggios', name, label, status: 'never' | 'stale' | 'recent', daysSince,
//       reason, fromTarget }]
export function suggestScales(target, sessions, today, limit = 5, recentDays = 21) {
  const items = [];
  const seen = new Set();
  if (target && target.scales.length + target.arpeggios.length > 0) {
    const r = readiness(target, sessions, [], today, recentDays);
    [...r.scales, ...r.arpeggios].forEach(q => {
      seen.add(`${q.group}|${q.name}`);
      items.push({ group: q.group, name: q.name, label: describeRequirement(q), status: q.status, daysSince: q.daysSince, fromTarget: true, tier: q.status === 'never' ? 0 : q.status === 'stale' ? 1 : 3 });
    });
  }
  staleScales(sessions, today, 14).forEach(x => {
    if (seen.has(`${x.kind}|${x.name}`)) return;
    items.push({ group: x.kind, name: x.name, label: x.name, status: 'stale', daysSince: x.daysSince, fromTarget: false, tier: 2 });
  });
  items.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === 0) return dayHash(`${today}|${a.group}|${a.name}`) - dayHash(`${today}|${b.group}|${b.name}`) || a.name.localeCompare(b.name);
    return (b.daysSince - a.daysSince) || a.name.localeCompare(b.name);
  });
  return items.slice(0, limit).map(({ tier, ...x }) => ({ ...x, reason: reasonFor(x.status, x.daysSince) }));
}

// ── Today's plan ──────────────────────────────────────────────────────────────────────────────────
//
// A practice routine put together from what the app already knows: a scales warm-up if any are due, then
// the pieces that most need attention, each with its reason, sharing out the time you usually practise.
// The segments have the same shape the timer plan uses (see routineToPlan), so one tap starts them.

// How long to plan for: the middle of your last ten sessions (within two months), kept between 20 and 60
// minutes and rounded to 5. 30 when there is nothing to go on.
export function planBudget(sessions, today) {
  const recent = (sessions || [])
    .filter(s => s.date && s.date <= today && daysBetween(s.date, today) <= 60 && num(s.duration) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(s => num(s.duration))
    .sort((a, b) => a - b);
  if (!recent.length) return 30;
  const mid = recent.length % 2 ? recent[(recent.length - 1) / 2] : (recent[recent.length / 2 - 1] + recent[recent.length / 2]) / 2;
  return Math.min(60, Math.max(20, Math.round(mid / 5) * 5));
}

// The pieces your teacher gave a task on in the last four weeks that you haven't ticked off or played
// since. -> Set of library piece ids.
export function openAssignmentPieces(lessons, sessions, today) {
  const out = new Set();
  (lessons || []).forEach(l => {
    if (!l.date || l.date > today || daysBetween(l.date, today) > 28) return;
    (l.segments || []).forEach(seg => {
      if (!seg.compositionId || !String(seg.assignment || '').trim() || seg.assignmentDone) return;
      const since = (sessions || []).some(s => s.date > l.date && s.date <= today
        && (s.segments || []).some(g => g.type === 'repertoire' && g.compositionId === seg.compositionId));
      if (!since) out.add(seg.compositionId);
    });
  });
  return out;
}

// -> { segments, items, minutes, budget }. `items` is what the card shows: [{ kind: 'scales' | 'piece',
// title, minutes, reason }]. Nothing to suggest gives empty lists.
export function buildTodayPlan(target, sessions, lessons, compositions, today, opts = {}) {
  const examDate = opts.examDate || null;
  const makeId = opts.makeId || (() => `plan-${Math.random().toString(36).slice(2, 9)}`);
  const budget = planBudget(sessions, today);
  const items = [];

  const due = suggestScales(target, sessions, today, 3).filter(x => x.status !== 'recent');
  if (due.length) {
    const hasScale = due.some(x => x.group === 'Scales');
    items.push({
      kind: 'scales', title: hasScale ? 'Scales' : 'Arpeggios', compositionId: '',
      minutes: budget >= 40 ? 10 : 8, reason: due.map(x => x.name).join(', '),
    });
  }

  const assigned = openAssignmentPieces(lessons, sessions, today);
  const ranked = (compositions || [])
    .filter(c => c.status === 'learning' || c.status === 'consolidating')
    .map(c => {
      const r = pieceReport(c, sessions, lessons, today, examDate);
      const days = r.practice.daysSince;
      const reasons = [];
      let score = 0;
      if (assigned.has(c.id)) { score += 3; reasons.push('open task from your lesson'); }
      if (r.stalled) { score += 2; reasons.push(`tempo stalled at ${r.stalled.bpm}`); }
      if (r.trajectory && r.trajectory.status === 'behind') { score += 2; reasons.push('behind on tempo'); }
      if (r.spots.open.length) { score += 1.5; reasons.push(`${r.spots.open.length === 1 ? '1 tricky spot' : `${r.spots.open.length} tricky spots`}`); }
      if (days === null) { score += 1; reasons.push('not played yet'); }
      else if (days >= 7) { score += 1 + Math.min(2, Math.floor((days - 7) / 7)); reasons.push(`not played for ${days} days`); }
      return { c, score, days: days === null ? 9999 : days, reason: reasons[0] || '' };
    })
    .sort((a, b) => b.score - a.score || b.days - a.days || String(a.c.title).localeCompare(String(b.c.title)));
  const chosen = ranked.filter(x => x.score > 0).slice(0, 3);
  if (!chosen.length && ranked.length) chosen.push(ranked[0]);

  const warm = items.length ? items[0].minutes : 0;
  const left = Math.max(5, budget - warm);
  chosen.forEach((x, i) => {
    const each = Math.max(5, Math.floor(left / chosen.length / 5) * 5);
    const minutes = i === chosen.length - 1 ? Math.max(5, left - each * (chosen.length - 1)) : each;
    items.push({ kind: 'piece', title: x.c.title || 'Untitled', compositionId: x.c.id, minutes, reason: x.reason || 'next in rotation' });
  });

  const segments = items.map(it => ({
    id: makeId(), type: it.kind === 'scales' ? 'technique' : 'repertoire', title: it.title,
    compositionId: it.compositionId, plannedMinutes: Math.min(60, Math.max(1, it.minutes)), confirmed: true,
  }));
  return { segments, items, minutes: items.reduce((t, x) => t + x.minutes, 0), budget };
}

// ── The summary for a lesson ──────────────────────────────────────────────────────────────────
//
// Everything since your last lesson on one page, to read in the lesson or send to your teacher. With
// no lesson logged yet it covers the last `fallbackDays` days. Practice counts from the day after the
// lesson (the lesson day itself is the lesson's).

// -> { period, totals, pieces, technique, wins, challenges, progress, assignments, lastLesson,
//      scales, plannedNext }. See briefText for how each part reads.
export function lessonBrief(lessons, sessions, compositions, today, opts = {}) {
  const fallbackDays = opts.fallbackDays || 28;
  const past = (lessons || []).filter(l => l.date && l.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const last = past[0] || null;
  // Usually the window is "since the last lesson"; `opts.range` ({ from, to, label }) gives it explicitly
  // instead, as the weekly review does.
  const range = opts.range || null;
  const since = range ? null : (last ? last.date : null);
  const from = range ? range.from : (since || addDays(today, -fallbackDays));
  const upper = range && range.to < today ? range.to : today;
  const inRange = d => d <= upper && (since ? d > since : d >= from);
  const inWindow = s => s.date && inRange(s.date);
  const win = (sessions || []).filter(inWindow).sort((a, b) => a.date.localeCompare(b.date));

  const energies = win.filter(s => s.energy != null && s.energy !== '').map(s => Number(s.energy));
  const enjoyments = win.filter(s => s.enjoyment != null && s.enjoyment !== '' && Number(s.enjoyment) > 0).map(s => Number(s.enjoyment));
  const avg = a => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
  const minutes = win.reduce((t, s) => t + num(s.duration), 0);
  const totals = {
    sessions: win.length,
    practiceDays: new Set(win.map(s => s.date)).size,
    minutes,
    avgMinutes: win.length ? Math.round(minutes / win.length) : 0,
    avgEnergy: avg(energies),
    avgEnjoyment: avg(enjoyments),
  };

  const titleOf = id => ((compositions || []).find(c => c.id === id) || {}).title;
  const labelOf = (seg, k) => (seg.type === 'repertoire' ? ((seg.compositionId && titleOf(seg.compositionId)) || (k && k.name) || 'a piece') : (seg.group || seg.title || 'technique'));

  const pieceMap = new Map();
  const techMap = new Map();
  const challengeMap = new Map();
  const progressMap = new Map();
  const scaleSet = new Map();
  win.forEach(s => (s.segments || []).forEach(seg => {
    const k = seriesKey(seg);
    const where = labelOf(seg, k);
    if (seg.type === 'repertoire' && k) {
      if (!pieceMap.has(k.key)) pieceMap.set(k.key, { key: k.key, compositionId: k.compositionId, name: where, sessions: 0, minutes: 0, runThroughs: 0 });
      const p = pieceMap.get(k.key);
      p.sessions += 1; p.minutes += num(seg.duration); p.runThroughs += runThroughsOf(seg);
    } else if (seg.type === 'technique') {
      const name = seg.group || seg.title || 'Technique';
      if (!techMap.has(name)) techMap.set(name, { name, sessions: 0, minutes: 0 });
      const t = techMap.get(name);
      t.sessions += 1; t.minutes += num(seg.duration);
    }
    (seg.challenges || []).forEach(tag => {
      if (!tag) return;
      if (!challengeMap.has(tag)) challengeMap.set(tag, { tag, count: 0, where: new Map() });
      const c = challengeMap.get(tag);
      c.count += 1; c.where.set(where, (c.where.get(where) || 0) + 1);
    });
    (seg.progress || []).forEach(tag => { if (tag) progressMap.set(tag, (progressMap.get(tag) || 0) + 1); });
    if (seg.group === 'Scales' || seg.group === 'Arpeggios') {
      (seg.scales || []).forEach(e => { const n = nameOf(e); if (n) scaleSet.set(`${seg.group}|${n}`, { group: seg.group, name: n }); });
    }
  }));

  // Tempo over the window for each piece: where it stood at the lesson (the last BPM logged by then)
  // and where it is now. With no earlier reading, the first one in the window stands in for it.
  const series = new Map(tempoProgress((sessions || []).filter(s => s.date && s.date <= today), compositions).map(p => [p.key, p]));
  const pieces = [...pieceMap.values()].map(p => {
    const sr = series.get(p.key);
    let tempo = null;
    if (sr) {
      const inWin = sr.points.filter(pt => inRange(pt.date));
      if (inWin.length) {
        const before = since ? sr.points.filter(pt => pt.date <= since).pop() : (range ? sr.points.filter(pt => pt.date < from).pop() : null);
        const to = inWin[inWin.length - 1].bpm;
        const start = before ? before.bpm : (inWin.length > 1 ? inWin[0].bpm : null);
        tempo = { from: start, to, change: start === null ? null : to - start, target: sr.target };
      }
    }
    return { ...p, tempo };
  }).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  const challenges = [...challengeMap.values()]
    .filter(c => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 6)
    .map(c => ({ tag: c.tag, count: c.count, where: [...c.where.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 2).map(([n]) => n) }));

  const asg = lessonAssignments(lessons, sessions, today, compositions);
  const lastFocus = [...win].reverse().find(s => typeof s.tomorrowFocus === 'string' && s.tomorrowFocus.trim());
  const scaleList = [...scaleSet.values()];

  return {
    period: range
      ? { hasLesson: false, since: null, from, to: upper, days: daysBetween(from, upper) + 1, label: range.label || null }
      : { hasLesson: !!last, since, from, days: since ? daysBetween(since, today) : fallbackDays },
    totals,
    pieces,
    runThroughs: pieces.reduce((t, p) => t + p.runThroughs, 0),
    technique: [...techMap.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)).slice(0, 5),
    wins: [...win].reverse().filter(s => typeof s.wins === 'string' && s.wins.trim()).slice(0, 6).map(s => ({ date: s.date, text: s.wins.trim() })),
    challenges,
    progress: [...progressMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([tag, count]) => ({ tag, count })),
    assignments: {
      lessonDate: asg.lessonDate,
      open: asg.items.filter(i => i.status === 'open').map(i => ({ label: i.label, text: i.text, lessonDate: i.lessonDate })),
      covered: asg.items.filter(i => i.status === 'covered').length,
      done: asg.items.filter(i => i.status === 'done').length,
    },
    lastLesson: last ? {
      date: last.date,
      teacher: last.teacher || null,
      wins: (last.wins || '').trim() || null,
      feedback: (last.segments || []).filter(g => typeof g.feedback === 'string' && g.feedback.trim()).map(g => ({ label: labelOf(g, seriesKey(g)), text: g.feedback.trim() })),
    } : null,
    scales: {
      scales: scaleList.filter(x => x.group === 'Scales').length,
      arpeggios: scaleList.filter(x => x.group === 'Arpeggios').length,
      names: scaleList.map(x => x.name).filter((n, i, a) => a.indexOf(n) === i).sort().slice(0, 12),
    },
    spots: pieces
      .map(p => ({ name: p.name, line: openSpotsLine((compositions || []).find(c => c.id === p.compositionId)) }))
      .filter(x => x.line),
    plannedNext: lastFocus ? lastFocus.tomorrowFocus.trim() : null,
  };
}

// The summary as plain text, to copy or share. No formatting characters beyond "-" for list items, so
// it reads the same in a message, an email or a notes app.
export function briefText(b) {
  const L = [];
  const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)}`;
  L.push(b.period.label
    ? b.period.label
    : b.period.hasLesson
      ? `Since my last lesson on ${shortDate(b.period.since, true)} (${plural(b.period.days, 'day')} ago)`
      : `The last ${b.period.days} days (no lesson logged yet)`);

  if (!b.totals.sessions) {
    L.push('', 'No practice logged in this time.');
  } else {
    L.push('', `Practice: ${plural(b.totals.sessions, 'session')} on ${plural(b.totals.practiceDays, 'day')}, ${minutesLabel(b.totals.minutes)} (about ${b.totals.avgMinutes} min each).`);
    const mood = [];
    if (b.totals.avgEnergy !== null) mood.push(`energy averaged ${signed(b.totals.avgEnergy)}`);
    if (b.totals.avgEnjoyment !== null) mood.push(`enjoyment ${Math.round(b.totals.avgEnjoyment * 10) / 10} out of 5`);
    if (mood.length) L.push(`${mood.join(' and ').replace(/^./, c => c.toUpperCase())}.`);
  }

  if (b.pieces.length) {
    L.push('', 'Pieces');
    b.pieces.slice(0, 8).forEach(p => {
      const bits = [plural(p.sessions, 'session'), minutesLabel(p.minutes)];
      if (p.tempo) {
        const range = p.tempo.from !== null && p.tempo.from !== p.tempo.to ? `${p.tempo.from} → ${p.tempo.to} bpm (${p.tempo.change > 0 ? '+' : '−'}${Math.abs(p.tempo.change)})` : `${p.tempo.to} bpm`;
        bits.push(p.tempo.target ? `${range}, target ${p.tempo.target}` : range);
      }
      if (p.runThroughs) bits.push(plural(p.runThroughs, 'run-through'));
      L.push(`- ${p.name}: ${bits.join(', ')}`);
    });
    if (b.pieces.length > 8) L.push(`- and ${b.pieces.length - 8} more`);
  }

  if (b.technique.length) {
    L.push('', 'Technique');
    b.technique.forEach(t => L.push(`- ${t.name}: ${plural(t.sessions, 'session')}, ${minutesLabel(t.minutes)}`));
  }
  if (b.scales.scales + b.scales.arpeggios > 0) {
    const parts = [];
    if (b.scales.scales) parts.push(plural(b.scales.scales, 'scale'));
    if (b.scales.arpeggios) parts.push(plural(b.scales.arpeggios, 'arpeggio'));
    L.push('', `Scales and arpeggios: ${parts.join(' and ')} practised (${b.scales.names.join(', ')}${b.scales.scales + b.scales.arpeggios > b.scales.names.length ? ', ...' : ''}).`);
  }

  if (b.wins.length) { L.push('', 'Wins'); b.wins.forEach(w => L.push(`- ${shortDate(w.date)}: ${w.text}`)); }
  if (b.challenges.length) {
    L.push('', 'Challenges that kept coming up');
    b.challenges.forEach(c => L.push(`- ${c.tag} (${c.count} times${c.where.length ? `: ${c.where.join(', ')}` : ''})`));
  }
  if (b.spots && b.spots.length) {
    L.push('', 'Tricky spots still open');
    b.spots.forEach(x => L.push(`- ${x.name}: ${x.line}`));
  }
  if (b.progress.length) L.push('', `Progress marked: ${b.progress.map(p => `${p.tag} ${p.count}x`).join(', ')}.`);

  if (b.assignments.open.length) {
    L.push('', 'Still open from the lesson');
    b.assignments.open.forEach(a => L.push(`- ${a.label}: ${a.text}`));
  }
  if (b.lastLesson && b.lastLesson.feedback.length) {
    L.push('', `What ${b.lastLesson.teacher || 'my teacher'} said last time`);
    b.lastLesson.feedback.forEach(f => L.push(`- ${f.label}: ${f.text}`));
  }
  if (b.plannedNext) L.push('', `Planned next: ${b.plannedNext}`);
  return L.join('\n');
}

// ── The next tempo to aim for ───────────────────────────────────────────────────────────────
//
// From a piece's (or exercise's) logged clean BPMs, and for a piece its reference tempo, a sensible
// next step. The rule of thumb is a small, steady increase from the last clean reading, not a jump
// to the target:
//  - a step of about 5% of the last reading, never less than 2 bpm or more than 6;
//  - never past the piece's own tempo: at or above it there is nothing to climb, so it says so;
//  - if the last three readings, at least a week apart in all, are within 1 bpm of each other it has
//    stalled, and the step is halved (small steps get through a plateau where big ones don't);
//  - after four weeks without a reading, start again from the last one rather than adding to it.
// The result is always inside the metronome's range, 30 to 240.

const METRONOME_MIN = 30;
const METRONOME_MAX = 240;
const clampBpm = v => Math.min(METRONOME_MAX, Math.max(METRONOME_MIN, v));

// Whether the last three readings have stopped moving: within 1 bpm of each other, and a week or more
// apart from the first to the last.
function flatRun(points) {
  const lastThree = (points || []).slice(-3);
  return lastThree.length >= 3
    && Math.max(...lastThree.map(x => x.bpm)) - Math.min(...lastThree.map(x => x.bpm)) <= 1
    && daysBetween(lastThree[0].date, lastThree[2].date) >= 7;
}

// `p` is one item from tempoProgress. -> { kind: 'step' | 'small-step' | 'return' | 'at-target',
// bpm, from, step, reason }
export function suggestNextTempo(p, today) {
  const latest = p.latest;
  if (p.target && latest >= p.target) {
    return { kind: 'at-target', bpm: clampBpm(p.target), from: latest, step: 0, reason: `You have reached the ${p.target} target. Hold it, or play the piece through.` };
  }
  const idle = daysBetween(p.lastDate, today);
  if (idle >= 28) {
    return { kind: 'return', bpm: clampBpm(latest), from: latest, step: 0, reason: `${agoLabel(idle)} since your last reading. Start again from ${latest}.` };
  }
  const full = Math.min(6, Math.max(2, Math.round(latest * 0.05)));
  const flat = flatRun(p.points);
  const step = flat ? Math.max(2, Math.round(full / 2)) : full;
  const bpm = clampBpm(Math.min(p.target || Infinity, latest + step));
  return {
    kind: flat ? 'small-step' : 'step',
    bpm, from: latest, step: bpm - latest,
    reason: flat ? `Your last readings have sat at about ${latest}, so a smaller step.` : `${bpm - latest} above your last clean ${latest}.`,
  };
}

// A suggestion for everything with a logged tempo, most recently practised first.
// -> [{ key, kind: 'piece' | 'technique', name, compositionId, suggestion }]
export function nextTempos(sessions, compositions, today) {
  return tempoProgress((sessions || []).filter(s => s.date && s.date <= today), compositions)
    .map(p => ({ key: p.key, kind: p.kind, name: p.name, compositionId: p.compositionId, suggestion: suggestNextTempo(p, today) }));
}

// Library piece id -> the bpm to try next, for the metronome. Only pieces with a step to take (a piece
// at its target, or one left for a month, has nothing to suggest beyond what it already has).
export function tempoSuggestionMap(sessions, compositions, today) {
  const map = {};
  nextTempos(sessions, compositions, today).forEach(x => {
    const k = x.suggestion.kind;
    if (x.kind === 'piece' && x.compositionId && (k === 'step' || k === 'small-step')) map[x.compositionId] = x.suggestion.bpm;
  });
  return map;
}

// ── Is a piece stalled, and will it get there in time ──────────────────────────────────────
//
// A piece has stalled when its last three clean readings have sat within 1 bpm for a week or more and
// it is still short of its own tempo (and not left for a month, which is a break, not a plateau).
// -> null, or { bpm, since, days } (how long it has sat at that tempo, up to today).
export function tempoStalled(p, today) {
  if (!p || !flatRun(p.points)) return null;
  if (p.target && p.latest >= p.target) return null;
  if (daysBetween(p.lastDate, today) >= 28) return null;
  const since = p.points.slice(-3)[0].date;
  return { bpm: p.latest, since, days: daysBetween(since, today) };
}

// Will a piece reach its own tempo by the exam? Compares the pace needed from here with the pace of
// the last four weeks, when there are readings a week or more apart to measure one from. A piece with
// no tempo of its own has no projection. `examDate` is the grade target's date.
// -> null | { status: 'reached' | 'no-date' | 'unknown' | 'on-track' | 'behind', needPerWeek, ratePerWeek,
//             weeksLeft, projected, message }
export function tempoTrajectory(p, examDate, today) {
  if (!p || !p.target) return null;
  if (p.latest >= p.target) return { status: 'reached', message: `Reached the ${p.target} target.` };
  if (!examDate || examDate <= today) return { status: 'no-date', message: 'Set a future exam date in your grade target to see whether you are on track.' };

  const weeksLeft = Math.round(daysBetween(today, examDate) / 7 * 10) / 10;
  const needPerWeek = Math.round((p.target - p.latest) / Math.max(weeksLeft, 1) * 10) / 10;
  const when = shortDate(examDate);
  const recent = p.points.filter(x => daysBetween(x.date, today) <= 28);
  const span = recent.length >= 2 ? daysBetween(recent[0].date, recent[recent.length - 1].date) : 0;
  if (span < 7) {
    return {
      status: 'unknown', needPerWeek, ratePerWeek: null, weeksLeft, projected: null,
      message: `Needs about ${needPerWeek} bpm a week to reach ${p.target} by ${when}. A few more readings over a couple of weeks will show your pace.`,
    };
  }
  const ratePerWeek = Math.round((recent[recent.length - 1].bpm - recent[0].bpm) / (span / 7) * 10) / 10;
  const projected = Math.round(p.latest + ratePerWeek * weeksLeft);
  if (projected >= p.target) {
    return {
      status: 'on-track', needPerWeek, ratePerWeek, weeksLeft, projected,
      message: `On track: ${needPerWeek} bpm a week is needed to reach ${p.target} by ${when}, and you are managing ${ratePerWeek}.`,
    };
  }
  return {
    status: 'behind', needPerWeek, ratePerWeek, weeksLeft, projected,
    message: ratePerWeek <= 0
      ? `Behind: ${needPerWeek} bpm a week is needed to reach ${p.target} by ${when}, and your tempo hasn't risen in the last four weeks.`
      : `Behind: ${needPerWeek} bpm a week is needed to reach ${p.target} by ${when}, but you are managing ${ratePerWeek}, which would get you to about ${projected}.`,
  };
}

// ── Tricky spots ──────────────────────────────────────────────────────────────────────
//
// The bars of a piece that keep going wrong ("bars 9-12", "the left hand jump"), kept on the library
// piece as `spots: [{ id, bars, status: 'open' | 'fixed', added, fixed }]`. You add one when you find it,
// tick it off when it's solved, and the piece's page, the timer, the lesson summary and the weekly
// review all show the ones still open.

// Two ways of writing the same spot ("Bars 9-12", "bar 9–12", "9 - 12") are the same spot.
function spotKey(bars) {
  return String(bars || '').toLowerCase().replace(/[\u2013\u2014\u2212]/g, '-').replace(/\bbars?\b/g, '').replace(/\s+/g, '').trim();
}

// How a spot reads: a bare range of bars gets "Bars" in front ("9-12" -> "Bars 9-12"); anything else is as typed.
export function spotLabel(bars) {
  const t = String(bars || '').trim().replace(/\s+/g, ' ');
  return /^\d+(\s*[-\u2013\u2014]\s*\d+)?$/.test(t) ? `Bars ${t}` : t;
}

// A piece's stored spots, cleaned: only well-formed entries, no blank text, each spot once.
export function parseSpots(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach(x => {
    if (!x || typeof x !== 'object') return;
    const bars = String(x.bars || '').trim().replace(/\s+/g, ' ');
    const key = spotKey(bars);
    if (!bars || !key || seen.has(key)) return;
    seen.add(key);
    out.push({ id: String(x.id || key), bars, status: x.status === 'fixed' ? 'fixed' : 'open', added: x.added || null, fixed: x.status === 'fixed' ? (x.fixed || null) : null });
  });
  return out;
}

// The list with a new spot. Nothing is added for blank text, or for one that is already open; a spot you
// had fixed comes back open (it went wrong again). A new list; the one passed in is untouched.
export function addSpot(spots, bars, today, makeId = () => `spot-${Math.random().toString(36).slice(2, 9)}`) {
  const list = parseSpots(spots);
  const text = String(bars || '').trim().replace(/\s+/g, ' ');
  const key = spotKey(text);
  if (!text || !key) return list;
  const existing = list.find(x => spotKey(x.bars) === key);
  if (existing) return existing.status === 'open' ? list : list.map(x => (x === existing ? { ...x, status: 'open', fixed: null } : x));
  return [...list, { id: makeId(), bars: text, status: 'open', added: today, fixed: null }];
}

// A spot marked fixed (on `today`) or open again.
export function setSpotFixed(spots, id, fixed, today) {
  return parseSpots(spots).map(x => (x.id === id ? { ...x, status: fixed ? 'fixed' : 'open', fixed: fixed ? today : null } : x));
}

export const removeSpot = (spots, id) => parseSpots(spots).filter(x => x.id !== id);

// The spots still to fix on a piece, the longest-standing first.
export function openSpots(piece) {
  return parseSpots(piece && piece.spots).filter(x => x.status === 'open').sort((a, b) => String(a.added || '').localeCompare(String(b.added || '')));
}

// "Bars 9-12, the left hand jump", or '' when nothing is open. For the timer and the summaries.
export const openSpotsLine = piece => openSpots(piece).map(x => spotLabel(x.bars)).join(', ');

// ── Everything about one piece ─────────────────────────────────────────────────────────────
//
// The numbers for a piece's page: how much it has been practised, its tempo (with the next step, whether
// it has stalled, and whether it will get there by the exam), its run-throughs, what your teacher has said
// about it, and the last few times you played it. Pure, so the page itself is only layout.
// `piece` is the library entry; `examDate` the grade target's date, if there is one.
// The free-text fields a library piece keeps, in the order the page shows them.
const NOTE_FIELDS = [
  ['technicalChallenges', 'Technical challenges'], ['musicalFocus', 'Musical focus'], ['practiceNotes', 'Practice notes'],
  ['kerrinNotes', 'Teacher notes'], ['teacherFeedback', 'Teacher feedback'], ['myNotes', 'My notes'],
  ['info', 'About the piece'], ['notes', 'Notes'],
];

export function pieceReport(piece, sessions, lessons, today, examDate = null) {
  if (!piece) return null;
  const id = piece.id;
  const played = [];
  (sessions || []).forEach(s => {
    if (!s.date || s.date > today) return;
    (s.segments || []).forEach(seg => {
      if (seg.type === 'repertoire' && seg.compositionId === id) played.push({ date: s.date, sessionId: s.id, seg });
    });
  });
  played.sort((a, b) => b.date.localeCompare(a.date));

  const dated = (sessions || []).filter(s => s.date && s.date <= today);
  const series = tempoProgress(dated, [piece]).find(p => p.compositionId === id && p.kind === 'piece') || null;
  const lastDate = played.length ? played[0].date : null;

  const fromLessons = [];
  [...(lessons || [])].filter(l => l.date && l.date <= today).sort((a, b) => b.date.localeCompare(a.date)).forEach(l => {
    (l.segments || []).forEach(seg => {
      if (seg.compositionId !== id) return;
      const assignment = String(seg.assignment || '').trim();
      const feedback = String(seg.feedback || '').trim();
      if (assignment || feedback) fromLessons.push({ date: l.date, assignment: assignment || null, feedback: feedback || null, done: !!seg.assignmentDone });
    });
  });

  return {
    id,
    title: piece.title || 'Untitled',
    composer: piece.composer || null,
    status: piece.status || null,
    grade: piece.grade || null,
    notes: NOTE_FIELDS.map(([key, label]) => ({ label, text: String(piece[key] || '').trim() })).filter(x => x.text),
    practice: {
      sessions: new Set(played.map(m => m.sessionId || m.date)).size,
      minutes: played.reduce((t, m) => t + num(m.seg.duration), 0),
      firstDate: played.length ? played[played.length - 1].date : null,
      lastDate,
      daysSince: lastDate ? daysBetween(lastDate, today) : null,
    },
    tempo: series,
    next: series ? suggestNextTempo(series, today) : null,
    stalled: series ? tempoStalled(series, today) : null,
    trajectory: series ? tempoTrajectory(series, examDate, today) : null,
    runThroughs: runThroughStats(dated, [piece], today).find(p => p.compositionId === id) || null,
    recent: played.slice(0, 8).map(m => ({
      date: m.date,
      minutes: num(m.seg.duration),
      tempo: num(m.seg.tempo) > 0 ? num(m.seg.tempo) : null,
      runThroughs: runThroughsOf(m.seg),
      section: String(m.seg.section || '').trim() || null,
    })),
    fromLessons: fromLessons.slice(0, 4),
    spots: { open: openSpots(piece), fixed: parseSpots(piece.spots).filter(x => x.status === 'fixed') },
  };
}

// ── The week in review ─────────────────────────────────────────────────────────────────────
//
// A short summary of the last full Monday-to-Sunday week, for the start of the next one: the same
// report as the lesson summary (lessonBrief) over that week, compared with the week before, and what
// to carry into this week.

function mondayOf(iso) {
  const dow = (new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

// The review is offered on Monday, Tuesday and Wednesday, while last week is still fresh.
export function weeklyReviewDue(today) {
  const dow = (new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))).getUTCDay() + 6) % 7;
  return dow <= 2;
}

// -> { week: { from, to }, brief, previous: { sessions, minutes }, carry: { scales, pieces } }
//  - brief: lessonBrief over the week, so everything in it applies;
//  - previous: the week before, for a comparison;
//  - carry: up to three scales not played for two weeks, and up to three pieces being worked on that
//    have not been practised for a week (never-practised first), as of today.
export function weeklyReview(lessons, sessions, compositions, today) {
  const from = addDays(mondayOf(today), -7);
  const to = addDays(from, 6);
  const label = `Week of ${shortDate(from)} to ${shortDate(to)}`;
  const brief = lessonBrief(lessons, sessions, compositions, today, { range: { from, to, label } });

  const before = (sessions || []).filter(s => s.date && s.date >= addDays(from, -7) && s.date < from);
  const previous = { sessions: before.length, minutes: before.reduce((t, s) => t + num(s.duration), 0) };

  const lastSeen = new Map();
  (sessions || []).forEach(s => {
    if (!s.date || s.date > today) return;
    (s.segments || []).forEach(seg => {
      if (seg.compositionId && (!lastSeen.has(seg.compositionId) || s.date > lastSeen.get(seg.compositionId))) lastSeen.set(seg.compositionId, s.date);
    });
  });
  const pieces = (compositions || [])
    .filter(c => c.status === 'learning' || c.status === 'consolidating')
    .map(c => ({ name: c.title || 'Untitled', daysSince: lastSeen.has(c.id) ? daysBetween(lastSeen.get(c.id), today) : null }))
    .filter(p => p.daysSince === null || p.daysSince >= 7)
    .sort((a, b) => (a.daysSince === null ? -1 : b.daysSince === null ? 1 : b.daysSince - a.daysSince) || a.name.localeCompare(b.name))
    .slice(0, 3);
  const scales = staleScales(sessions, today, 14).slice(0, 3).map(x => ({ name: x.name, group: x.kind, daysSince: x.daysSince }));

  const spots = (compositions || [])
    .filter(c => c.status === 'learning' || c.status === 'consolidating')
    .map(c => ({ name: c.title || 'Untitled', line: openSpotsLine(c) }))
    .filter(x => x.line)
    .slice(0, 3);

  return { week: { from, to }, brief, previous, carry: { scales, pieces, spots } };
}

// The review as plain text, to read or share: the report, the comparison, and what to carry forward.
export function weeklyText(r) {
  const parts = [briefText(r.brief)];
  const now = r.brief.totals;
  if (now.sessions || r.previous.sessions) {
    const delta = now.minutes - r.previous.minutes;
    const how = delta === 0 ? 'the same time' : `${minutesLabel(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'}`;
    parts.push(`Compared with the week before: ${how} (${plural(now.sessions, 'session')} against ${r.previous.sessions}).`);
  }
  const carry = [];
  if (r.carry.scales.length) carry.push(`- Scales to revisit: ${r.carry.scales.map(x => `${x.name} (${agoLabel(x.daysSince)})`).join(', ')}`);
  if (r.carry.pieces.length) carry.push(`- Pieces not played for a week: ${r.carry.pieces.map(p => (p.daysSince === null ? `${p.name} (not yet)` : `${p.name} (${plural(p.daysSince, 'day')})`)).join(', ')}`);
  if (r.carry.spots && r.carry.spots.length) carry.push(`- Tricky spots to fix: ${r.carry.spots.map(x => `${x.name} (${x.line})`).join(', ')}`);
  if (carry.length) parts.push(['To carry into this week', ...carry].join('\n'));
  return parts.join('\n\n');
}
