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
