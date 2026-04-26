import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Hook for persisting state to localStorage
 * Automatically saves to localStorage on change and loads on mount
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Initialize from localStorage or use default
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
    } catch (error) {
      console.warn(`Failed to load persisted state for "${key}":`, error);
    }
    return defaultValue;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to persist state for "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Hook for persisting Set to localStorage
 * Handles Set serialization/deserialization
 */
export function usePersistedSet<T extends string>(
  key: string,
  defaultValue: Set<T>
): [Set<T>, (updater: (prev: Set<T>) => Set<T>) => void] {
  const [set, setSet] = useState<Set<T>>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const array = JSON.parse(item) as T[];
        return new Set(array);
      }
    } catch (error) {
      console.warn(`Failed to load persisted set for "${key}":`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      const array = Array.from(set);
      window.localStorage.setItem(key, JSON.stringify(array));
    } catch (error) {
      console.warn(`Failed to persist set for "${key}":`, error);
    }
  }, [key, set]);

  return [set, setSet];
}
