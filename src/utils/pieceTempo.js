// What the metronome should start from for a library piece: its reference tempo and first time
// signature. Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/pieceTempo.test.mjs.
//
// A piece can reach the metronome in several shapes depending on where it has been: `timeSigs`
// (an array) is the current one, but a piece that came through sync and was stored as it
// arrived can carry `time_sigs` (an array or a JSON string), and older pieces only have the
// single `timeSig` / `time_sig`. Reading all of them means the metronome doesn't depend on a
// stored copy having been tidied up first.

const SIG = /^\d{1,2}\/\d{1,2}$/;

function firstSig(composition) {
  for (const raw of [composition.timeSigs, composition.time_sigs]) {
    let list = raw;
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch { list = [list]; }
    }
    if (Array.isArray(list)) {
      const found = list.map(s => String(s).trim()).find(s => SIG.test(s));
      if (found) return found;
    }
  }
  for (const raw of [composition.timeSig, composition.time_sig]) {
    if (typeof raw === 'string' && SIG.test(raw.trim())) return raw.trim();
  }
  return null;
}

// -> { bpm, sig, hasTempo, hasSig }. bpm and sig fall back to the defaults when the piece has
// none; hasTempo / hasSig say whether they came from the piece. The metronome's range is 30-240.
export function pieceMetronomeDefaults(composition, fallback = { bpm: 90, sig: '4/4' }) {
  const c = composition && typeof composition === 'object' ? composition : {};
  const t = Math.round(Number(c.tempo));
  const hasTempo = Number.isFinite(t) && t > 0;
  const sig = firstSig(c);
  return {
    bpm: hasTempo ? Math.min(240, Math.max(30, t)) : fallback.bpm,
    sig: sig || fallback.sig,
    hasTempo,
    hasSig: !!sig,
  };
}
