// Settings > Backup: export, copy and import everything as JSON. Moved out of SettingsScreen.js.
// One difference: a failed import used to show its message in the Supabase credentials card (the two
// shared one error state); it now shows in this card's own banner.

import React, { useState } from 'react';
import { usePref } from '../../utils/usePref';
import { notify } from '../../utils/notify';
import { setLocalPref, getLocalPref, fmtDate } from '../../utils';
import { exportAllJSON, copyAllJSON, parseImportJSON, planImport, describeImport, pickJSONFile } from '../../utils/export';
import { planPrefsRestore, describePrefsRestore } from '../../utils/prefsBackup';
import { GlassCard, SectionHeader, Row, ResultBanner, markBackedUp } from './parts';

export function BackupSection({ sessions, lessons, compositions, onSaveSession, onSaveLesson, onSaveComposition }) {
  const [importResult, setImportResult] = useState(null);
  const [lastBackup] = usePref('lastBackup', '');

  async function handleImport() {
    setImportResult(null);
    try {
      const json = await pickJSONFile();
      // Only what isn't already on this device is saved: a record with an id that is here is
      // skipped (unless the file's copy is newer), so importing a backup twice adds nothing.
      const parsed = parseImportJSON(json);
      const plan = planImport(parsed, { sessions, lessons, compositions });
      let errors = 0;
      // Pieces go first, so the segments that point at them are saved after them.
      for (const r of plan.compositions) { try { await onSaveComposition(r); } catch { errors++; } }
      for (const r of plan.sessions)     { try { await onSaveSession(r);     } catch { errors++; } }
      for (const r of plan.lessons)      { try { await onSaveLesson(r);      } catch { errors++; } }
      // Settings in the file (rest days, goals, grade target ...) are filled in only where this device has none,
      // so an older backup can't undo what you have set since.
      const prefsPlan = planPrefsRestore(parsed.prefs, getLocalPref);
      prefsPlan.forEach(p => setLocalPref(p.key, p.value));
      const summary = [describeImport(plan.stats), describePrefsRestore(prefsPlan)].filter(Boolean).join('; ');
      setImportResult({ errors, message: errors > 0 ? `${summary} · ${errors} failed to save` : summary });
    } catch (e) { setImportResult({ errors: 1, message: e.message || 'Import failed.' }); }
  }

  return (
    <>
      {/* Backup: always available (it used to appear only when signed in to sync) */}
      <SectionHeader>Backup</SectionHeader>
      <GlassCard>
        <Row icon="arrow-down-outline" label="Export all as JSON"
          sublabel={lastBackup ? `Last backup ${fmtDate(lastBackup)}` : 'Not backed up yet'}
          onPress={() => exportAllJSON(sessions, lessons, compositions).then(markBackedUp).catch(() => {})}
          first
        />
        <Row icon="copy-outline" label="Copy all as JSON"
          onPress={() =>
            copyAllJSON(sessions, lessons, compositions)
              .then(() => { markBackedUp(); notify('Copied', 'All data copied to clipboard.'); })
              .catch(() => {})
          }
        />
        <Row icon="arrow-up-outline" label="Import from JSON"
          onPress={handleImport}
          last
        />
        <ResultBanner result={importResult} />
      </GlassCard>
    </>
  );
}
