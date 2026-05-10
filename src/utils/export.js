import { Platform } from 'react-native';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

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

// ─── Import ───────────────────────────────────────────────────────────────────

// Parses a music.log export JSON and returns { sessions, lessons, compositions }
// ready to be saved via the existing hooks. Skips records that already exist
// (matched by id). Generates fresh IDs for records that don't have one.
export function parseImportJSON(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('Invalid JSON — could not parse file.');
  }

  if (!data || typeof data !== 'object') throw new Error('Unrecognised format.');

  const now = new Date().toISOString();

  const mapSegment = seg => ({
    id:              seg.id              || uuid(),
    type:            seg.type           || 'repertoire',
    group:           seg.group          || null,
    title:           seg.piece          || seg.title        || null,
    compositionId:   seg.compositionId  || null,
    section:         seg.section        || null,
    notes:           seg.notes          || null,
    difficulty:      seg.difficulty     ?? null,
    liking:          seg.liking         ?? null,
    scales:          seg.scales         || null,
    octaves:         seg.octaves        || null,
    teacherFeedback: seg.teacher_feedback || seg.teacherFeedback || null,
    assignment:      seg.assignment     || null,
    challenges:      seg.challenge_tags || seg.challenges    || [],
    progressTags:    seg.progress_tags  || seg.progressTags  || [],
  });

  const sessions = (data.sessions || []).map(s => ({
    id:         s.id        || uuid(),
    date:       s.date,
    duration:   s.duration_minutes ?? s.duration ?? null,
    energy:     s.energy    ?? null,
    enjoyment:  s.enjoyment ?? null,
    wins:       s.wins      || null,
    segments:   (s.segments || []).map(mapSegment),
    created_at: s.created_at || now,
    updated_at: s.updated_at || now,
  }));

  const lessons = (data.lessons || []).map(l => ({
    id:         l.id        || uuid(),
    date:       l.date,
    duration:   l.duration_minutes ?? l.duration ?? null,
    teacher:    l.teacher   || null,
    wins:       l.wins      || null,
    segments:   (l.segments || []).map(mapSegment),
    created_at: l.created_at || now,
    updated_at: l.updated_at || now,
  }));

  const compositions = (data.compositions || []).map(c => ({
    id:        c.id       || uuid(),
    title:     c.title,
    composer:  c.composer || null,
    status:    c.status   || null,
    keys:      c.keys     || [],
    timeSigs:  c.time_sigs || c.timeSigs || [],
    notes:     c.notes    || null,
    created_at: c.created_at || now,
    updated_at: c.updated_at || now,
  }));

  return { sessions, lessons, compositions };
}

// Picks a JSON file from disk (web only) and returns parsed content.
export function pickJSONFile() {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web') {
      reject(new Error('File picker not supported on this platform.'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) { reject(new Error('No file selected.')); return; }
      try {
        const text = await file.text();
        resolve(text);
      } catch {
        reject(new Error('Could not read file.'));
      }
    };
    input.click();
  });
}
