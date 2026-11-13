// The smaller cards on Home: next up, this week, resume a timer, start practice and the backup reminder.
// Moved out of HomeScreen.js unchanged.

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../../theme';
import { Tap as TouchableOpacity, AnimatedFill } from '../../components/Motion';
import { Ionicons } from '../../components/Icon';
import { fmtDate } from '../../utils';
import { routineToPlan, planSummary, lastPracticedLine } from '../../utils/planning';
import { tint, accentKey } from '../../utils/tint';

// The "tomorrow's focus" you wrote in your last session, surfaced where you'll see it.
export function NextUpCard({ focus, date }) {
  return (
    <BlurView intensity={36} tint={COLOURS.blurTint} style={{
      borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 12, backgroundColor: COLOURS.entryWash,
      shadowColor: COLOURS.glowTeal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 5,
    }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12, backgroundColor: COLOURS.entryWash }}>
        <View style={{ width: 4, borderRadius: 2, backgroundColor: COLOURS.steel, alignSelf: 'stretch' }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{'🎯 Next up'}</Text>
          <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.cardTitle, color: COLOURS.text, lineHeight: 24 }}>{focus}</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 6 }}>from {fmtDate(date)}</Text>
        </View>
      </View>
    </BlurView>
  );
}

// Sessions, minutes and streak for the current Monday–Sunday week.
export function WeekStrip({ week, lastWeek, goal, streak }) {
  const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
  const mins = week.minutes >= 60 ? `${Math.floor(week.minutes / 60)}h ${week.minutes % 60}m` : `${week.minutes}m`;
  const stat = (value, label) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.display, color: COLOURS.navy, lineHeight: 28, fontVariant: ['lining-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 2 }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>This week</Text>
      {/* A plain card (not a blur): on web the blur sets its own background, which hid this in light mode. */}
      <View style={{
        borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5),
        shadowColor: COLOURS.shadow(0.08), shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 2,
      }}>
        {week.sessions === 0 ? (
          // An empty week is just a new one (it's Monday, or you've had a rest), so say that and show last week.
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: 'CormorantGaramond-Italic', fontSize: SIZES.body, color: COLOURS.textMuted, lineHeight: 22 }}>
              {lastWeek && lastWeek.sessions > 0
                ? `A fresh week. Last week: ${lastWeek.sessions} session${lastWeek.sessions === 1 ? '' : 's'}, ${lastWeek.minutes >= 60 ? `${Math.floor(lastWeek.minutes / 60)}h ${lastWeek.minutes % 60}m` : `${lastWeek.minutes}m`}.`
                : 'Your week starts here.'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 6 }}>
            {stat(week.sessions, week.sessions === 1 ? 'session' : 'sessions')}
            {stat(mins, 'practised')}
            {stat(streak, 'day streak')}
          </View>
        )}
        {goal ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: COLOURS.navyA(0.12), overflow: 'hidden' }}>
              <AnimatedFill fraction={goal.fraction} style={{ height: '100%', borderRadius: 3, backgroundColor: goal.reached ? COLOURS.success : COLOURS.steel }} />
            </View>
            <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 6 }}>
              {goal.reached
                ? `Weekly goal reached: ${fmtMin(goal.minutes)} of ${fmtMin(goal.goal)}`
                : `${fmtMin(goal.minutes)} of ${fmtMin(goal.goal)} · ${fmtMin(goal.remaining)} to go`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Shown when the app was closed (or reloaded) while a timer was running: offers it back from the
// last saved snapshot, rather than quietly losing the session. Resume carries on from the time
// that was saved (see utils/timerSnapshot.js).
export function ResumeTimerCard({ summary, onResume, onDiscard }) {
  return (
    <View style={{ marginBottom: 16, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5), padding: 14, borderWidth: 1, borderColor: COLOURS.navyA(0.25) }}>
      <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.sectionTitle, color: COLOURS.text }}>Pick up where you left off?</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2 }}>
        {`${summary.names}  ·  ${summary.used} of ${summary.planned} min  ·  ${summary.ago}`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TouchableOpacity onPress={onResume} activeOpacity={0.85} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Resume the timer"
          style={{ ...TOUCH_PILL, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLOURS.navy }}>
          <Ionicons name="play" size={18} color={COLOURS.onNavy} />
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.onNavy }}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDiscard} activeOpacity={0.8} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Discard the saved timer"
          style={{ ...TOUCH_PILL, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLOURS.w(0.5) }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.textMuted }}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const minutesOf = plan => plan.reduce((total, s) => total + (Number(s.plannedMinutes) || 0), 0);

