// Theme state: which mode the user picked (Light, Dark or "System") and which colour scheme (the standard teal, or one
// of the others in SCHEMES), both persisted across launches.
//
//   const { pref, scheme, resolved, setTheme, setScheme, options, schemes } = useTheme();
//   setTheme('dark', { resume: 'Settings' });
//   setScheme('forest', { resume: 'Settings' });
//
// `resolved` is the concrete palette in force: 'light' or 'dark' for the standard scheme, '<scheme>-light' or
// '<scheme>-dark' for the others (see themeKey in index.js). Colours live in the shared COLOURS object, so a change
// has to re-render everything that reads it: AppInner keys its visual tree on `resolved` to do exactly that, while
// keeping data hooks and onboarding state mounted.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, SCHEMES, COLOURS, applyTheme, themeKey } from './index';
import { applyPageChrome } from '../utils/pageChrome';

const STORAGE_KEY = 'musiclog.theme';
const SCHEME_KEY = 'musiclog.scheme';

// After a theme change the navigator remounts; this remembers which tab to land on
// (Settings, where the switch lives) instead of bouncing back to Home.
let resumeRoute = null;
export function takeResumeRoute() {
  const r = resumeRoute;
  resumeRoute = null;
  return r;
}

const MODES = [{ key: 'system', label: 'System' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }];
const SCHEME_LIST = Object.keys(SCHEMES).map(k => ({ key: k, label: SCHEMES[k].label }));

const ThemeContext = createContext({
  pref: 'system', scheme: 'standard', resolved: 'light', setTheme: () => {}, setScheme: () => {}, options: MODES, schemes: SCHEME_LIST,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [pref, setPref] = useState('system');
  const [scheme, setSchemePref] = useState('standard');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
      AsyncStorage.getItem(SCHEME_KEY).catch(() => null),
    ]).then(([mode, sch]) => {
      if (!alive) return;
      if (mode) setPref(mode);
      if (sch && SCHEMES[sch]) setSchemePref(sch);
    }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // The mode in force: the device's setting for System, otherwise the one picked (anything unknown is light).
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : (pref === 'dark' ? 'dark' : 'light');
  const resolved = THEMES[themeKey(scheme, mode)] ? themeKey(scheme, mode) : 'light';

  // Applied during render so children see the right colours on their very first paint.
  applyTheme(resolved);

  // The page behind the app, and so the notch on an iPhone, follows the theme too.
  useEffect(() => { applyPageChrome(COLOURS); }, [resolved]);

  const setTheme = useCallback((next, { resume } = {}) => {
    resumeRoute = resume || null;
    setPref(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setScheme = useCallback((next, { resume } = {}) => {
    if (!SCHEMES[next]) return;
    resumeRoute = resume || null;
    setSchemePref(next);
    AsyncStorage.setItem(SCHEME_KEY, next).catch(() => {});
  }, []);

  // Hold the first paint until the saved choices are read, so there's no flash of the standard colours.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ pref, scheme, resolved, setTheme, setScheme, options: MODES, schemes: SCHEME_LIST }}>
      {children}
    </ThemeContext.Provider>
  );
}
