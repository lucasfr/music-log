// Practice reminders (native only: browsers can't reliably schedule local notifications).
//
//   await setDailyReminder('18:00')              // schedule every day (asks for permission the first time)
//   await setDailyReminder('18:00', [0])         // every day except Sunday (the rest days preference)
//   await setDailyReminder('')                   // turn off
//   await setLessonReminder('2026-11-10', today) // 18:00 the evening before a lesson ('' turns it off)
//
// Always resolves to { ok: true } or { ok: false, reason } and never throws, so a notification
// problem can't break Settings. expo-notifications is loaded on demand so web builds and
// app start-up never touch it. Every notification has a fixed identifier, so turning one off (or
// changing it) can only ever cancel its own. Which weekdays and when is worked out in reminderPlan.js.

import { Platform } from 'react-native';
import { parseReminderTime } from './planning';
import { reminderWeekdays, remindsEveryDay, expoWeekday, lessonReminderAt } from './reminderPlan';

const REMINDER_ID = 'musiclog-daily-reminder';
const WEEKDAY_IDS = [0, 1, 2, 3, 4, 5, 6].map(d => `${REMINDER_ID}-${d}`);
const LESSON_ID = 'musiclog-lesson-eve';
const CHANNEL_ID = 'reminders';

async function allowed(Notifications) {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'Notifications are turned off for music.log in your device settings.' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Practice reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return { ok: true };
}

export async function setDailyReminder(time, restDays = []) {
  if (Platform.OS === 'web') return { ok: false, reason: 'Reminders are only available in the app.' };
  try {
    const Notifications = await import('expo-notifications');
    // Cancel the single daily one and any per-weekday ones, whichever way it was scheduled before.
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    await Promise.all(WEEKDAY_IDS.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));

    const when = parseReminderTime(time);
    if (!when) return { ok: true };            // off

    const permission = await allowed(Notifications);
    if (!permission.ok) return permission;

    const content = { title: 'Time to practise', body: 'Even ten minutes counts.' };
    if (remindsEveryDay(restDays)) {
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: when.hour, minute: when.minute, channelId: CHANNEL_ID },
      });
    } else {
      // A rest day is simply a weekday with no reminder.
      for (const day of reminderWeekdays(restDays)) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${REMINDER_ID}-${day}`,
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(day), hour: when.hour, minute: when.minute, channelId: CHANNEL_ID },
        });
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Could not schedule the reminder.' };
  }
}

// The evening before a lesson, with a nudge to look at the summary and the questions list. A blank date, or one with
// nothing left to schedule, just cancels.
export async function setLessonReminder(lessonDate, today) {
  if (Platform.OS === 'web') return { ok: false, reason: 'Reminders are only available in the app.' };
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(LESSON_ID).catch(() => {});

    const at = lessonReminderAt(lessonDate, today, new Date().getHours());
    if (!at) return { ok: true };

    const permission = await allowed(Notifications);
    if (!permission.ok) return permission;

    const [y, m, d] = at.date.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: LESSON_ID,
      content: { title: 'Lesson tomorrow', body: 'Your summary and your questions for your teacher are ready on Home.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, d, at.hour, 0, 0), channelId: CHANNEL_ID },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Could not schedule the lesson reminder.' };
  }
}
