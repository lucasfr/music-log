export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
