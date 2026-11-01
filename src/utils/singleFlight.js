// Runs an async task one at a time. Pure (no imports), so it is unit-tested in plain Node, see
// tests/singleFlight.test.mjs.
//
// It is what keeps a screen's data reload from overlapping itself. Asking for a run while one is in
// progress does not start a second one beside it: it makes the running one go round once more when it
// finishes (once however many were asked for), and every caller gets a promise that settles when the
// whole thing, including that extra round, is done. Two reloads running together could finish out of
// order, so an older one could put an older list on the screen.
//
//   const reload = singleFlight(async isStale => {
//     const rows = await read();
//     if (!isStale()) show(rows);      // isStale() is true once another run has been asked for
//   });
//
// `isStale` lets a run skip showing a result that the next round is about to replace.
export function singleFlight(task) {
  let running = null;
  let queued = false;
  return function run() {
    if (running) { queued = true; return running; }
    let finished = false;
    const p = (async () => {
      try {
        do {
          queued = false;
          await task(() => queued);
        } while (queued);
      } finally {
        finished = true;
        running = null;
      }
    })();
    // A task that throws before its first await has already finished by now; remembering it as
    // "running" would then block every later run.
    if (!finished) running = p;
    return p;
  };
}
