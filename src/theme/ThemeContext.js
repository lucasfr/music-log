// Theme state: which theme the user picked (or "System"), persisted across launches.
//
//   const { pref, resolved, setTheme, options } = useTheme();
//   setTheme('dark', { resume: 'Settings' });
//
// `resolved` is the concrete theme in force ("light", "dark", or any future entry in
// THEMES). Colours live in the shared COLOURS object, so a theme change has to
// re-render everything that reads it: AppInner keys its visual tree on `resolved`
// to do exactly that, while keeping data hooks and onboarding state mounted.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, applyTheme } from './index';

const STORAGE_KEY = 'musiclog.theme';

// After a theme change the navigator remounts; this remembers which tab to land on
// (Settings, where the switch lives) instead of bouncing back to Home.
let resumeRoute = null;
export function takeResumeRoute() {
  const r = resumeRoute;
  resumeRoute = null;
  return r;
}

const ThemeContext = createContext({
  pref: 'system', resolved: 'light', setTheme: () => {}, options: [],
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [pref, setPref] = useState('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (alive && v) setPref(v); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const resolved = pref === 'system'
    ? (system === 'dark' && THEMES.dark ? 'dark' : 'light')
    : (THEMES[pref] ? pref : 'light');

  // Applied during render so children see the right colours on their very first paint.
  applyTheme(resolved);

  const setTheme = useCallback((next, { resume } = {}) => {
    resumeRoute = resume || null;
    setPref(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  // "System" first, then every registered theme, so a new palette in THEMES shows up
  // in Settings with no other change.
  const options = useMemo(
    () => [{ key: 'system', label: 'System' }, ...Object.keys(THEMES).map(k => ({ key: k, label: THEMES[k].label }))],
    [],
  );

  // Hold the first paint until the saved choice is read, so there's no light flash.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ pref, resolved, setTheme, options }}>
      {children}
    </ThemeContext.Provider>
  );
}
