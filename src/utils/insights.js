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
