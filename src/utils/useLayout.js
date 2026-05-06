import { useState, useCallback } from 'react';

export const DESKTOP_BREAKPOINT = 768;

export function useLayout() {
  const initWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const [width, setWidth] = useState(initWidth);

  const onLayout = useCallback(e => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  return {
    width,
    onLayout,
    isDesktop: width >= DESKTOP_BREAKPOINT,
  };
}
