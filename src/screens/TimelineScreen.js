import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS } from '../theme';
import { SectionTitle, GlassCard } from '../components/UI';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_BAR_COLOURS = {
  learning:            { fill: COLOURS.accent,  track: COLOURS.accentLight,  label: COLOURS.practiceText },
  consolidating:       { fill: COLOURS.amber,   track: COLOURS.accent2Light, label: COLOURS.lessonText   },
  'performance-ready': { fill: COLOURS.gold,    track: COLOURS.yellowLight,  label: '#5A3A00'            },
};

function statusColour(status) {
  return STATUS_BAR_COLOURS[status] || { fill: COLOURS.steel, track: COLOURS.tealAccent, label: COLOURS.navy };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthAxis(minDate, maxDate) {
  const ticks = [];
  const totalMs = maxDate - minDate;
  if (totalMs <= 0) return ticks;
  let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    ticks.push({ label: MONTHS_SHORT[d.getMonth()], year: d.getFullYear(), x: (d - minDate) / totalMs });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return ticks;
}

function buildYearLines(minDate, maxDate) {
  const lines = [];
  const totalMs = maxDate - minDate;
  if (totalMs <= 0) return lines;
  let year = minDate.getFullYear() + 1;
  while (year <= maxDate.getFullYear()) {
    const d = new Date(year, 0, 1);
    if (d > minDate && d < maxDate) lines.push({ year, x: (d - minDate) / totalMs });
    year++;
  }
  return lines;
}

// ─── Gantt bar ────────────────────────────────────────────────────────────────

function GanttBar({ comp, minDate, maxDate, today, onPress, selected }) {
  const totalMs = maxDate - minDate;
  const sc = statusColour(comp.status);

  const started   = parseDate(comp.dateStarted);
  const completed = parseDate(comp.dateCompleted);
  const start = started   || today;
  const end   = completed || today;

  const clampedStart = Math.max(0, (start - minDate) / totalMs);
  const clampedEnd   = Math.min(1, (end   - minDate) / totalMs);
  const barWidth     = Math.max(0.008, clampedEnd - clampedStart);
  const isOngoing    = !completed;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={{ paddingVertical: 3 }}>
        {/* Track */}
        <View style={{
          height: 22,
          borderRadius: RADIUS.pill,
          backgroundColor: sc.track,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Bar */}
          <View style={{
            position: 'absolute',
            left:  `${clampedStart * 100}%`,
            width: `${barWidth   * 100}%`,
            top: 0, bottom: 0,
            borderRadius: RADIUS.pill,
            backgroundColor: sc.fill,
            opacity: selected ? 1 : 0.80,
            // Dashed right border for ongoing (web only—RN doesn't support dashed borders on arbitrary sides)
            borderRightWidth: isOngoing ? 3 : 0,
            borderRightColor: 'rgba(255,255,255,0.60)',
            shadowColor: sc.fill,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: selected ? 0.55 : 0.20,
            shadowRadius: selected ? 8 : 3,
          }} />
        </View>

        {/* Row label */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 2 }}>
          <Text
            style={{ fontFamily: selected ? 'Lato-Bold' : 'Lato', fontSize: 11, color: selected ? COLOURS.navy : COLOURS.textMuted, flex: 1 }}
            numberOfLines={1}
          >
            {comp.title}{comp.composer ? ` — ${comp.composer}` : ''}
          </Text>
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim, marginLeft: 8 }}>
            {started ? formatDate(comp.dateStarted) : '?'}
            {' → '}
            {completed ? formatDate(comp.dateCompleted) : 'ongoing'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ comp, sessions }) {
  if (!comp) return null;
  const sc = statusColour(comp.status);

  const compSessions = sessions.filter(s =>
    (s.segments || []).some(sg => sg.compositionId === comp.id)
  );
  const totalMins = compSessions.reduce((acc, s) => {
    const seg = (s.segments || []).find(sg => sg.compositionId === comp.id);
    return acc + (seg?.duration ? Number(seg.duration) : 0);
  }, 0);

  return (
    <BlurView intensity={32} tint="light" style={{
      borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 12,
      shadowColor: sc.fill, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4,
    }}>
      <View style={{ padding: 14, backgroundColor: COLOURS.glass }}>
        <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 18, color: COLOURS.text, marginBottom: 2 }}>
          📜 {comp.title}
        </Text>
        {comp.composer    ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textMuted }}>{comp.composer}</Text> : null}
        {comp.arrangement ? <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>arr. {comp.arrangement}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          {comp.grade ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Grade</Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: COLOURS.navy }}>{comp.grade}</Text>
            </View>
          ) : null}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Started</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.text }}>{formatDate(comp.dateStarted) || '—'}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Completed</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.text }}>{formatDate(comp.dateCompleted) || 'ongoing'}</Text>
          </View>
          {compSessions.length > 0 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Sessions</Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: COLOURS.navy }}>{compSessions.length}</Text>
            </View>
          )}
          {totalMins > 0 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 10, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Time logged</Text>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 15, color: COLOURS.navy }}>{totalMins} min</Text>
            </View>
          )}
        </View>

        {comp.status && (
          <View style={{
            marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: RADIUS.pill, backgroundColor: sc.track,
          }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 11, color: sc.label }}>{comp.status}</Text>
          </View>
        )}
      </View>
    </BlurView>
  );
}

