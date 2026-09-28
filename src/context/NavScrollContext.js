import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// Drives the floating tab bar's compact/expanded state from whichever
// screen is currently scrolling. Screens don't know about the tab bar —
// they just call the onScroll handler this module hands them.

const NavScrollContext = createContext({ compact: false, setCompact: () => {} });

const IDLE_MS = 5000;
const DIRECTION_THRESHOLD = 4;
const TOP_THRESHOLD = 40;
const BOTTOM_EPSILON = 4;

export function NavScrollProvider({ children }) {
  const [compact, setCompact] = useState(false);
  return (
    <NavScrollContext.Provider value={{ compact, setCompact }}>
      {children}
    </NavScrollContext.Provider>
  );
}

export function useNavScrollContext() {
  return useContext(NavScrollContext);
}

// Hook for screens to wire into their ScrollView:
//   const onNavScroll = useNavScrollHandler();
//   <ScrollView onScroll={onNavScroll} scrollEventThrottle={16} />
//
// Collapses the tab bar on a deliberate scroll-down, re-expands on
// scroll-up, at the top, at the bottom, or after IDLE_MS of no scrolling.
export function useNavScrollHandler() {
  const { setCompact } = useNavScrollContext();
  const lastY = useRef(0);
  const idleTimer = useRef(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setCompact(false), IDLE_MS);
  }, [setCompact]);

  const onScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const atBottom = y + layoutMeasurement.height >= contentSize.height - BOTTOM_EPSILON;
    const atTop = y < 20;

    if (y > lastY.current + DIRECTION_THRESHOLD && y > TOP_THRESHOLD && !atBottom) {
      setCompact(true);
    } else if (y < lastY.current - DIRECTION_THRESHOLD || atTop || atBottom) {
      setCompact(false);
    }
    lastY.current = y;
    resetIdleTimer();
  }, [setCompact, resetIdleTimer]);

  return onScroll;
}
