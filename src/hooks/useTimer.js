import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Countdown timer hook.
 *
 * @param {number}   initialSeconds – starting value
 * @param {Function} onExpire       – called when timer reaches 0
 *
 * Returns { seconds, isRunning, start, stop, reset, percentage }
 */
export function useTimer(initialSeconds, onExpire) {
  const [seconds, setSeconds]     = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);

  // Keep callback ref fresh without re-creating effect
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          onExpireRef.current?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const start = useCallback((overrideSeconds) => {
    const s = overrideSeconds ?? initialSeconds;
    clearInterval(intervalRef.current);
    setSeconds(s);
    setIsRunning(true);
  }, [initialSeconds]);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback((overrideSeconds) => {
    clearInterval(intervalRef.current);
    setSeconds(overrideSeconds ?? initialSeconds);
    setIsRunning(false);
  }, [initialSeconds]);

  const percentage = initialSeconds > 0
    ? Math.round((seconds / initialSeconds) * 100)
    : 0;

  return { seconds, isRunning, start, stop, reset, percentage };
}
