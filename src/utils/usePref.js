// usePref(key, fallback) -> [value, setValue]
//
// A preference (see getLocalPref / setLocalPref in utils.js) as React state: it reads the
// stored value, and updates when it is changed anywhere in the app, so Settings can change
// the weekly goal and Home reflects it straight away. Values are strings.

import { useState, useEffect, useCallback } from 'react';
import { getLocalPref, setLocalPref, subscribePrefs } from '../utils';

export function usePref(key, fallback = '') {
  const [value, setValue] = useState(() => getLocalPref(key, fallback));
  useEffect(() => {
    setValue(getLocalPref(key, fallback));
    return subscribePrefs(changed => {
      if (changed === key) setValue(getLocalPref(key, fallback));
    });
  }, [key, fallback]);
  const set = useCallback(v => setLocalPref(key, v), [key]);
  return [value, set];
}
