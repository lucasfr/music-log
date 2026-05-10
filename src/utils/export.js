import { Platform } from 'react-native';

export async function exportSessionJSON(session, compositions) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || id;

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'music.log',
    session: {
      date:             session.date,
      duration_minutes: session.duration    ?? null,
      energy:           session.energy      ?? null,
      enjoyment:        session.enjoyment   ?? null,
      wins:             session.wins        || null,
      tomorrow_focus:   session.tomorrowFocus || null,
      segments: (session.segments || []).map(seg => ({
        type:             seg.type,
        group:            seg.group           || null,
        piece:            seg.compositionId ? compName(seg.compositionId) : (seg.title || null),
        section:          seg.section         || null,
        notes:            seg.notes           || null,
        difficulty:       seg.difficulty      ?? null,
        liking:           seg.liking          ?? null,
        scales:           seg.scales          || null,
        octaves:          seg.octaves         || null,
        teacher_feedback: seg.teacherFeedback || null,
        assignment:       seg.assignment      || null,
        challenge_tags:   seg.challenges      || [],
        progress_tags:    seg.progressTags    || [],
      })),
    },
  };

  await downloadJSON(payload, `musiclog-${session.date}.json`);
}

export async function exportAllJSON(sessions, lessons, compositions) {
  const compName = id => (compositions.find(c => c.id === id) || {}).title || id;

  const mapSegment = seg => ({
    type:             seg.type,
    group:            seg.group           || null,
    piece:            seg.compositionId ? compName(seg.compositionId) : (seg.title || seg.pieceName || null),
    section:          seg.section         || null,
    notes:            seg.notes           || null,
    difficulty:       seg.difficulty      ?? null,
    liking:           seg.liking          ?? null,
    scales:           seg.scales          || null,
    octaves:          seg.octaves         || null,
    teacher_feedback: seg.teacherFeedback || null,
    assignment:       seg.assignment      || null,
    challenge_tags:   seg.challenges      || [],
    progress_tags:    seg.progressTags    || [],
  });

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'music.log',
    sessions: [...sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        date:             s.date,
        duration_minutes: s.duration    ?? null,
        energy:           s.energy      ?? null,
        enjoyment:        s.enjoyment   ?? null,
        wins:             s.wins        || null,
        segments:         (s.segments   || []).map(mapSegment),
      })),
    lessons: [...lessons]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(l => ({
        date:             l.date,
        duration_minutes: l.duration    ?? null,
        teacher:          l.teacher     || null,
        wins:             l.wins        || null,
        segments:         (l.segments   || []).map(mapSegment),
      })),
    compositions: [...compositions]
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map(c => ({
        title:     c.title,
        composer:  c.composer  || null,
        status:    c.status    || null,
        keys:      c.keys      || [],
        time_sigs: c.timeSigs  || [],
        notes:     c.notes     || null,
      })),
  };

  await downloadJSON(payload, `musiclog-export-${new Date().toISOString().slice(0, 10)}.json`);
}

// ─── Shared download helper ───────────────────────────────────────────────────

async function downloadJSON(payload, filename) {
  const json = JSON.stringify(payload, null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing    = await import('expo-sharing');
  const path       = FileSystem.default.cacheDirectory + filename;

  await FileSystem.default.writeAsStringAsync(path, json, {
    encoding: FileSystem.default.EncodingType.UTF8,
  });

  const canShare = await Sharing.default.isAvailableAsync();
  if (canShare) {
    await Sharing.default.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: `Export — ${filename}`,
      UTI: 'public.json',
    });
  }
}
