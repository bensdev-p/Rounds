import { DEFAULT_PERSONA, PERSONAS, type PersonaId } from '@rounds/shared';
import { useCallback, useState } from 'react';
import { authStorage } from './authStorage';

const PERSONA_KEY = 'rounds.persona';

function isPersona(value: unknown): value is PersonaId {
  return typeof value === 'string' && value in PERSONAS;
}

/** Reads a stored persona id, ignoring anything unexpected. */
export function parsePersona(value: unknown): PersonaId | null {
  return isPersona(value) ? value : null;
}

function readPersona(): PersonaId {
  try {
    return parsePersona(authStorage.getItem(PERSONA_KEY)) ?? DEFAULT_PERSONA;
  } catch {
    return DEFAULT_PERSONA;
  }
}

/** The persona picker remembers the last choice on this device. */
export function usePersona(): [PersonaId, (persona: PersonaId) => void] {
  const [persona, setPersona] = useState<PersonaId>(readPersona);
  const choose = useCallback((next: PersonaId) => {
    setPersona(next);
    try {
      authStorage.setItem(PERSONA_KEY, next);
    } catch {
      // Not remembered this time; the choice still applies now.
    }
  }, []);
  return [persona, choose];
}
