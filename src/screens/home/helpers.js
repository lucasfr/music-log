// Small helpers the Home screen's parts share. Moved out of HomeScreen.js unchanged.

import { RatingMini } from '../../components/UI';

export function energyToBar(v) { return v === null || v === undefined ? 0 : v + 3; }

export const ENERGY_LABELS = { '-2': 'Very low', '-1': 'Low', '0': 'Neutral', '1': 'Good', '2': 'High' };

// Read-only rating row (energy, enjoyment): the shared RatingMini at this screen's default size.
export const ZeldaMini = RatingMini;

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
