// The app's sync outbox: the real storage and the real push wired into the tested logic in
// utils/syncQueue.js (see tests/syncQueue.test.mjs). Kept this small on purpose; it has no logic.
import { getLocalPref, setLocalPref } from '../utils';
import { pushRecord, tombstoneRecord } from './sync';
import { createOutbox } from '../utils/syncQueue';

export const outbox = createOutbox({ getPref: getLocalPref, setPref: setLocalPref, push: pushRecord, tombstone: tombstoneRecord });
