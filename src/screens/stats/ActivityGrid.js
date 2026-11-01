import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, SIZES } from '../../theme';
import { gridLayers, gridSelection } from '../../utils/statsCalc';
import { toggleFilter } from '../../utils/scaleStats';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { getLocalPref, setLocalPref, todayISO, localISO } from '../../utils';
import { TouchableYear, FilterRow } from './shared';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const GAP = 2;

function cellColor(duration) {
  if (!duration)      return null; // empty — handled by caller
  if (duration < 20)  return COLOURS.heat(0.25);
  if (duration < 40)  return COLOURS.heat(0.50);
  if (duration < 60)  return COLOURS.heat(0.75);
  return COLOURS.heatTop;
}

function buildYear(year, dateMap) {
  // Returns array of 12 months, each an array of weeks, each an array of 7 days (Mon–Sun)
  const todayStr = todayISO();
  const months = [];

  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const lastDay  = new Date(year, m + 1, 0);
    // offset so week starts on Monday
    const startOffset = (firstDay.getDay() + 6) % 7;
    const weeks = [];
    let week = Array(startOffset).fill(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, m, d);
      const iso  = localISO(date);
      const isFuture = iso > todayStr;
      week.push({ iso, duration: isFuture ? -1 : (dateMap[iso] || 0), isFuture });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push(weeks);
  }
  return months;
}

// The activity grid's two layers, as toggles: either, or both. With none on it shows both.
const GRID_LAYER_OPTIONS = [
  { key: 'practice', label: '🎹 Practice' },
  { key: 'lessons', label: '🎓 Lessons' },
];

