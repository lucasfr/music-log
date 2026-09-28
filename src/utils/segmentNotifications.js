import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Local scheduled notifications so a segment's end still surfaces if you've
// switched apps or the screen has locked. Native only for now — a browser
// tab backgrounds very differently (needs the existing service worker to
// cooperate), so this is deliberately scoped to iOS/Android.

let handlerConfigured = false;
function ensureHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('practice-timer', {
      name: 'Practice timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
  }
}

let permissionChecked = false;
async function ensurePermission() {
  if (permissionChecked) return;
  permissionChecked = true;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
  } catch (e) {
    // Permission dialog failing/being dismissed just means no notification
    // fires later — the on-screen timer still works either way.
  }
}

// Returns a notification id to later pass to cancelScheduledNotification,
// or null if scheduling wasn't possible (web, no permission, etc).
export async function scheduleSegmentEndNotification(segmentTitle, remainingMs) {
  if (Platform.OS === 'web' || remainingMs <= 0) return null;
  ensureHandler();
  await ensurePermission();
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Segment complete',
        body: segmentTitle ? `${segmentTitle} is done — back to music.log` : 'Time’s up — back to music.log',
        sound: true,
      },
      trigger: { seconds: Math.max(1, Math.round(remainingMs / 1000)), channelId: 'practice-timer' },
    });
  } catch (e) {
    return null;
  }
}

export async function cancelScheduledNotification(id) {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    // Already fired or already cancelled — fine either way.
  }
}
