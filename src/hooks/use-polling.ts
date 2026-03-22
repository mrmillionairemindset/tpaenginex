import { useEffect, useRef, useCallback } from 'react';

/**
 * Calls `fetchFn` on an interval while the tab is visible.
 * Pauses when the tab is hidden to save bandwidth.
 * Returns a `refresh` function for manual triggers.
 */
export function usePolling(fetchFn: () => void, intervalMs = 15000) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => fetchRef.current(), intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    start();

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Fetch immediately when tab becomes visible again
        fetchRef.current();
        start();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [start, stop]);

  return { refresh: () => fetchRef.current() };
}
