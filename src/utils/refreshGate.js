// Decides whether a background refresh should start now. Pure (the clock is passed in), so it's
// unit-tested in plain Node, see tests/refreshGate.test.mjs.
//
// The app refreshes when you come back to it and when the network returns. Those events can arrive in
// bursts (the tab becomes visible, then the network event fires), and a refresh pulls three tables, so
// a refresh does not start while another is running or within `minGapMs` of the last one, unless it
// is forced (a network that has just come back should not wait).

export function createRefreshGate({ minGapMs = 30000, now = Date.now } = {}) {
  let last = -Infinity;
  let running = false;
  return {
    // true when a refresh should start now; it is then counted as started until finish() is called
    tryStart(force = false) {
      if (running) return false;
      const t = now();
      if (!force && t - last < minGapMs) return false;
      running = true;
      last = t;
      return true;
    },
    finish() { running = false; },
    get running() { return running; },
  };
}
