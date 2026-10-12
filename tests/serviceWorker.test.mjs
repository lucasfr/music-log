// Tests for the service worker's update detection (web/service-worker.js).  Run with: npm test
//
// The real worker file is run in a sandbox (node:vm) with a fake cache, network and clients.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, '../web/service-worker.js'), 'utf8');

const response = (etag, { status = 200, type = 'basic', lastModified } = {}) => ({
  status, type,
  headers: { get: k => ({ etag, 'last-modified': lastModified })[k.toLowerCase()] ?? null },
  clone() { return this; },
});

// Load the worker into a fresh sandbox. `cached` is what the cache holds; `network` is a
// function returning the (promise of a) network response.
function boot({ cached, network }) {
  const handlers = {};
  const posted = [];
  const puts = [];
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting() {},
    clients: {
      claim() {},
      matchAll: async () => [{ postMessage: m => posted.push(m) }],
    },
  };
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async (...a) => { puts.push(a); } }),
    match: async () => cached,
    keys: async () => [],
    delete: async () => true,
  };
  vm.runInNewContext(code, { self, caches, fetch: network, Promise, console });
  return { handlers, posted, puts };
}

// Fire a fetch event and let everything it started finish.
async function doFetch(world, request) {
  const waits = [];
  let answer;
  world.handlers.fetch({
    request,
    respondWith: p => { answer = p; },
    waitUntil: p => { waits.push(p); },
  });
  const res = request.method && request.method !== 'GET' ? undefined : await answer;
  // waitUntil promises may themselves add more (the update message), so drain until none are left
  for (let i = 0; i < waits.length; i++) await waits[i];
  return res;
}

const nav = { method: 'GET', mode: 'navigate', url: '/' };
const asset = { method: 'GET', mode: 'no-cors', url: '/static/app.js' };

test('a changed page (different ETag) tells the open page there is an update', async () => {
  const w = boot({ cached: response('"old"'), network: async () => response('"new"') });
  const res = await doFetch(w, nav);
  assert.equal(res.headers.get('etag'), '"old"', 'the page is still served from the cache, instantly');
  assert.deepEqual(JSON.parse(JSON.stringify(w.posted)), [{ type: 'update-available' }]); // (plain-data compare: the message is built inside the sandbox)
  assert.equal(w.puts.length, 1, 'and the new copy is stored for next time');
});

test('an unchanged page stays quiet', async () => {
  const w = boot({ cached: response('"same"'), network: async () => response('"same"') });
  await doFetch(w, nav);
  assert.deepEqual(w.posted, []);
});

test('Last-Modified is used when there is no ETag', async () => {
  const w = boot({
    cached: response(null, { lastModified: 'Mon, 05 Oct 2026 10:00:00 GMT' }),
    network: async () => response(null, { lastModified: 'Tue, 06 Oct 2026 10:00:00 GMT' }),
  });
  await doFetch(w, nav);
  assert.equal(w.posted.length, 1);
});

test('assets changing (hashed bundles, images) do not prompt, only the page itself does', async () => {
  const w = boot({ cached: response('"a"'), network: async () => response('"b"') });
  await doFetch(w, asset);
  assert.deepEqual(w.posted, []);
});

test('the first ever visit (nothing cached) does not prompt', async () => {
  const w = boot({ cached: undefined, network: async () => response('"new"') });
  await doFetch(w, nav);
  assert.deepEqual(w.posted, []);
});

test('no way to compare (no ETag or Last-Modified) means no false alarm', async () => {
  const w = boot({ cached: response(null), network: async () => response(null) });
  await doFetch(w, nav);
  assert.deepEqual(w.posted, []);
});

test('offline: the cached page is served and nothing throws or prompts', async () => {
  const w = boot({ cached: response('"old"'), network: async () => { throw new Error('offline'); } });
  const res = await doFetch(w, nav);
  assert.equal(res.headers.get('etag'), '"old"');
  assert.deepEqual(w.posted, []);
});

test('error responses are not cached and never prompt', async () => {
  const w = boot({ cached: response('"old"'), network: async () => response('"new"', { status: 500 }) });
  await doFetch(w, nav);
  assert.deepEqual(w.posted, []);
  assert.equal(w.puts.length, 0);
});

test('non-GET requests are left alone', async () => {
  const w = boot({ cached: response('"a"'), network: async () => response('"b"') });
  const events = [];
  w.handlers.fetch({ request: { method: 'POST', mode: 'cors' }, respondWith: () => events.push('responded'), waitUntil: () => {} });
  assert.deepEqual(events, [], 'the worker does not answer POSTs');
});
