import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayPlan } from '../src/utils/insights.js';
import { dueFromMemory } from '../src/utils/memory.js';
import { performancePlanNudge } from '../src/utils/performancePlan.js';

const TODAY = '2026-11-01';
const piece = (id, title, extra = {}) => ({ id, title, status: 'performance-ready', ...extra });
const ids = () => { let n = 0; return () => `seg${n++}`; };
// The plan is given the memory and performance logic by its caller (insights.js has no imports), as Home does.
const plan = (compositions, opts = {}, sessions = []) => buildTodayPlan(null, sessions, [], compositions, TODAY, {
  makeId: ids(), memoryDue: dueFromMemory(compositions, TODAY), performanceNudge: performancePlanNudge, ...opts,
});
const titles = p => p.items.filter(i => i.kind === 'piece').map(i => i.title);

test('dueFromMemory: only memorised pieces 14 or more days since a run, longest-waiting first, shelved left out', () => {
  const list = dueFromMemory([
    piece('a', 'Alpha', { memorised: true, lastFromMemory: '2026-10-10' }),            // 22 days
    piece('b', 'Beta', { memorised: true, lastFromMemory: '2026-10-25' }),             // 7 days: not due
    piece('c', 'Gamma', { memorised: true, lastFromMemory: '2026-10-01' }),            // 31 days
    piece('d', 'Delta', { memorised: true, lastFromMemory: '2026-09-01', status: 'shelved' }),
    piece('e', 'Epsilon'),                                                              // not memorised
    piece('f', 'Zeta', { memorised: true }),                                            // never played from memory: nothing to be late against
  ], TODAY);
  assert.deepEqual(list.map(x => x.id), ['c', 'a']);
  assert.deepEqual(list.map(x => x.daysSince), [31, 22]);
  assert.deepEqual(dueFromMemory(undefined, TODAY), []);
});

test('a performance-ready memorised piece that is due appears in the plan, with the reason', () => {
  const p = plan([piece('a', 'Sonatina', { memorised: true, lastFromMemory: '2026-10-10' })]);
  assert.deepEqual(titles(p), ['Sonatina']);
  assert.match(p.items[0].reason, /not played from memory for 22 days/);
});

test('a memorised piece that is not due, or not memorised, does not get in just for that', () => {
  const p = plan([
    piece('a', 'Fresh', { memorised: true, lastFromMemory: '2026-10-30' }),
    piece('b', 'Plain'),
  ]);
  assert.deepEqual(titles(p), []);
});

test('being due from memory outranks a piece that is merely in rotation', () => {
  const comps = [
    { id: 'l', title: 'Learning', status: 'learning' },
    piece('m', 'Memorised', { memorised: true, lastFromMemory: '2026-10-01' }),
  ];
  const p = plan(comps);
  assert.equal(p.items[0].title, 'Memorised');
});

test('a piece flagged in the mock exam is planned, even though it is performance-ready', () => {
  const p = plan([piece('a', 'Prelude'), piece('b', 'Other')], { mockFlags: [{ kind: 'piece', label: 'Prelude' }] });
  assert.deepEqual(titles(p), ['Prelude']);
  assert.equal(p.items[0].reason, 'flagged in your mock exam');
});

test('the mock flag matches the title regardless of case and spaces', () => {
  const p = plan([piece('a', 'Prelude in C')], { mockFlags: [{ kind: 'piece', label: '  prelude IN c ' }] });
  assert.deepEqual(titles(p), ['Prelude in C']);
});

test('flagged scales and arpeggios make a warm-up first, saying so', () => {
  const p = plan([{ id: 'l', title: 'Learning', status: 'learning' }], { mockFlags: [{ kind: 'scale', label: 'Bb major, 2 oct' }, { kind: 'arpeggio', label: 'G minor, 2 oct' }] });
  assert.equal(p.items[0].kind, 'scales');
  assert.equal(p.items[0].title, 'Scales');
  assert.equal(p.items[0].reason, 'mock exam: Bb major, 2 oct, G minor, 2 oct');
  assert.equal(p.segments[0].type, 'technique');
  assert.equal(p.segments[0].title, 'Scales');
});

test('only arpeggios flagged: the warm-up is called Arpeggios', () => {
  const p = plan([], { mockFlags: [{ kind: 'arpeggio', label: 'A minor, 2 oct' }] });
  assert.equal(p.items[0].title, 'Arpeggios');
});

test('sight-reading flags and junk flags change nothing', () => {
  const base = plan([{ id: 'l', title: 'Learning', status: 'learning' }]);
  const flagged = plan([{ id: 'l', title: 'Learning', status: 'learning' }], { mockFlags: [{ kind: 'sight', label: 'Sight-reading' }, null, {}, { kind: 'piece' }, 'x'] });
  assert.deepEqual(flagged.items, base.items);
  const notAList = plan([{ id: 'l', title: 'Learning', status: 'learning' }], { mockFlags: 'nope' });
  assert.deepEqual(notAList.items, base.items);
});

test('with no flags and no memorised pieces the plan is exactly what it was before', () => {
  const comps = [{ id: 'l', title: 'Learning', status: 'learning' }, { id: 'c', title: 'Cons', status: 'consolidating' }, piece('p', 'Done')];
  const a = plan(comps);
  const b = plan(comps, { mockFlags: [] });
  assert.deepEqual(a.items, b.items);
  assert.deepEqual(titles(a).sort(), ['Cons', 'Learning']);
});

test('without the memory and performance inputs the plan ignores them (the caller supplies them)', () => {
  const comps = [piece('a', 'Sonatina', { memorised: true, lastFromMemory: '2026-10-10', performDate: '2026-11-10', performFrom: '2026-10-01' })];
  const bare = buildTodayPlan(null, [], [], comps, TODAY, { makeId: ids() });
  assert.deepEqual(titles(bare), []);
  assert.deepEqual(titles(plan(comps)), ['Sonatina']);
});

test('a piece behind for its performance is planned, with the reason', () => {
  const comps = [{ id: 'a', title: 'Prelude', status: 'new', performDate: '2026-11-20', performFrom: '2026-10-20' }];
  const p = plan(comps);
  assert.deepEqual(titles(p), ['Prelude']);
  assert.equal(p.items[0].reason, 'behind for your performance on 20 Nov');
});

test('a performance two weeks off is planned, a distant on-schedule one is not', () => {
  const near = [{ id: 'a', title: 'Near', status: 'consolidating', performDate: '2026-11-10', performFrom: '2026-10-30' }];
  assert.match(plan(near).items[0].reason, /performance in 9 days|behind for your performance/);
  const far = [{ id: 'b', title: 'Far', status: 'performance-ready', memorised: true, performDate: '2027-03-01', performFrom: '2026-10-30' }];
  assert.deepEqual(titles(plan(far)), []);
});

test('a performance date that has passed does not plan the piece', () => {
  const old = [{ id: 'a', title: 'Old', status: 'new', performDate: '2026-10-01', performFrom: '2026-09-01' }];
  assert.deepEqual(titles(plan(old)), []);
});