// ─── Timeline chart ───────────────────────────────────────────────────────────

function TimelineChart({ compositions, sessions, selectedId, onSelect }) {
  const today = useMemo(() => new Date(), []);

  const datedPieces = compositions.filter(c => c.dateStarted);

  const { minDate, maxDate } = useMemo(() => {
    if (datedPieces.length === 0) {
      const y = today.getFullYear();
      return { minDate: new Date(y, 0, 1), maxDate: new Date(y, 11, 31) };
    }
    let min = Infinity, max = -Infinity;
    datedPieces.forEach(c => {
      const s = parseDate(c.dateStarted);
      const e = parseDate(c.dateCompleted) || today;
      if (s) { min = Math.min(min, s); max = Math.max(max, s); }
      max = Math.max(max, e);
    });
    const pad = 30 * 24 * 3600 * 1000;
    return { minDate: new Date(min - pad), maxDate: new Date(max + pad) };
  }, [datedPieces, today]);

  const monthTicks = useMemo(() => buildMonthAxis(minDate, maxDate), [minDate, maxDate]);
  const yearLines  = useMemo(() => buildYearLines(minDate, maxDate),  [minDate, maxDate]);

  const totalMs   = maxDate - minDate;
  const todayFrac = Math.min(1, Math.max(0, (today - minDate) / totalMs));

  const spanMonths = totalMs / (30 * 24 * 3600 * 1000);

  const sorted = useMemo(() => [
    ...datedPieces.sort((a, b) => (a.dateStarted || '').localeCompare(b.dateStarted || '')),
    ...compositions.filter(c => !c.dateStarted),
  ], [datedPieces, compositions]);

  if (sorted.length === 0) {
    return (
      <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.textDim }}>No pieces in library yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Month axis */}
      <View style={{ position: 'relative', height: 28, marginBottom: 4 }}>
        {yearLines.map(({ year, x }) => (
          <View key={`axis-yl-${year}`} style={{
            position: 'absolute', left: `${x * 100}%`,
            top: 0, bottom: 0, width: 1,
            backgroundColor: COLOURS.glassBorderSubtle,
          }} />
        ))}
        {monthTicks
          .filter((_, i) => {
            if (spanMonths <= 14) return true;
            if (spanMonths <= 30) return i % 2 === 0;
            return i % 3 === 0;
          })
          .map(({ label, year, x }, i) => (
            <View key={`mt-${year}-${label}-${i}`} style={{
              position: 'absolute', left: `${x * 100}%`, top: 0, alignItems: 'flex-start',
            }}>
              <Text style={{ fontFamily: 'Lato', fontSize: 9, color: COLOURS.textDim, letterSpacing: 0.3 }}>
                {label}
              </Text>
            </View>
          ))
        }
        {yearLines.map(({ year, x }) => (
          <View key={`yr-${year}`} style={{
            position: 'absolute', left: `${x * 100}%`, top: 14, alignItems: 'flex-start',
          }}>
            <Text style={{ fontFamily: 'Lato-Bold', fontSize: 9, color: COLOURS.textDim }}>↑{year}</Text>
          </View>
        ))}
      </View>

      {/* Bar area */}
      <View style={{ position: 'relative' }}>
        {/* Grid */}
        {monthTicks.map(({ year, x, label }, i) => (
          <View key={`grid-${year}-${label}-${i}`} style={{
            position: 'absolute', left: `${x * 100}%`,
            top: 0, bottom: 0, width: 1,
            backgroundColor: COLOURS.glassBorderSubtle, opacity: 0.5,
          }} />
        ))}
        {yearLines.map(({ year, x }) => (
          <View key={`ydiv-${year}`} style={{
            position: 'absolute', left: `${x * 100}%`,
            top: 0, bottom: 0, width: 1,
            backgroundColor: COLOURS.glassBorderSubtle,
          }} />
        ))}
        {/* Today line */}
        <View style={{
          position: 'absolute', left: `${todayFrac * 100}%`,
          top: 0, bottom: 0, width: 2,
          backgroundColor: COLOURS.red, opacity: 0.55, zIndex: 10,
        }} />

        {sorted.map(comp => (
          <GanttBar
            key={comp.id}
            comp={comp}
            minDate={minDate}
            maxDate={maxDate}
            today={today}
            onPress={() => onSelect(comp.id === selectedId ? null : comp.id)}
            selected={comp.id === selectedId}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {['learning', 'consolidating', 'performance-ready'].map(s => {
          const c = STATUS_BAR_COLOURS[s];
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 12, height: 8, borderRadius: 4, backgroundColor: c.fill }} />
              <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>{s}</Text>
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 2, height: 12, backgroundColor: COLOURS.red, opacity: 0.55 }} />
          <Text style={{ fontFamily: 'Lato', fontSize: 11, color: COLOURS.textDim }}>today</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen({ compositions, sessions, isDesktop }) {
  const [selectedId, setSelectedId]     = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = filterStatus === 'all'
    ? compositions
    : compositions.filter(c => c.status === filterStatus);

  const selectedComp = selectedId ? compositions.find(c => c.id === selectedId) : null;
  const undatedCount = compositions.filter(c => !c.dateStarted).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingLeft: isDesktop ? 226 : 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 14, marginTop: 4 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Timeline</SectionTitle>
          <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 3 }}>
            Your repertoire journey, piece by piece
          </Text>
        </View>

        {/* Status filter */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {['all', 'learning', 'consolidating', 'performance-ready'].map(s => {
            const active = filterStatus === s;
            const sc = STATUS_BAR_COLOURS[s] || {};
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)} activeOpacity={0.75}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
                  backgroundColor: active ? (sc.track || 'rgba(9,99,126,0.12)') : 'rgba(255,255,255,0.55)',
                  shadowColor: active ? (sc.fill || COLOURS.navy) : COLOURS.glassShadow,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: active ? 0.6 : 0.5,
                  shadowRadius: active ? 10 : 6,
                  elevation: active ? 4 : 1,
                }}>
                <Text style={{
                  fontFamily: active ? 'Lato-Bold' : 'Lato',
                  fontSize: 12,
                  color: active ? (sc.label || COLOURS.navy) : COLOURS.textMuted,
                }}>
                  {s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Chart */}
        <GlassCard>
          <TimelineChart
            compositions={filtered}
            sessions={sessions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </GlassCard>

        {/* Piece detail on tap */}
        {selectedComp && (
          <DetailPanel comp={selectedComp} sessions={sessions} />
        )}

        {/* Undated hint */}
        {undatedCount > 0 && (
          <View style={{
            marginTop: 12, padding: 12, borderRadius: RADIUS.md,
            backgroundColor: 'rgba(255,255,255,0.40)',
          }}>
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim }}>
              💡 {undatedCount} piece{undatedCount !== 1 ? 's' : ''} without a start date won't appear on the chart. Add a date started in the Pieces screen.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
