import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllSessions, saveSession } from './index';
import { pushRecord } from './sync';
import { TECH_GROUPS } from '../constants';

const FLAG_KEY = 'migration_technique_group_backfill_v1';

const flagStorage = Platform.OS === 'web'
  ? (typeof localStorage !== 'undefined' ? localStorage : null)
  : AsyncStorage;

// One-time fix for a bug where finishing a timed practice session stored
// the chosen technique group in segment.title instead of segment.group —
// SegmentEditor's group pills, the Technique Breakdown stat, and the
// Home-screen entry tags all read .group specifically, so any session
// logged this way silently had no technique group anywhere it's actually
// used, even though the data was visible in the title field.
//
// Backfills group from title wherever title is empty... no — wherever
// group is empty and title exactly matches a known TECH_GROUPS value, then
// re-saves (and re-pushes to sync, if configured) any session it touched.
// Guarded by a stored flag so this only ever runs once per device.
export async function backfillTechniqueGroups() {
  try {
    if (flagStorage) {
      const already = await flagStorage.getItem(FLAG_KEY);
      if (already) return;
    }

    const sessions = await getAllSessions();
    let touched = 0;

    for (const session of sessions) {
      const segments = session.segments || [];
      let changed = false;
      const fixedSegments = segments.map(seg => {
        if (seg.type === 'technique' && !seg.group && seg.title && TECH_GROUPS.includes(seg.title)) {
          changed = true;
          return { ...seg, group: seg.title, title: '' };
        }
        return seg;
      });
      if (changed) {
        touched++;
        const record = { ...session, segments: fixedSegments, updated_at: new Date().toISOString() };
        await saveSession(record);
        pushRecord('sessions', record).catch(() => {});
      }
    }

    if (flagStorage) await flagStorage.setItem(FLAG_KEY, '1');
    if (touched > 0) {
      console.log(`[migration] backfilled technique group on ${touched} session(s)`);
    }
  } catch (e) {
    console.warn('[migration] backfillTechniqueGroups failed:', e);
  }
}
