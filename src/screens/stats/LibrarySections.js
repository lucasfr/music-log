import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, SIZES, STATUS_COLOURS } from '../../theme';
import { Label } from '../../components/UI';
import { gradePathway } from '../../utils/planning';
import { periodCutoff, streakRuns, topStreaks, neglectedPieces, lessonInsights } from '../../utils/statsCalc';
import { AnimatedFill, Tap as TouchableOpacity } from '../../components/Motion';
import { labelIndices, labelAnchor } from '../../utils/chartLabels';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { deriveStatusHistory, todayISO } from '../../utils';
import { ZeldaBarFractional } from './shared';
import { librarySummary } from '../../utils/chartSummaries';
import { memorisedIds, dueFromMemory } from '../../utils/memory';
import { parseRestDays } from '../../utils/progress';
import { usePref } from '../../utils/usePref';

export function NeglectedPieces({ sessions, compositions }) {
  const today = todayISO();
  const neglected = useMemo(() => neglectedPieces(sessions, compositions, today), [sessions, compositions, today]);
  // Memorised pieces not played from memory for two weeks or more are due a run, even if you have been
  // playing them from the score (see dueFromMemory in utils/memory.js).
  const memoryDue = useMemo(() => dueFromMemory(compositions, today), [compositions, today]);

  if (neglected.length === 0 && memoryDue.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>
      All active pieces practised in the last 7 days.
    </Text>
  );

  function urgencyColour(d) {
    if (d === null || d >= 21) return COLOURS.red;
    if (d >= 14) return COLOURS.amber;
    return COLOURS.steel;
  }

  function sinceLabel(d) {
    if (d === null) return 'never practised';
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  return (
    <View>
      {neglected.map(({ id, title, status, daysSince }) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: urgencyColour(daysSince) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }} numberOfLines={1}>
              📜 {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: STATUS_COLOURS[status]?.bg || COLOURS.tealAccent }}>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: STATUS_COLOURS[status]?.text || COLOURS.navy }}>{status}</Text>
              </View>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: urgencyColour(daysSince), fontStyle: 'italic' }}>
                {sinceLabel(daysSince)}
              </Text>
            </View>
          </View>
        </View>
      ))}
      {memoryDue.map(({ id, title, daysSince }) => (
        <View key={`memory-${id}`} accessible accessibilityLabel={`${title}, not played from memory for ${daysSince} days`}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: daysSince >= 28 ? COLOURS.red : COLOURS.amber }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text }} numberOfLines={1}>📜 {title}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: daysSince >= 28 ? COLOURS.red : COLOURS.amber, fontStyle: 'italic', marginTop: 4 }}>
              not played from memory for {daysSince} days
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function WinsTimeline({ sessions, period }) {
  const cutoff = periodCutoff(period, todayISO());

  const wins = sessions
    .filter(s => s.wins && s.wins.trim() && (!cutoff || s.date >= cutoff))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  if (wins.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No wins logged in this period.</Text>
  );

  return (
    <View>
      {wins.map((s, i) => (
        <View key={s.id || i} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ alignItems: 'center', width: 32 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOURS.gold, marginTop: 4 }} />
            {i < wins.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: COLOURS.glassBorderSubtle, marginTop: 4 }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 4 }}>
              {new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.text, lineHeight: 20 }}>“{s.wins}”</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Streak history ─────────────────────────────────────────────────────

