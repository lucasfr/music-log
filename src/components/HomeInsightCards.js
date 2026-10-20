// Cards for Home, all built from what is already in the log (see utils/insights.js):
//  - the assignments from your latest lesson, as a checklist;
//  - which scales and arpeggios to practise today;
//  - a summary of everything since your last lesson, to read or send;
//  - what you usually do at the energy you have today.
// Each renders nothing when there is nothing to show, so Home only adds a line for them.

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { Ionicons } from './Icon';
import { Tap as TouchableOpacity } from './Motion';
import { fmtDate } from '../utils';
import { usePref } from '../utils/usePref';
import { LessonBriefModal } from './LessonBriefModal';
import { ENERGY_LABELS } from '../constants';
import {
  lessonAssignments, setAssignmentDone, suggestScope, energyLinks, describeLink,
  suggestScales, parseTarget, lessonBrief,
} from '../utils/insights';

const ENERGY_LEVELS = [-2, -1, 0, 1, 2];

function Card({ title, subtitle, children }) {
  return (
    <View style={{
      borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5), padding: 16, marginBottom: 16,
      shadowColor: COLOURS.shadow(0.08), shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
    }}>
      <Text style={{ fontFamily: 'CormorantGaramond', fontSize: 20, color: COLOURS.text }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, marginTop: 2 }}>{subtitle}</Text> : null}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

// ─── Lesson assignments ──────────────────────────────────────────────────────

function LessonChecklist({ lessons, sessions, compositions, today, onSaveLesson }) {
  const { items, open, lessonDate } = useMemo(
    () => lessonAssignments(lessons, sessions, today, compositions),
    [lessons, sessions, today, compositions],
  );
  if (!items.length) return null;

  // A ticked item is un-ticked by tapping it again. One that is covered because you practised it
  // is evidence rather than a tick, so there is nothing to change.
  async function toggle(item) {
    if (item.status === 'covered') return;
    const lesson = (lessons || []).find(l => l.id === item.lessonId);
    if (!lesson) return;
    const ref = { segmentId: item.segmentId, segmentIndex: item.segmentIndex };
    await onSaveLesson(setAssignmentDone(lesson, ref, item.status !== 'done', today));
  }

  return (
    <Card title="From your lesson" subtitle={`${fmtDate(lessonDate)} \u00b7 ${open > 0 ? `${open} to do` : 'all done'}`}>
      {items.map(it => {
        const finished = it.status !== 'open';
        return (
          <TouchableOpacity
            key={`${it.lessonId}:${it.segmentId ?? it.segmentIndex}`}
            onPress={() => toggle(it)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: finished }}
            accessibilityLabel={`${it.label}: ${it.text}`}
            style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, minHeight: 44 }}
          >
            {finished
              ? <Ionicons name="checkmark-circle-outline" size={24} color={it.status === 'done' ? COLOURS.success : COLOURS.steel} />
              : <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLOURS.navyA(0.35) }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: finished ? COLOURS.textDim : COLOURS.text }}>{it.label}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 13, color: COLOURS.textDim, lineHeight: 18 }}>{it.text}</Text>
              {it.status === 'covered' ? (
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.steel, marginTop: 2 }}>Practised {fmtDate(it.coveredOn)}</Text>
              ) : null}
              {it.lessonDate !== lessonDate ? (
                <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 2 }}>From the lesson on {fmtDate(it.lessonDate)}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

// ─── Energy and scope ────────────────────────────────────────────────────────

function scopeText(s) {
  const level = ENERGY_LABELS[String(s.energy)].toLowerCase();
  let text = `${s.widened ? `On ${level} days, and the levels either side,` : `On ${level} days`} you usually play about ${s.minutes} min`;
  if (s.techniqueShare !== null) {
    const tech = Math.round(s.techniqueShare * 100);
    text += `, roughly ${tech}% technique and ${100 - tech}% pieces`;
  }
  if (s.avgEnjoyment !== null) text += `, and rate those sessions ${s.avgEnjoyment} out of 5`;
  return `${text}.`;
}

