// Tests for the Ionicons → MDI icon table (src/utils/iconMap.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = readFileSync(join(root, 'src/utils/iconMap.js'), 'utf8');
const { IONICON_TO_MDI } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test('every entry maps a kebab-case Ionicons name to a kebab-case MDI name', () => {
  for (const [from, to] of Object.entries(IONICON_TO_MDI)) {
    assert.match(from, NAME, `odd Ionicons name: ${from}`);
    assert.match(to, NAME, `odd MDI name for ${from}: ${to}`);
  }
});

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.js$/.test(name)) out.push(p);
  }
  return out;
}

// MDI names used directly in the source (the shim accepts these as they are).
const MDI_DIRECT = new Set(['history']);

test('every static icon name used in the app is mapped (or is a direct MDI name)', () => {
  const used = new Map();
  const patterns = [
    /<Ionicons[^>]*\bname\s*=\s*["']([a-z0-9-]+)["']/g,      // <Ionicons name="home" />
    /\bicon\s*=\s*["']([a-z0-9-]+)["']/g,                     // <Field icon="calendar-outline" />
    /\bicon(?:Out)?\s*:\s*['"]([a-z0-9-]+)['"]/g,            // { icon: 'home', iconOut: 'home-outline' }
    /\b(?:active|inactive)\s*:\s*['"]([a-z0-9-]+)['"]/g,     // tab bar definitions
  ];
  for (const file of sourceFiles(join(root, 'src'))) {
    if (file.endsWith('iconMap.js') || file.endsWith('emojiIcons.js')) continue;
    const text = readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        // `name:` / `icon:` keys also appear for non-icons (e.g. route names); only consider
        // names that look like an icon: contain a hyphen, or are one of the bare Ionicons names
        const n = m[1];
        if (!n.includes('-') && !['home', 'calendar', 'settings', 'time', 'ellipse'].includes(n)) continue;
        used.set(n, file.replace(root + '/', ''));
      }
    }
  }
  const missing = [...used].filter(([n]) => !IONICON_TO_MDI[n] && !MDI_DIRECT.has(n));
  assert.deepEqual(missing, [], `icon names with no MDI mapping:\n  ${missing.map(([n, f]) => `${n}  (${f})`).join('\n  ')}`);
});
