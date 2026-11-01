// Tests for what patch-dist.js adds to a web build (the manifest and the stamped service worker).
// Run with: npm test
//
// patch-dist.js is run for real, in a temporary folder laid out like the project, against a small
// stand-in for the index.html that `expo export` writes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const page = bundle => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" /></head><body><script src="/_expo/static/js/web/${bundle}.js"></script></body></html>`;

function build(indexHtml) {
  const dir = mkdtempSync(join(tmpdir(), 'mlog-build-'));
  for (const d of ['dist', 'web', 'assets']) mkdirSync(join(dir, d));
  copyFileSync(join(root, 'patch-dist.js'), join(dir, 'patch-dist.js'));
  copyFileSync(join(root, 'web', 'service-worker.js'), join(dir, 'web', 'service-worker.js'));
  copyFileSync(join(root, 'assets', 'icon.png'), join(dir, 'assets', 'icon.png'));
  writeFileSync(join(dir, 'dist', 'index.html'), indexHtml);
  execFileSync(process.execPath, ['patch-dist.js'], { cwd: dir, stdio: 'pipe' });
  return dir;
}

const read = (dir, f) => readFileSync(join(dir, 'dist', f), 'utf8');

test('the build writes a manifest that parses and describes an installable app', () => {
  const dir = build(page('app-aaa'));
  const m = JSON.parse(read(dir, 'manifest.json'));
  assert.equal(m.name, 'music.log');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  assert.ok(m.icons.some(i => parseInt(i.sizes, 10) >= 512), 'Chrome wants an icon of 512px or more');
  assert.match(read(dir, 'index.html'), /<link rel="manifest" href="\/manifest\.json"/, 'and the page links to it');
});

test('every icon the manifest names ends up in dist', () => {
  const dir = build(page('app-aaa'));
  const built = pkg.scripts['build:web'];
  for (const { src } of JSON.parse(read(dir, 'manifest.json')).icons) {
    const file = src.replace(/^\//, '');
    // patch-dist.js writes icon.png itself; the touch icons are copied by the build script
    assert.ok(existsSync(join(dir, 'dist', file)) || built.includes(`dist/${file}`), `${file} is neither written by patch-dist.js nor copied by build:web`);
  }
});

test('the service worker is stamped with the build and keeps no placeholder', () => {
  const dir = build(page('app-aaa'));
  const sw = read(dir, 'service-worker.js');
  assert.match(sw, /const CACHE = 'musiclog-[0-9a-f]{10}';/);
  assert.ok(!sw.includes('__BUILD_ID__'));
});

test('a new bundle gives a new cache name, an unchanged build gives the same one', () => {
  const name = html => /const CACHE = '([^']+)'/.exec(read(build(html), 'service-worker.js'))[1];
  assert.equal(name(page('app-aaa')), name(page('app-aaa')));
  assert.notEqual(name(page('app-aaa')), name(page('app-bbb')));
});

test('build:web no longer copies the unstamped worker over the stamped one', () => {
  assert.ok(!pkg.scripts['build:web'].includes('cp web/service-worker.js'));
  assert.ok(pkg.scripts['build:web'].includes('node patch-dist.js'));
});
