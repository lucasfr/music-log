// Two cards for Home, both built from what is already in the log (see utils/insights.js):
//  - the assignments from your latest lesson, as a checklist;
//  - what you usually do at the energy you have today.
// Each renders nothing when there is nothing to show, so Home only adds a line for them.

import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { COLOURS, RADIUS, TOUCH_PILL, HIT_PILL } from '../theme';
import { Ionicons } from './Icon';
import { Tap as TouchableOpacity } from './Motion';
import { fmtDate } from '../utils';
import { ENERGY_LABELS } from '../constants';
import { lessonAssignments, setAssignmentDone, suggestScope, energyLinks, describeLink } from '../utils/insights';

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

export function HomeInsightCards({ sessions, lessons, compositions, today, onSaveLesson }) {
  return (
    <>
      <LessonChecklist lessons={lessons} sessions={sessions} compositions={compositions} today={today} onSaveLesson={onSaveLesson} />
      <EnergyScope sessions={sessions} />
    </>
  );
}