function EnergyScope({ sessions }) {
  const [energy, setEnergy] = useState(null);
  const scope = useMemo(() => (energy === null ? null : suggestScope(sessions, energy)), [sessions, energy]);
  const links = useMemo(() => energyLinks(sessions), [sessions]);
  if (!sessions.length) return null;

  const linkLines = [];
  if (links.enjoyment !== null) linkLines.push(`energy and enjoyment show ${describeLink(links.enjoyment, 'enjoyment')}`);
  if (links.minutes !== null) linkLines.push(`energy and session length show ${describeLink(links.minutes, 'length')}`);

  return (
    <Card title="How much energy have you got?" subtitle="See what you usually do on days like this">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ENERGY_LEVELS.map(level => {
          const active = energy === level;
          const label = ENERGY_LABELS[String(level)];
          return (
            <TouchableOpacity
              key={level}
              onPress={() => setEnergy(active ? null : level)}
              activeOpacity={0.75}
              hitSlop={HIT_PILL}
              accessibilityRole="radio"
              accessibilityLabel={`Energy: ${label}`}
              accessibilityState={{ selected: active }}
              style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10) }}
            >
              <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: 14, color: active ? '#fff' : COLOURS.textMuted }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {scope ? (
        <View style={{ marginTop: 12 }}>
          {scope.enough ? (
            <>
              <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 17, color: COLOURS.text, lineHeight: 24 }}>{scopeText(scope)}</Text>
              <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 6 }}>
                Based on {scope.n} of your sessions. It is what you have done before, not a target.
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.textDim, lineHeight: 22 }}>
              Not enough sessions at this energy yet ({scope.n} so far; it needs 3). Keep logging energy and this fills in.
            </Text>
          )}
        </View>
      ) : null}

      {linkLines.length ? (
        <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 10, lineHeight: 17 }}>
          Across {links.n} sessions, {linkLines.join('; ')}.
        </Text>
      ) : null}
    </Card>
  );
}

// ─── Scales for today ────────────────────────────────────
// From your grade target if you have set one: what you have never practised, then what has been
// left longest. Otherwise the scales you used to play and have let slip.

const SCALE_STATUS_COLOUR = { never: COLOURS.red, stale: COLOURS.amber, recent: COLOURS.steel };

function TodaysScales({ sessions, today }) {
  const [targetRaw] = usePref('gradeTarget', '');
  const target = useMemo(() => parseTarget(targetRaw), [targetRaw]);
  const items = useMemo(() => suggestScales(target, sessions, today), [target, sessions, today]);
  if (!items.length) return null;
  const fromTarget = items.some(x => x.fromTarget);
  return (
    <Card title="Scales for today" subtitle={fromTarget ? 'From your grade target, the ones that need it most' : 'Ones you have let slip'}>
      {items.map(x => (
        <View
          key={`${x.group}|${x.label}`}
          accessible
          accessibilityLabel={`${x.label}, ${x.reason}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
        >
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: SCALE_STATUS_COLOUR[x.status] }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: 16, color: COLOURS.text }}>{x.label}</Text>
            <Text style={{ fontFamily: 'Lato', fontSize: 12, color: COLOURS.textDim, marginTop: 1 }}>
              {x.group === 'Arpeggios' ? 'Arpeggio' : 'Scale'} {'\u00b7'} {x.reason}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

// ─── Lesson summary ───────────────────────────────────────────────
// Everything since the last lesson, on one screen that can be copied or shared.

const minutesText = m => {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)}h ${r % 60}m` : `${r}m`;
};

function LessonBriefCard({ lessons, sessions, compositions, today }) {
  const [open, setOpen] = useState(false);
  const brief = useMemo(() => lessonBrief(lessons, sessions, compositions, today), [lessons, sessions, compositions, today]);
  if (!brief.totals.sessions && !brief.period.hasLesson) return null;

  const { totals, runThroughs, period } = brief;
  const when = period.hasLesson ? `Since your lesson on ${fmtDate(period.since)}` : 'Over the last 4 weeks';
  const what = totals.sessions === 0
    ? 'No practice logged yet.'
    : `${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}, ${minutesText(totals.minutes)}${runThroughs ? `, ${runThroughs} ${runThroughs === 1 ? 'run-through' : 'run-throughs'}` : ''}.`;

  return (
    <Card title="Lesson summary" subtitle={when}>
      <Text style={{ fontFamily: 'Lato', fontSize: 14, color: COLOURS.text, lineHeight: 20 }}>{what}</Text>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => setOpen(true)} activeOpacity={0.75} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Open the lesson summary"
          style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}
        >
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: 14, color: '#fff' }}>Open summary</Text>
        </TouchableOpacity>
      </View>
      <LessonBriefModal visible={open} brief={brief} onClose={() => setOpen(false)} />
    </Card>
  );
}

export function HomeInsightCards({ sessions, lessons, compositions, today, onSaveLesson }) {
  return (
    <>
      <LessonChecklist lessons={lessons} sessions={sessions} compositions={compositions} today={today} onSaveLesson={onSaveLesson} />
      <TodaysScales sessions={sessions} today={today} />
      <LessonBriefCard lessons={lessons} sessions={sessions} compositions={compositions} today={today} />
      <EnergyScope sessions={sessions} />
    </>
  );
}