export function StreakHistory({ sessions }) {
  const [restRaw] = usePref('restDays', '[]');
  const streaks = useMemo(() => streakRuns(sessions, parseRestDays(restRaw)), [sessions, restRaw]);
  const { top: visible, maxLen } = useMemo(() => topStreaks(streaks), [streaks]);

  if (sessions.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No sessions yet.</Text>
  );

  if (streaks.length === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No streaks of 2+ days yet.</Text>
  );

  return (
    <View>
      {visible.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={{ width: 28, alignItems: 'center' }}>
            <Text style={{ fontSize: i === 0 ? 20 : 16 }}>{i === 0 ? '🔥' : '⭐'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>
                {new Date(s.start + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(s.end + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.navy }}>{s.len} days</Text>
            </View>
            <View style={{ height: 4, backgroundColor: COLOURS.glassBorderSubtle, borderRadius: 2 }}>
              <View style={{ height: '100%', width: `${(s.len / maxLen) * 100}%`, backgroundColor: i === 0 ? COLOURS.amber : COLOURS.steel, borderRadius: 2 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Lesson insights ────────────────────────────────────────────────────────

export function LessonInsights({ lessons, sessions, compositions, period }) {
  const today = todayISO();
  const r = useMemo(() => lessonInsights(lessons, sessions, compositions, period, today), [lessons, sessions, compositions, period, today]);

  if (r.count === 0) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>No lessons logged in this period.</Text>
  );

  const { count: lessonCount, avgEnergy, avgEnjoyment, topPieces: topLessonPieces, lessonOnly: lessonOnlyPieces, maxCount } = r;

  return (
    <View>
      {/* Avg energy & enjoyment */}
      <View style={{ flexDirection: 'row', gap: 20, marginBottom: 16 }}>
        {avgEnergy !== null && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Avg energy</Text>
            <ZeldaBarFractional emoji="⚡" fill={avgEnergy + 3} size={16} />
          </View>
        )}
        {avgEnjoyment !== null && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Avg enjoyment</Text>
            <ZeldaBarFractional emoji="❤️" fill={avgEnjoyment} size={16} />
          </View>
        )}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.6 }}>Lessons</Text>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.navy, fontVariant: ['lining-nums'] }}>{lessonCount}</Text>
        </View>
      </View>

      {/* Most covered in lessons */}
      {topLessonPieces.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Label>Most covered in lessons</Label>
          {topLessonPieces.map(({ id, title, count }) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.text, flex: 1 }} numberOfLines={1}>📜 {title}</Text>
              <View style={{ width: 80, height: 6, backgroundColor: COLOURS.bg2, borderRadius: 3 }}>
                <View style={{ height: '100%', width: `${(count / maxCount) * 100}%`, backgroundColor: COLOURS.amber, borderRadius: 3 }} />
              </View>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.textDim, width: 30, textAlign: 'right' }}>{count}×</Text>
            </View>
          ))}
        </View>
      )}

      {/* Lesson-only pieces */}
      {lessonOnlyPieces.length > 0 && (
        <View>
          <Label>Lesson-only pieces</Label>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 8, fontStyle: 'italic' }}>Covered in lessons but not yet self-practised</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {lessonOnlyPieces.map(({ id, title }) => (
              <View key={id} style={{
                paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: RADIUS.pill,
                backgroundColor: COLOURS.lessonBg,
                shadowColor: COLOURS.lessonBorder,
                shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1,
              }}>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.lessonText }}>📜 {title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Library growth chart ─────────────────────────────────────────────────

export function LibraryGrowthChart({ compositions, sessions, lessons }) {
  const [width, setWidth] = useState(0);
  // Each piece's full status history, reconstructed once so the active-count
  // line reflects what was actually active at each past checkpoint — not
  // just today's snapshot.
  const histories = useMemo(
    () => compositions.map(c => deriveStatusHistory(c.id, sessions, lessons, c.shelvedAt)),
    [compositions, sessions, lessons]
  );
  const H = 150;
  const padL = 6, padR = 6, padT = 8, padB = 24;

  // Group by month added (createdAt or dateStarted)
  const byMonth = {};
  compositions.forEach(c => {
    const raw = c.createdAt || c.dateStarted || null;
    if (!raw) return;
    const month = raw.slice(0, 7); // 'YYYY-MM'
    byMonth[month] = (byMonth[month] || 0) + 1;
  });

  const months = Object.keys(byMonth).sort();
  if (months.length < 2) return (
    <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Not enough data yet.</Text>
  );

  // Cumulative totals
  let running = 0;
  const pts = months.map(m => { running += byMonth[m]; return { m, total: running, added: byMonth[m] }; });
  const maxTotal = pts[pts.length - 1].total;

  function lastDayOfMonthISO(monthKey) {
    const [y, mo] = monthKey.split('-').map(Number);
    const lastDate = new Date(y, mo, 0).getDate();
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
  }

  function activeCountAt(monthKey) {
    const asOf = lastDayOfMonthISO(monthKey);
    let count = 0;
    histories.forEach(history => {
      if (history.length === 0) return; // still ambition as of any date
      let seg = history.find(s => s.start <= asOf && asOf < s.end);
      if (!seg) {
        const last = history[history.length - 1];
        if (asOf >= last.end) seg = last;
      }
      if (seg && seg.status !== 'shelved') count++;
    });
    return count;
  }

  const activePts = months.map(m => activeCountAt(m));
  const maxY = maxTotal; // active is always ≤ total, so share the scale

  function toX(i) { return padL + (i / (pts.length - 1)) * (width - padL - padR); }
  function toY(v) { return padT + (1 - v / maxY) * (H - padT - padB); }

  const totalPath  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.total).toFixed(1)}`).join(' ');
  const activePath = activePts.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  const summary = librarySummary(pts, activePts);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginBottom: 8 }}>
        {compositions.length} piece{compositions.length !== 1 ? 's' : ''} total · {compositions.filter(c => c.status !== 'ambition' && c.status !== 'shelved').length} active
      </Text>
      {width > 0 && (
        <View accessible accessibilityRole="image" accessibilityLabel={summary}>
          <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
          {/* Area fill — total */}
          <Path
            d={`${totalPath} L${toX(pts.length - 1).toFixed(1)},${H - padB} L${toX(0).toFixed(1)},${H - padB} Z`}
            fill={COLOURS.amber}
            opacity={0.12}
          />
          {/* Total line */}
          <Path d={totalPath} fill="none" stroke={COLOURS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={`t${i}`} cx={toX(i)} cy={toY(p.total)} r={3} fill={COLOURS.amber} />
          ))}
          {/* Active line */}
          <Path d={activePath} fill="none" stroke={COLOURS.steel} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" />
          {activePts.map((v, i) => (
            <Circle key={`a${i}`} cx={toX(i)} cy={toY(v)} r={3} fill={COLOURS.steel} />
          ))}
          {/* X-axis labels — density adapts to chart width, not a fixed step */}
          {pts.map((p, i) => {
            if (!labelIndices(pts.length, width - padL - padR).has(i)) return null;
            return (
              <SvgText key={p.m} x={toX(i)} y={H - 4} textAnchor={labelAnchor(toX(i), width)} fontSize="11" fill={COLOURS.textDim} fontFamily="Lato">
                {new Date(p.m + '-15').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
              </SvgText>
            );
          })}
          {/* Y-axis max label */}
          <SvgText x={padL} y={padT + 6} textAnchor="start" fontSize="11" fill={COLOURS.textDim} fontFamily="Lato">{maxY}</SvgText>
        </Svg>
        </View>
      )}
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 2, backgroundColor: COLOURS.amber, borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Total</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 2, backgroundColor: COLOURS.steel, borderRadius: 1 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Active</Text>
        </View>
      </View>
    </View>
  );
}

// The library by grade, easiest first: how many pieces are performance-ready and how much
// practice each has had. Tap a grade to see its pieces, furthest along first.
export function GradePathway({ compositions, sessions }) {
  const path = useMemo(() => gradePathway(compositions, sessions), [compositions, sessions]);
  const memorised = useMemo(() => memorisedIds(compositions), [compositions]);
  const [open, setOpen] = useState(() => {
    const next = path.find(g => g.pieces.some(p => p.status !== 'performance-ready' && p.status !== 'ambition' && p.status !== 'shelved'));
    return next ? next.grade : null;
  });
  const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  if (path.length === 0) {
    return <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.bodySmall, color: COLOURS.textDim }}>Give your pieces a grade in the library and they'll appear here.</Text>;
  }
  return (
    <View style={{ gap: 6 }}>
      {path.map(g => {
        const isOpen = open === g.grade;
        const started = g.pieces.filter(p => p.status !== 'new' && p.status !== 'ambition' && p.status !== 'shelved').length;
        return (
          <View key={g.grade}>
            <TouchableOpacity onPress={() => setOpen(isOpen ? null : g.grade)} activeOpacity={0.8}
              accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${g.grade}: ${g.ready} of ${g.total} performance-ready`}
              style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.body, color: COLOURS.text }}>{g.grade}</Text>
                <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim }}>
                  {g.ready}/{g.total} ready{g.minutes ? ` \u00b7 ${fmtMin(g.minutes)}` : ''}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: COLOURS.navyA(0.10), overflow: 'hidden', marginTop: 8 }}>
                <AnimatedFill fraction={started / g.total} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLOURS.steelA(0.45) }} />
                <AnimatedFill fraction={g.ready / g.total} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLOURS.success }} />
              </View>
            </TouchableOpacity>
            {isOpen && g.pieces.map(p => {
              const sc = STATUS_COLOURS[p.status] || {};
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{p.title}</Text>
                    {p.composer ? <Text numberOfLines={1} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>{p.composer}</Text> : null}
                    {memorised.has(p.id) ? <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.success }}>Memorised</Text> : null}
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: sc.bg || COLOURS.glass }}>
                    <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.tiny, color: sc.text || COLOURS.textDim }}>{p.status}</Text>
                  </View>
                  <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, minWidth: 44, textAlign: 'right' }}>{p.minutes ? fmtMin(p.minutes) : '\u2014'}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
