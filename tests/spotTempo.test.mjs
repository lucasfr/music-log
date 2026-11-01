import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSpots, addSpot, setSpotFixed, removeSpot, setSpotTempo, startSpotTempo, nextSpotTempo, openSpots,
  SPOT_TEMPO_MIN, SPOT_TEMPO_MAX,
} from '../src/utils/insights.js';

const TODAY = '2026-11-01';
let n = 0;
const id = () => `spot-${n++}`;
const base = () => addSpot(addSpot([], 'Bars 9-12', TODAY, id), 'left hand jump', TODAY, id);

test('spots without a tempo come out exactly as they did before (no tempo key at all)', () => {
  const spots = base();
  spots.forEach(s => assert.equal('tempo' in s, false));
  assert.deepEqual(Object.keys(spots[0]).sort(), ['added', 'bars', 'fixed', 'id', 'status']);
});

test('setSpotTempo sets one spot\'s tempo and leaves the others alone', () => {
  const spots = base();
  const out = setSpotTempo(spots, spots[0].id, 64);
  assert.equal(out[0].tempo, 64);
  assert.equal('tempo' in out[1], false);
  assert.equal('tempo' in spots[0], false);               // the list passed in is untouched
});

test('the tempo is rounded, kept within 20 to 300, and anything else clears it', () => {
  const spots = base();
  const sid = spots[0].id;
  assert.equal(setSpotTempo(spots, sid, 63.6)[0].tempo, 64);
  assert.equal(setSpotTempo(spots, sid, SPOT_TEMPO_MIN)[0].tempo, SPOT_TEMPO_MIN);
  assert.equal(setSpotTempo(spots, sid, SPOT_TEMPO_MAX)[0].tempo, SPOT_TEMPO_MAX);
  for (const bad of [19, 301, 0, -5, NaN, '', null, undefined, 'fast']) assert.equal('tempo' in setSpotTempo(setSpotTempo(spots, sid, 70), sid, bad)[0], false, String(bad));
});

test('a spot id that does not exist changes nothing', () => {
  const spots = base();
  assert.deepEqual(setSpotTempo(spots, 'nope', 80), spots);
});

test('the tempo survives fixing, un-fixing, adding another spot and the cleaning pass', () => {
  let spots = base();
  const sid = spots[0].id;
  spots = setSpotTempo(spots, sid, 70);
  spots = setSpotFixed(spots, sid, true, TODAY);
  assert.equal(spots[0].tempo, 70);
  spots = setSpotFixed(spots, sid, false, TODAY);
  assert.equal(spots[0].tempo, 70);
  spots = addSpot(spots, 'bar 30', TODAY, id);
  assert.equal(spots[0].tempo, 70);
  assert.equal(parseSpots(JSON.parse(JSON.stringify(spots)))[0].tempo, 70);
  assert.equal(removeSpot(spots, spots[1].id)[0].tempo, 70);
});

test('a stored spot with a nonsense tempo is cleaned, not shown', () => {
  const cleaned = parseSpots([{ id: 'a', bars: '1-4', status: 'open', tempo: 'quick' }, { id: 'b', bars: '5-8', status: 'open', tempo: 5000 }, { id: 'c', bars: '9-12', status: 'open', tempo: '88' }]);
  assert.equal('tempo' in cleaned[0], false);
  assert.equal('tempo' in cleaned[1], false);
  assert.equal(cleaned[2].tempo, 88);
});

test('openSpots keeps the tempo on open spots', () => {
  const spots = base();
  const withTempo = setSpotTempo(spots, spots[0].id, 66);
  const open = openSpots({ spots: withTempo });
  assert.equal(open.length, 2);
  assert.equal(open.filter(s => s.tempo === 66).length, 1);
});

test('startSpotTempo: a bit over half the piece tempo, even, never below 20; 60 with no piece tempo', () => {
  assert.equal(startSpotTempo(100), 60);
  assert.equal(startSpotTempo(120), 72);
  assert.equal(startSpotTempo(76), 46);
  assert.equal(startSpotTempo(10), SPOT_TEMPO_MIN);
  for (const none of [undefined, null, 0, -4, NaN, 'x']) assert.equal(startSpotTempo(none), 60);
});

test('nextSpotTempo: a 5% step (at least 2), capped at the piece tempo', () => {
  assert.equal(nextSpotTempo({ tempo: 60 }, 120), 63);
  assert.equal(nextSpotTempo({ tempo: 30 }, 120), 32);          // 5% would be 1.5: the minimum step is 2
  assert.equal(nextSpotTempo({ tempo: 118 }, 120), 120);        // capped at the piece's tempo
  assert.equal(nextSpotTempo({ tempo: 60 }, undefined), 63);    // no piece tempo: no cap
});

test('nextSpotTempo is null when there is nothing to step to', () => {
  assert.equal(nextSpotTempo({ tempo: 120 }, 120), null);       // already there
  assert.equal(nextSpotTempo({ tempo: 130 }, 120), null);       // past it
  assert.equal(nextSpotTempo({}, 120), null);                   // no tempo yet
  assert.equal(nextSpotTempo(null, 120), null);
  assert.equal(nextSpotTempo({ tempo: SPOT_TEMPO_MAX }, undefined), SPOT_TEMPO_MAX);
});
