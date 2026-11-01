import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSections, addSection, removeSection, setSectionStage, cycleSection, weakestSection, pieceStageFromSections,
  describeSections, STAGE_LABELS, MAX_STAGE,
} from '../src/utils/sections.js';
import { stagesDone, performanceProgress } from '../src/utils/performancePlan.js';

let n = 0;
const id = () => `sec-${n++}`;
const three = () => addSection(addSection(addSection([], 'A', id), 'Bars 17-32', id), 'Coda', id);

test('a new section starts at stage 0; blank, repeated (any case or spacing) and over-long names are handled', () => {
  const list = addSection([], '  Intro  ', id);
  assert.deepEqual(list.map(s => [s.name, s.stage]), [['Intro', 0]]);
  assert.equal(addSection(list, '', id).length, 1);
  assert.equal(addSection(list, '   ', id).length, 1);
  assert.equal(addSection(list, 'intro', id).length, 1);
  assert.equal(addSection(list, 'INTRO  ', id).length, 1);
  assert.equal(addSection([], 'x'.repeat(100), id)[0].name.length, 40);
});

test('the list is capped at 24 sections', () => {
  let list = [];
  for (let i = 0; i < 30; i++) list = addSection(list, `Part ${i}`, id);
  assert.equal(list.length, 24);
});

test('setting, cycling and removing change only the one section', () => {
  const list = three();
  const [a, b] = list;
  assert.equal(setSectionStage(list, b.id, 3)[1].stage, 3);
  assert.equal(setSectionStage(list, b.id, 3)[0].stage, 0);
  assert.equal(setSectionStage(list, b.id, 99)[1].stage, MAX_STAGE);
  assert.equal(setSectionStage(list, b.id, -4)[1].stage, 0);
  assert.equal(setSectionStage(list, b.id, 'x')[1].stage, 0);
  assert.equal(cycleSection(list, a.id)[0].stage, 1);
  let cycled = list;
  for (let i = 0; i < 5; i++) cycled = cycleSection(cycled, a.id);
  assert.equal(cycled[0].stage, 0);                                    // after memorised it goes round to not started
  assert.equal(removeSection(list, b.id).length, 2);
  assert.deepEqual(setSectionStage(list, 'nope', 2), list);
});

test('weakest section: the lowest stage, the first if level, null with none', () => {
  let list = three();
  list = setSectionStage(setSectionStage(list, list[0].id, 3), list[1].id, 2);
  assert.equal(weakestSection(list).name, 'Coda');
  assert.equal(weakestSection(three()).name, 'A');
  assert.equal(weakestSection([]), null);
  assert.equal(weakestSection(undefined), null);
  assert.equal(pieceStageFromSections(list), 0);
  assert.equal(pieceStageFromSections([]), null);
});

test('describeSections', () => {
  assert.equal(describeSections([]), '');
  assert.equal(describeSections(three()), 'All 3 sections are at "not started".');
  let list = three();
  list = setSectionStage(setSectionStage(list, list[0].id, 3), list[1].id, 3);
  assert.equal(describeSections(list), '2 of 3 sections at "up to tempo". Holding it back: Coda (not started).');
  assert.equal(describeSections(addSection([], 'Only', id)), 'All 1 section is at "not started".');
  assert.equal(STAGE_LABELS.length, MAX_STAGE + 1);
});

test('stored sections are cleaned: junk dropped, stages clamped, duplicates removed', () => {
  const cleaned = parseSections([
    { id: 'a', name: 'A', stage: 2 }, { name: 'A', stage: 4 }, { name: '', stage: 1 }, null, 'x',
    { id: 'c', name: 'C', stage: 9 }, { id: 'd', name: 'D', stage: 'two' }, { name: 'E' },
  ]);
  assert.deepEqual(cleaned.map(s => [s.name, s.stage]), [['A', 2], ['C', 4], ['D', 0], ['E', 0]]);
  assert.deepEqual(parseSections('nope'), []);
  assert.deepEqual(parseSections(undefined), []);
});

test('nothing here changes the list it was given', () => {
  const list = Object.freeze([Object.freeze({ id: 'a', name: 'A', stage: 1 })]);
  assert.doesNotThrow(() => { setSectionStage(list, 'a', 2); cycleSection(list, 'a'); removeSection(list, 'a'); addSection(list, 'B', id); });
});

// ── the performance countdown reads its stages from the sections ──

test('with sections, a stage is done only when every section has reached it', () => {
  let list = three();
  list = list.map(s => ({ ...s, stage: 2 }));
  assert.deepEqual(stagesDone({ status: 'performance-ready', sections: list }), { notes: true, hands: true, tempo: false, memory: false });
  list = setSectionStage(list, list[2].id, 1);
  assert.deepEqual(stagesDone({ sections: list }), { notes: true, hands: false, tempo: false, memory: false });
});

test('the piece status is ignored once it has sections, and the memorised tick still counts for the last stage', () => {
  const list = three().map(s => ({ ...s, stage: 3 }));
  assert.equal(stagesDone({ status: 'new', sections: list }).tempo, true);
  assert.equal(stagesDone({ status: 'performance-ready', sections: [{ id: 'a', name: 'A', stage: 0 }] }).notes, false);
  assert.equal(stagesDone({ sections: list, memorised: true }).memory, true);
  assert.equal(stagesDone({ sections: list.map(s => ({ ...s, stage: 4 })) }).memory, true);
});

test('a piece with no sections behaves exactly as before', () => {
  assert.deepEqual(stagesDone({ status: 'consolidating' }), { notes: true, hands: true, tempo: false, memory: false });
  assert.deepEqual(stagesDone({ status: 'consolidating', sections: [] }), { notes: true, hands: true, tempo: false, memory: false });
});

test('the countdown says it is behind when one section lags, even if the piece status is far on', () => {
  const sections = [{ id: 'a', name: 'A', stage: 3 }, { id: 'b', name: 'B', stage: 0 }];
  const p = performanceProgress({ id: 'p', status: 'performance-ready', sections, performDate: '2026-12-01', performFrom: '2026-11-01' }, '2026-11-12');
  assert.equal(p.behind, true);
  assert.equal(p.next.key, 'notes');
});
