// Daily practice reminder (native only: browsers can't reliably schedule local notifications).
//
//   await setDailyReminder('18:00')   // schedule (asks for permission the first time)
//   await setDailyReminder('')        // turn off
//
// Always resolves to { ok: true } or { ok: false, reason } and never throws, so a notification
// problem can't break Settings. expo-notifications is loaded on demand so web builds and
// app start-up never touch it. The reminder has a fixed identifier, so turning it off (or
// changing the time) can only ever cancel this one notification.

import { Platform } from 'react-native';
import { parseReminderTime } from './planning';

const REMINDER_ID = 'musiclog-daily-reminder';
const CHANNEL_ID = 'reminders';

export async function setDailyReminder(time) {
  if (Platform.OS === 'web') return { ok: false, reason: 'Reminders are only available in the app.' };
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});

    const when = parseReminderTime(time);
    if (!when) return { ok: true };            // off

    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'Notifications are turned off for music.log in your device settings.' };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Practice reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: 'Time to practise', body: 'Even ten minutes counts.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: when.hour,
        minute: when.minute,
        channelId: CHANNEL_ID,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Could not schedule the reminder.' };
  }
}
