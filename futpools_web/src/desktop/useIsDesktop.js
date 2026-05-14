// useIsDesktop — single source of truth for the desktop breakpoint.
//
// Activated at viewport ≥ 1100px, matching the design's `--sidebar-w`
// + content min-width budget. Below that the existing mobile shell
// (bottom tab bar + 430px clamp) takes over unchanged.
//
// SSR-safe: defaults to `false` when window is not available so the
// first render matches the mobile layout (avoids hydration flash on a
// future SSR build).
import { useState, useEffect } from 'react';

const DESKTOP_QUERY = '(min-width: 1100px)';

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = (e) => setIsDesktop(e.matches);
    // Older Safari uses addListener/removeListener.
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  return isDesktop;
}
