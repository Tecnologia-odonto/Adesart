import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === 'function'
    ? (initialValue as () => T)()
    : initialValue;
}

interface UsePersistentStateResult<T> {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
  clear: () => void;
}

/**
 * useState + localStorage persistence keyed by user/route-specific keys.
 *
 * - If key is null/undefined, behaves like regular useState without persistence.
 * - On key change, attempts to hydrate from localStorage.
 */
export function usePersistentState<T>(
  key: string | null | undefined,
  initialValue: T | (() => T)
): UsePersistentStateResult<T> {
  const initialValueRef = useRef<T>(resolveInitialValue(initialValue));
  const [value, setValue] = useState<T>(initialValueRef.current);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!key || typeof window === 'undefined') {
      hydratedRef.current = true;
      return;
    }

    try {
      const stored = localStorage.getItem(key);

      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(initialValueRef.current);
      }
    } catch (error) {
      console.warn(`[usePersistentState] Failed to hydrate key "${key}"`, error);
      setValue(initialValueRef.current);
    } finally {
      hydratedRef.current = true;
    }
  }, [key]);

  useEffect(() => {
    if (!key || !hydratedRef.current || typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[usePersistentState] Failed to persist key "${key}"`, error);
    }
  }, [key, value]);

  const clear = () => {
    if (key && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`[usePersistentState] Failed to clear key "${key}"`, error);
      }
    }

    setValue(initialValueRef.current);
  };

  return { value, setValue, clear };
}
