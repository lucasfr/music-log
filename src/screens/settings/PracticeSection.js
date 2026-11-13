// Settings > Practice: weekly, monthly and yearly goals, rest days and (in the app) the daily reminder.
// Moved out of SettingsScreen.js unchanged.

import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Tap as TouchableOpacity } from '../../components/Motion';
import { COLOURS, RADIUS, SIZES, TOUCH_PILL, HIT_PILL } from '../../theme';
import { notify } from '../../utils/notify';
import { usePref } from '../../utils/usePref';
import { GOAL_OPTIONS, REMINDER_TIMES } from '../../utils/planning';
import { parseRestDays, toggleRestDay, serializeRestDays } from '../../utils/progress';
import { YEAR_GOAL_OPTIONS, MONTH_GOAL_OPTIONS } from '../../utils/goals';
import { setDailyReminder } from '../../utils/reminders';
import { GlassCard, SectionHeader } from './parts';

export function PracticeSection() {
  const [goalRaw, setGoalRaw] = usePref('weeklyGoalMin', '0');
  const [reminderTime, setReminderTime] = usePref('reminderTime', '');
  const [restRaw, setRestRaw] = usePref('restDays', '[]');
  const [monthGoalRaw, setMonthGoalRaw] = usePref('monthGoalHours', '0');
  const [yearGoalRaw, setYearGoalRaw] = usePref('yearGoalHours', '0');
  const restDays = parseRestDays(restRaw);
  const chooseReminder = async t => {
    const r = await setDailyReminder(t, restDays);
    if (r.ok) setReminderTime(t);
    else notify('Reminder not set', r.reason);
  };
  const chip = (key, label, active, onPress, a11y) => (
    <TouchableOpacity
      key={key} onPress={onPress} activeOpacity={0.75} hitSlop={HIT_PILL}
      accessibilityRole="radio" accessibilityLabel={a11y} accessibilityState={{ selected: active }}
      style={{ ...TOUCH_PILL, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: active ? COLOURS.navy : COLOURS.navyA(0.10) }}
    >
      <Text style={{ fontFamily: active ? 'Lato-Bold' : 'Lato', fontSize: SIZES.bodySmall, color: active ? COLOURS.onNavy : COLOURS.textMuted }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <SectionHeader>Practice</SectionHeader>
      <GlassCard>
        <View style={{ padding: 14 }}>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginBottom: 8 }}>Weekly goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GOAL_OPTIONS.map(g => chip(
              `g${g}`, g ? `${g / 60}h` : 'Off', Number(goalRaw) === g,
              () => setGoalRaw(String(g)),
              g ? `${g / 60} hours a week` : 'No weekly goal',
            ))}
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 10 }}>
            Shown on Home as progress through your week.
          </Text>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Monthly goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MONTH_GOAL_OPTIONS.map(g => chip(
              `m${g}`, g ? `${g}h` : 'Off', Number(monthGoalRaw) === g,
              () => setMonthGoalRaw(String(g)),
              g ? `${g} hours a month` : 'No monthly goal',
            ))}
          </View>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Yearly goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {YEAR_GOAL_OPTIONS.map(g => chip(
              `y${g}`, g ? `${g}h` : 'Off', Number(yearGoalRaw) === g,
              () => setYearGoalRaw(String(g)),
              g ? `${g} hours a year` : 'No yearly goal',
            ))}
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 10 }}>
            Shown on Home with whether you are ahead of, on, or behind an even pace.
          </Text>
          <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Rest days</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[['Mon', 1, 'Monday'], ['Tue', 2, 'Tuesday'], ['Wed', 3, 'Wednesday'], ['Thu', 4, 'Thursday'], ['Fri', 5, 'Friday'], ['Sat', 6, 'Saturday'], ['Sun', 0, 'Sunday']].map(([label, day, full]) => chip(
              `rest${day}`, label, restDays.includes(day),
              () => {
                const next = toggleRestDay(restDays, day);
                setRestRaw(serializeRestDays(next));
                // The daily reminder skips rest days, so it is scheduled again when they change.
                if (reminderTime && Platform.OS !== 'web') setDailyReminder(reminderTime, next);
              },
              `${full} is a rest day`,
            ))}
          </View>
          <Text style={{ fontFamily: 'Lato', fontSize: SIZES.label, color: COLOURS.textDim, marginTop: 10 }}>
            A day off doesn't break your streak. Practising on one still counts. The daily reminder skips them.
          </Text>
          {Platform.OS !== 'web' && (
            <>
              <Text style={{ fontFamily: 'Lato-Bold', fontSize: SIZES.label, color: COLOURS.text, marginTop: 18, marginBottom: 8 }}>Daily reminder</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['', ...REMINDER_TIMES].map(t => chip(
                  `r${t}`, t || 'Off', reminderTime === t,
                  () => chooseReminder(t),
                  t ? `Remind me at ${t}` : 'No daily reminder',
                ))}
              </View>
            </>
          )}
        </View>
      </GlassCard>
    </>
  );
}