// The way in to practising: the timer is how you practise, but it used to live inside the + menu.
// "Set up" opens the timer setup; the chips start a plan straight away (the last session's, or one
// of your saved routines).
export function StartPracticeCard({ repeatPlan, routines, compositions, lastSession, today, onSetup, onStartPlan }) {
  const shortcuts = [
    ...(repeatPlan.length > 0 ? [{
      key: 'repeat', title: 'Repeat last session', plan: repeatPlan, icon: 'repeat-outline',
      a11y: `Start the timer with your last session, ${minutesOf(repeatPlan)} minutes`,
    }] : []),
    ...routines.map(r => ({
      key: r.id, title: r.name, plan: routineToPlan(r, compositions), icon: 'musical-notes-outline',
      a11y: `Start the routine ${r.name}`,
    })),
  ];
  const subtitle = lastPracticedLine(lastSession, today) || 'Timed segments, with a metronome.';
  const many = shortcuts.length > 1;

  // Each shortcut has its own colour from the theme, on the icon, the border and the minutes, and says
  // what it will run (its pieces and exercises) as well as for how long.
  const tile = (s, i) => {
    const accent = COLOURS[accentKey(i)];
    const summary = planSummary(s.plan);
    return (
      <TouchableOpacity key={s.key} onPress={() => onStartPlan(s.plan)} activeOpacity={0.8} hitSlop={HIT_PILL}
        accessibilityRole="button" accessibilityLabel={s.a11y}
        style={{
          width: many ? 250 : undefined, flex: many ? undefined : 1,
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
          borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.45), borderWidth: 1, borderColor: tint(accent, 0.4),
        }}>
        <View style={{ width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(accent, 0.22) }}>
          <Ionicons name={s.icon} size={20} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{s.title}</Text>
          {summary ? <Text numberOfLines={1} style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginTop: 1 }}>{summary}</Text> : null}
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: tint(accent, 0.22) }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.labelSmall, color: COLOURS.text }}>{minutesOf(s.plan)} min</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{
      marginBottom: 16, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5), padding: 14,
      borderWidth: 1, borderColor: COLOURS.steelA(0.28),
      shadowColor: COLOURS.glowTeal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 4,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'CormorantGaramond', fontSize: SIZES.screenTitle, lineHeight: 32, color: COLOURS.text }}>Start practice</Text>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 4 }}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={onSetup} activeOpacity={0.85} hitSlop={HIT_PILL}
          accessibilityRole="button" accessibilityLabel="Set up a practice timer"
          style={{ alignItems: 'center', gap: 6 }}>
          <View style={{
            // design: ok optical centring of the play triangle (paddingLeft)
            width: 60, height: 60, borderRadius: 30, backgroundColor: COLOURS.steel, alignItems: 'center', justifyContent: 'center', paddingLeft: 3,
            shadowColor: COLOURS.glowTeal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 14, elevation: 6,
          }}>
            <Ionicons name="play" size={28} color={COLOURS.onNavy} />
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim }}>Set up</Text>
        </TouchableOpacity>
      </View>
      {shortcuts.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.labelSmall, color: COLOURS.textDim, marginBottom: 8 }}>Quick start</Text>
          {many ? (
            // Slides sideways, one tile at a time. It runs to the card's edges so the next tile peeks in.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled
              snapToInterval={260} snapToAlignment="start" decelerationRate="fast"
              style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
              {shortcuts.map(tile)}
            </ScrollView>
          ) : (
            <View style={{ flexDirection: 'row' }}>{shortcuts.map(tile)}</View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// A gentle reminder to export a copy, shown when it's been a while (or never).
export function BackupNudge({ due, onBackup, onLater }) {
  const pill = (label, onPress, primary) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={HIT_PILL}
      style={{ ...TOUCH_PILL, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: primary ? COLOURS.navy : COLOURS.navyA(0.10) }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: primary ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{
      marginBottom: 16, borderRadius: RADIUS.md, backgroundColor: COLOURS.w(0.5), padding: 14,
      shadowColor: COLOURS.glowTeal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 4,
    }}>
      <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.bodySmall, color: COLOURS.text }}>{due.never ? 'Back up your journal' : 'Time for a backup'}</Text>
      <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 2, lineHeight: 19 }}>
        {due.never
          ? `You've been logging for ${due.days} days and haven't exported a copy yet.`
          : `Your last backup was ${due.days} days ago.`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {pill('Back up now', onBackup, true)}
        {pill('Later', onLater, false)}
      </View>
    </View>
  );
}
