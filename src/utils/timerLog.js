// A finished practice timer, as the segments the practice log form opens with. Pure (no React Native
// imports), so it's unit-tested in plain Node, see tests/timerLog.test.mjs.
//
// This used to be written out inside HomeScreen's handleTimerFinish, which rebuilds each segment from
// a fixed list of fields, so anything else on a timer segment (like the run-through count) was
// silently dropped. It is here, with a test, so a field added to the timer carries across.

// SegmentEditor's technique-group pills read segment.group (set via its own field('group', g)), not
// segment.title, which there is only the optional free-text label underneath. The timer's own group
// picker (TimerSetupModal) stores the chosen group in title, so it is remapped to group here, or the
// pill shows nothing selected when the log form opens and saving without re-clicking it drops the
// technique group entirely.
//
// `minutesFor(i)` is the minutes actually spent on segment i. A piece's run-throughs (counted on the
// timer) go with it, and a technique segment's dynamics; each key is left out when there are none.
export function timerToLogSegments(segments, minutesFor) {
  return segments.map((s, i) => {
    const isTech = s.type === 'technique';
    const n = Math.floor(Number(s.runThroughs));
    const runThroughs = !isTech && Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
    const dynamics = isTech && Array.isArray(s.dynamics) && s.dynamics.length ? s.dynamics : null;
    return {
      id: s.id,
      type: s.type,
      group: isTech ? (s.title || '') : undefined,
      title: isTech ? '' : (s.title || ''),
      compositionId: s.compositionId || '',
      duration: minutesFor(i),
      articulation: isTech ? (s.articulation || null) : undefined,
      notes: '', challenges: [], progress: [],
      ...(runThroughs ? { runThroughs } : {}),
      ...(dynamics ? { dynamics } : {}),
    };
  });
}
