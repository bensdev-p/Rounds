import {
  DEFAULT_PERSONA,
  DEFAULT_ROUNDS_GOAL,
  MAX_ROUNDS_GOAL,
  MIN_ROUNDS_GOAL,
  PERSONAS,
  type PersonaId,
} from '@rounds/shared';
import { useSyncExternalStore } from 'react';
import { authStorage } from './authStorage';

/**
 * Small per-device preferences, kept in local storage. Each one is a shared
 * store, so a change on one screen (Appearance in Settings) shows at once on
 * screens still mounted underneath. Anything that should follow the student
 * to another phone lives in their profile instead (lib/profile.tsx).
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

/** Reads a persona id (a route param), ignoring anything unexpected. */
export function parsePersona(value: unknown): PersonaId | null {
  return isPersona(value) ? value : null;
}

export type Appearance = 'light' | 'dark' | 'system';

/** Settings → Appearance. Dark by default (DESIGN.md). Per device. */
export const useAppearance = createPref<Appearance>('rounds.appearance', (raw) =>
  raw === 'light' || raw === 'system' ? raw : 'dark',
);

/** Whether the "Keep your progress" sign-in panel has been shown (once, wireframe 01 note 2). */
export const useSignInAsked = createPref<boolean>('rounds.signInAsked', (raw) => raw === 'true');

/**
 * The persona and goal this device remembered before profiles existed
 * (Stage 1), so onboarding keeps them for students who already practised.
 */
export function earlierDeviceChoices(): { persona: PersonaId; daily_goal: number } {
  let persona: string | null = null;
  let goal = NaN;
  try {
    persona = authStorage.getItem('rounds.persona');
    goal = Number(authStorage.getItem('rounds.goal'));
  } catch {
    // Nothing remembered.
  }
  return {
    persona: parsePersona(persona) ?? DEFAULT_PERSONA,
    daily_goal:
      Number.isInteger(goal) && goal >= MIN_ROUNDS_GOAL && goal <= MAX_ROUNDS_GOAL
        ? goal
        : DEFAULT_ROUNDS_GOAL,
  };
}
