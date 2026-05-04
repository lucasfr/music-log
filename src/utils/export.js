import { Platform } from 'react-native';
import { fmtDate } from '../utils';

export async function exportSessionJSON(session, compositions) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || id;

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'Music.log',
    session: {
      date: session.date,
      energy: session.energy,
      duration_minutes: session.duration,
      wins: session.wins || null,
      tomorrow_focus: session.tomorrowFocus || null,
      segments: (session.segments || []).map(seg => ({
        type: seg.type,
        group: seg.group || null,
        piece: seg.compositionId ? compName(seg.compositionId) : (seg.title || null),
        section: seg.section || null,
        duration_minutes: seg.duration ? Number(seg.duration) : null,
        notes: seg.notes || null,
        challenge_tags: seg.challenges || [],
        progress_tags: seg.progress || [],
      })),
    },
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `musiclog-${session.date}.json`;

  if (Platform.OS === 'web') {
    // Web: trigger a file download
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native: write to cache then share
  const FileSystem = await import('expo-file-system');
  const Sharing    = await import('expo-sharing');

  const path = FileSystem.default.cacheDirectory + filename;
  await FileSystem.default.writeAsStringAsync(path, json, {
    encoding: FileSystem.default.EncodingType.UTF8,
  });

  const canShare = await Sharing.default.isAvailableAsync();
  if (canShare) {
    await Sharing.default.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: `Export session — ${fmtDate(session.date)}`,
      UTI: 'public.json',
    });
  }
}
