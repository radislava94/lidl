import { useState, useCallback } from 'react';

/**
 * useState backed by localStorage.
 * Values are JSON-serialised; Sets/Maps must be pre-converted by the caller.
 *
 * @param {string} key           – localStorage key
 * @param {*}      initialValue  – default value if nothing is stored yet
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    valueOrUpdater => {
      try {
        setStoredValue(prev => {
          const next =
            typeof valueOrUpdater === 'function'
              ? valueOrUpdater(prev)
              : valueOrUpdater;
          window.localStorage.setItem(key, JSON.stringify(next));
          return next;
        });
      } catch (err) {
        console.warn('[useLocalStorage] write failed', err);
      }
    },
    [key]
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch { /* ignore */ }
  }, [key, initialValue]);

  return [storedValue, setValue, remove];
}