export function ActivityGrid({ sessions, lessons, compositions }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [width, setWidth] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  // Which layers are switched on, remembered between visits. (This replaces an older single choice,
  // 'both' | 'practice' | 'lessons', which is read as the starting point if there is no saved list yet.)
  const [layersOn, setLayersOn] = useState(() => gridSelection(getLocalPref('activityGridLayers', ''), getLocalPref('activityGridMode', 'both')));
  function setLayers(next) {
    setLayersOn(next);
    setLocalPref('activityGridLayers', JSON.stringify(next));
  }
  const layers = gridLayers(layersOn);

  // Gate each dataset on the layers shown so the grid can isolate one type
  const dateMap = {};
  if (layers.practice) {
    sessions.forEach(s => {
      dateMap[s.date] = (dateMap[s.date] || 0) + (Number(s.duration) || 0);
    });
  }

  const lessonDates = layers.lessons ? new Set((lessons || []).map(l => l.date)) : new Set();

  const months = buildYear(year, dateMap);
  const todayStr = todayISO();

  // Months are sized by their widest case (6 weeks), so n months in a row need
  //   n * (6*cell + 5*GAP) + (n-1) * MONTH_GAP  of width.
  // Try one row of 12 first (wide screens); if that would make cells smaller than
  // MIN_CELL, wrap into 2 rows of 6, 3 rows of 4, or 4 rows of 3 instead.
  const MONTH_GAP = 6;
  const ROW_GAP   = 14;
  const MIN_CELL  = 9;
  const maxWeeks  = 6;
  const cellFor = n => Math.floor((width - (n - 1) * MONTH_GAP - n * 5 * GAP) / (n * maxWeeks));
  const perRow = width > 0 ? ([12, 6, 4, 3].find(n => cellFor(n) >= MIN_CELL) || 3) : 12;
  const wrapped = perRow < 12;
  const cell = width > 0 ? Math.max(4, cellFor(perRow)) : 11;
  // Wrapped rows use a fixed slot per month so the columns line up across rows
  const slotW = maxWeeks * (cell + GAP) - GAP;


  // The cells are small, so after tapping roughly the right day you can nudge it a
  // day at a time from the detail card instead of aiming at a 10px square.
  function stepDay(delta) {
    if (!selectedDay) return;
    const d = new Date(selectedDay + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const iso = localISO(d);
    if (iso > todayStr) return;
    setSelectedDay(iso);
    if (d.getFullYear() !== year) setYear(d.getFullYear());
  }

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* Layers: toggles, any number on, none on means both */}
      <FilterRow
        label="Show" options={GRID_LAYER_OPTIONS} selected={layersOn}
        onToggle={k => setLayers(toggleFilter(layersOn, k))} onClear={() => setLayers([])}
      />

      {/* Year picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.cardTitle, color: COLOURS.text, fontVariant: ['lining-nums'] }}>{year}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableYear onPress={() => { setYear(y => y - 1); setSelectedDay(null); }} icon="chevron-back" />
          <TouchableYear onPress={() => { setYear(y => y + 1); setSelectedDay(null); }} icon="chevron-forward" disabled={year >= currentYear} />
        </View>
      </View>

      {width > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: MONTH_GAP, rowGap: wrapped ? ROW_GAP : 0 }}>
          {months.map((weeks, mi) => {
            const monthW = weeks.length * (cell + GAP) - GAP;
            return (
              <View key={mi} style={{ width: wrapped ? slotW : monthW }}>
                {/* Month label */}
                <Text style={{
                  fontFamily: 'Lato-Bold', fontSize: Math.max(11, Math.min(13, cell)),
                  color: COLOURS.textDim, letterSpacing: 0.2,
                  marginBottom: 4, textAlign: 'center', width: monthW,
                }}>{MONTHS_SHORT[mi]}</Text>

                {/* Week columns */}
                <View style={{ flexDirection: 'row', gap: GAP }}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={{ gap: GAP }}>
                      {week.map((day, di) => {
                        if (!day) return <View key={di} style={{ width: cell, height: cell }} />;
                        const isLesson = lessonDates.has(day.iso);
                        const isToday = day.iso === todayStr;
                        const color = day.isFuture
                          ? COLOURS.futureCell
                          : isLesson
                            ? day.duration > 0
                              ? COLOURS.heatLesson(0.45 + Math.min(0.55, day.duration / 120))
                              : COLOURS.heatLesson(0.45)
                            : cellColor(day.duration) || COLOURS.emptyCell;
                        const isSel = selectedDay === day.iso;
                        return (
                          <TouchableOpacity key={di} disabled={day.isFuture} activeOpacity={0.6}
                            onPress={() => setSelectedDay(isSel ? null : day.iso)}
                            accessibilityRole="button"
                            accessibilityLabel={`${day.iso}${day.duration > 0 ? `, ${day.duration} minutes` : ''}`}
                            style={{
                              width: cell, height: cell,
                              borderRadius: Math.max(1, cell * 0.2),
                              backgroundColor: color,
                              borderWidth: isSel ? 2 : isToday ? 1 : 0,
                              borderColor: COLOURS.navy,
                            }} />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Selected day */}
      {selectedDay ? (() => {
        const daySessions = (sessions || []).filter(s => s.date === selectedDay);
        const dayLessons  = (lessons  || []).filter(l => l.date === selectedDay);
        const mins = daySessions.reduce((a, s) => a + (Number(s.duration) || 0), 0);
        const names = new Map((compositions || []).map(c => [c.id, c.title]));
        const pieces = [...new Set([...daySessions, ...dayLessons].flatMap(x =>
          (x.segments || []).map(seg => names.get(seg.compositionId) || seg.title || seg.group).filter(Boolean)))];
        const when = new Date(selectedDay + 'T12:00:00')
          .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        const parts = [];
        if (daySessions.length) parts.push(`${daySessions.length} session${daySessions.length !== 1 ? 's' : ''} · ${mins} min`);
        if (dayLessons.length)  parts.push(`${dayLessons.length} lesson${dayLessons.length !== 1 ? 's' : ''}`);
        return (
          <View style={{ marginTop: 12, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.55) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text, flex: 1 }}>{when}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableYear icon="chevron-back" label="Previous day" onPress={() => stepDay(-1)} />
                <TouchableYear icon="chevron-forward" label="Next day" onPress={() => stepDay(1)} disabled={selectedDay >= todayStr} />
              </View>
            </View>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textMuted, marginTop: 2 }}>
              {parts.length ? parts.join('   ') : 'Nothing logged'}
            </Text>
            {pieces.length ? (
              <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 4 }}>{pieces.join(' · ')}</Text>
            ) : null}
          </View>
        );
      })() : null}

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
        {layers.practice && (
          <>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginRight: 2 }}>Less</Text>
            {[0, 15, 35, 55, 75].map(d => (
              <View key={d} style={{
                width: cell, height: cell,
                borderRadius: Math.max(1, cell * 0.2),
                backgroundColor: d === 0 ? COLOURS.emptyCell : cellColor(d),
              }} />
            ))}
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginLeft: 2, marginRight: layers.lessons ? 8 : 0 }}>More</Text>
          </>
        )}
        {layers.lessons && (
          <>
            <View style={{ width: cell, height: cell, borderRadius: Math.max(1, cell * 0.2), backgroundColor: COLOURS.heatLesson(0.55) }} />
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Lesson</Text>
          </>
        )}
      </View>
    </View>
  );
}
