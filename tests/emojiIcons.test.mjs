// Tests for the emoji → icon mapping (src/utils/emojiIcons.js).  Run with: npm test
//
// Loaded from source as a data: module, like reorder.test.mjs, so no build step is needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = readFileSync(join(root, 'src/utils/emojiIcons.js'), 'utf8');
const { EMOJI_ICONS, hasEmoji, splitEmoji } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const VS16 = '\uFE0F';
const TINTS = new Set(['amber', 'gold', 'success', 'heart']);

// ── splitEmoji ───────────────────────────────────────────────────────────────────────

test('a string with no emoji comes back untouched', () => {
  assert.deepEqual(splitEmoji('Hanon No. 1'), ['Hanon No. 1']);
  assert.deepEqual(splitEmoji(''), ['']);
  assert.equal(hasEmoji('Hanon No. 1'), false);
});

test('an emoji becomes an icon piece and the text around it is kept in order', () => {
  const parts = splitEmoji('🎹 practice');
  assert.equal(parts.length, 2);
  assert.equal(parts[0].name, 'piano');
  assert.equal(parts[0].emoji, '🎹');
  assert.equal(parts[1], ' practice');
});

test('text before, between and after emoji is preserved', () => {
  const parts = splitEmoji('Energy ⚡ 3 · ❤️ 4 done');
  assert.deepEqual(parts.map(p => (typeof p === 'string' ? p : p.name)),
    ['Energy ', 'lightning-bolt', ' 3 · ', 'heart', ' 4 done']);
});

test('the emoji presentation selector (U+FE0F) makes no difference, and is swallowed', () => {
  for (const base of ['❤', '⏱']) {
    const plain = splitEmoji(base);
    const withVs = splitEmoji(base + VS16);
    assert.equal(plain.length, 1, `${base} alone is one icon`);
    assert.equal(withVs.length, 1, `${base}+VS16 is one icon, with no stray selector left behind`);
    assert.equal(plain[0].name, withVs[0].name);
  }
  assert.equal(splitEmoji('❤️ 4')[1], ' 4');
});

test('adjacent emoji each become their own icon', () => {
  const parts = splitEmoji('⚡⚡❤️');
  assert.deepEqual(parts.map(p => p.name), ['lightning-bolt', 'lightning-bolt', 'heart']);
});

test('emoji with no mapping, and typographic symbols, are left as text', () => {
  for (const s of ['🦄 unicorn', '♪ note', '❙❙ pause', '✕ close', '✓ done', '↻ repeat']) {
    assert.deepEqual(splitEmoji(s), [s], `${s} should not be converted`);
    assert.equal(hasEmoji(s), false);
  }
});

test('hasEmoji can be called repeatedly (no stateful regex surprises)', () => {
  for (let i = 0; i < 4; i++) {
    assert.equal(hasEmoji('⚡'), true);
    assert.equal(hasEmoji('plain'), false);
  }
});

test('stripping icons and re-inserting the emoji reproduces the original text', () => {
  for (const s of ['🎹 Log practice', '⏱ 15 min', 'Wins 🌟 and ✨ progress', '⭐⭐⭐']) {
    const rebuilt = splitEmoji(s).map(p => (typeof p === 'string' ? p : p.emoji)).join('');
    assert.equal(rebuilt, s.replaceAll(VS16, ''));
  }
});

// ── the registry itself ──────────────────────────────────────────────────────────────

test('every mapping has a Material icon name, and only known tints', () => {
  for (const [emoji, def] of Object.entries(EMOJI_ICONS)) {
    assert.match(def.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${emoji}: odd icon name ${def.name}`);
    if (def.tint) assert.ok(TINTS.has(def.tint), `${emoji}: unknown tint ${def.tint}`);
    assert.ok(!emoji.includes(VS16), `${emoji}: register the emoji without U+FE0F`);
  }
});

// ── nothing in the app uses an emoji that isn't mapped ───────────────────────────────

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

// Typographic symbols that look pictographic but are plain text characters (kept as text on purpose).
const TYPOGRAPHIC = new Set([...'✕✎✓✦❙♪♩↻◀▶']);
const PICTOGRAPHIC = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{23F0}-\u{23F3}]/gu;

function withoutComments(line) {
  return line.replace(/\{\/\*.*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/, '').replace(/^\s*\*.*$/, '');
}

test('every emoji used in the app has an icon mapping (add new ones to EMOJI_ICONS)', () => {
  const files = [...sourceFiles(join(root, 'src'))];
  if (existsSync(join(root, 'App.js'))) files.push(join(root, 'App.js'));
  const unmapped = [];
  for (const file of files) {
    if (file.endsWith('emojiIcons.js')) continue;                  // the registry itself
    readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
      for (const m of withoutComments(raw).matchAll(PICTOGRAPHIC)) {
        if (TYPOGRAPHIC.has(m[0]) || EMOJI_ICONS[m[0]]) continue;
        unmapped.push(`${file.replace(root + '/', '')}:${i + 1}  ${m[0]}  ${raw.trim().slice(0, 70)}`);
      }
    });
  }
  assert.deepEqual(unmapped, [], `emoji with no icon mapping:\n  ${unmapped.join('\n  ')}`);
});
