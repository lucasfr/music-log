// Smoke test for the built web app (dist/), run in a real browser.  Not part of `npm test`:
//
//   npm install --no-save --no-package-lock playwright
//   npx playwright install chromium
//   node tests/e2e/smoke.mjs [dist]
//
// CI runs it after the web build. It serves dist/ the way Netlify does (any path that is not a file
// gets index.html), opens the app on a phone-sized screen and checks the things that have broken
// without any unit test noticing: the app draws something and throws nothing, the manifest is a real
// manifest, the service worker is stamped and takes over, what is stored on the device survives a
// reload, and the app still opens with the network off.
//
// It deliberately does not click through screens: the checks are about the build and the shell
// around the app, which is where a wrong redirect, a missing file or a stale cache hides.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const dist = path.resolve(process.argv[2] || 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error(`No index.html in ${dist}. Run npm run build:web first.`); process.exit(2); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.map': 'application/json' };

// Like Netlify with the catch-all redirect in netlify.toml: a file that exists is served as it is, anything else is index.html.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    etag: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`,
  });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

const failures = [];
async function step(name, fn) {
  try { await fn(); console.log(`ok    ${name}`); } catch (e) { failures.push(name); console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText : '').trim());
const waitForApp = () => page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, { timeout: 30000 });

await step('the app opens and draws something', async () => {
  await page.goto(origin + '/', { waitUntil: 'load' });
  await waitForApp();
  assert(!/Something went wrong/.test(await bodyText()), 'the error boundary is showing: ' + (await bodyText()).slice(0, 200));
});

await step('the manifest is a real manifest with icons that load', async () => {
  const res = await page.request.get(origin + '/manifest.json');
  assert(res.status() === 200, `status ${res.status()}`);
  const text = await res.text();
  let m;
  try { m = JSON.parse(text); } catch { throw new Error('not JSON (a catch-all redirect answering with index.html?): ' + text.slice(0, 60)); }
  assert(m.name && m.start_url && Array.isArray(m.icons) && m.icons.length, 'name, start_url or icons missing');
  for (const icon of m.icons) {
    const r = await page.request.get(new URL(icon.src, origin).href);
    assert(r.status() === 200 && /image\/png/.test(r.headers()['content-type'] || ''), `icon ${icon.src} did not load as a PNG`);
  }
});

await step('the service worker takes over, with a stamped cache that holds the bundle', async () => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The bundle of the very first visit was fetched before the worker controlled the page, so it is
  // cached by the next load. That is why offline use needs a visit or two first.
  await page.reload({ waitUntil: 'load' });
  await waitForApp();
  await page.reload({ waitUntil: 'load' });
  await waitForApp();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  assert(controlled, 'the page is not controlled by the service worker after reloads');
  const names = await page.evaluate(() => caches.keys());
  assert(names.length === 1 && /^musiclog-[0-9a-f]{10}$/.test(names[0]), 'cache names are ' + JSON.stringify(names) + ', expected one stamped name');
  const cached = await page.evaluate(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname), names[0]);
  assert(cached.some(p => /\.js$/.test(p) && p !== '/service-worker.js'), 'no JavaScript bundle in the cache: ' + JSON.stringify(cached));
});

await step('something stored on the device is still there after a reload', async () => {
  const stored = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('musiclog');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('sessions')) { resolve('no sessions store'); return; }
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({ id: 'smoke-1', date: '2026-01-01', duration: 10, energy: 3, segments: [], updated_at: '2026-01-01T00:00:00.000Z' });
      tx.oncomplete = () => resolve('stored');
      tx.onerror = () => reject(tx.error);
    };
  }));
  assert(stored === 'stored', 'could not write to the app database: ' + stored);
  await page.reload({ waitUntil: 'load' });
  await waitForApp();
  assert(!/Something went wrong/.test(await bodyText()), 'the app failed to render with a stored session');
  const still = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('musiclog');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const get = open.result.transaction('sessions').objectStore('sessions').get('smoke-1');
      get.onsuccess = () => resolve(!!get.result);
      get.onerror = () => reject(get.error);
    };
  }));
  assert(still, 'the stored session was gone after the reload');
});

await step('the app opens with the network off', async () => {
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForApp();
    assert(!/Something went wrong/.test(await bodyText()), 'the error boundary is showing offline');
  } finally {
    await context.setOffline(false);
  }
});

await step('nothing threw in the page', async () => {
  assert(pageErrors.length === 0, 'uncaught errors: ' + pageErrors.join(' | ').slice(0, 400));
});

await browser.close();
server.close();
if (failures.length) { console.log(`\n${failures.length} smoke check(s) failed: ${failures.join('; ')}`); process.exit(1); }
console.log('\nSmoke test passed');
