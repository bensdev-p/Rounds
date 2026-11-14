import { DEFAULT_PERSONA, DEFAULT_ROUNDS_GOAL, PERSONAS, type PersonaId } from '@rounds/shared';
import { useSyncExternalStore } from 'react';
import { authStorage } from './authStorage';

/**
 * Small per-device preferences, kept in local storage. Each one is a shared
 * store, so a change on one screen (e.g. the goal on Progress) shows at once
 * on screens still mounted underneath (Home).
 */
function createPref<T>(key: string, parse: (raw: string | null) => T) {
  let value: T | undefined;
  const listeners = new Set<() => void>();
  const read = (): T => {
    if (value === undefined) {
      try {
        value = parse(authStorage.getItem(key));
      } catch {
        value = parse(null);
      }
    }
    return value;
  };
  const set = (next: T) => {
    value = next;
    try {
      authStorage.setItem(key, String(next));
    } catch {
      // Not remembered this time; the choice still applies now.
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return function usePref(): [T, (next: T) => void] {
    return [useSyncExternalStore(subscribe, read, read), set];
  };
}

function isPersona(value: unknown): value is PersonaId {
  return typeof value === 'string' && value in PERSONAS;
}

/** Reads a stored persona id, ignoring anything unexpected. */
export function parsePersona(value: unknown): PersonaId | null {
  return isPersona(value) ? value : null;
}

/** The persona picker remembers the last choice on this device. */
export const usePersona = createPref<PersonaId>(
  'rounds.persona',
  (raw) => parsePersona(raw) ?? DEFAULT_PERSONA,
);

export const MIN_ROUNDS_GOAL = 1;
export const MAX_ROUNDS_GOAL = 5;

/** Sessions per day that finish rounds (DESIGN.md: 3 by default, adjustable 1 to 5). */
export const useRoundsGoal = createPref<number>('rounds.goal', (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MIN_ROUNDS_GOAL && n <= MAX_ROUNDS_GOAL
    ? n
    : DEFAULT_ROUNDS_GOAL;
});
