import { Platform } from 'react-native';
import { buildSessionPayload, buildAllPayload, parseImportJSON, planImport, describeImport } from './backup';

// The payloads and the import logic are in backup.js (pure, so tests/backup.test.mjs covers them).
// This file is the part that touches the device: saving a file, sharing it, the clipboard and the
// file picker. Re-exported so screens keep importing everything backup-related from here.
export { parseImportJSON, planImport, describeImport };

// ─── Download ─────────────────────────────────────────────────────────────────

export async function exportSessionJSON(session, compositions) {
  await downloadJSON(buildSessionPayload(session, compositions), `musiclog-${session.date}.json`);
}

export async function exportAllJSON(sessions, lessons, compositions) {
  await downloadJSON(buildAllPayload(sessions, lessons, compositions), `musiclog-export-${new Date().toISOString().slice(0, 10)}.json`);
}

// ─── Copy to clipboard ───────────────────────────────────────────────────────

export async function copySessionJSON(session, compositions) {
  await copyToClipboard(buildSessionPayload(session, compositions));
}

export async function copyAllJSON(sessions, lessons, compositions) {
  await copyToClipboard(buildAllPayload(sessions, lessons, compositions));
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

async function copyToClipboard(payload) {
  const json = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(json);
}

// ─── Import ───────────────────────────────────────────────────────────────────

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
