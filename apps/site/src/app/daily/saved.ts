import { SCRIPT_KINDS, type DayKey, type MissCard, type ScriptKind } from '@rounds/shared';

/**
 * Today's finished run, kept in this browser so a reload shows the result
 * instead of a second go. Only today's is kept.
 */
export interface SavedRun {
  day: DayKey;
  script_id: string;
  script_name: string;
  /** Picks the ladder's labels. Runs saved before kinds existed have none: disease. */
  script_kind?: ScriptKind;
  cleared: number;
  missed: boolean;
  total: number;
  miss: Pick<MissCard, 'label' | 'quote' | 'correction'> | null;
}

const KEY = 'pimpme-daily';

function isSavedRun(value: unknown): value is SavedRun {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const miss = v.miss as Record<string, unknown> | null | undefined;
  return (
    typeof v.day === 'string' &&
    typeof v.script_id === 'string' &&
    typeof v.script_name === 'string' &&
    (v.script_kind === undefined || SCRIPT_KINDS.some((k) => k === v.script_kind)) &&
    typeof v.cleared === 'number' &&
    typeof v.missed === 'boolean' &&
    typeof v.total === 'number' &&
    (miss === null ||
      (typeof miss === 'object' &&
        typeof miss.label === 'string' &&
        (miss.quote === null || typeof miss.quote === 'string') &&
        typeof miss.correction === 'string'))
  );
}

export function loadRun(day: DayKey, scriptId: string): SavedRun | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return isSavedRun(value) && value.day === day && value.script_id === scriptId ? value : null;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Private mode or storage full: the result still shows, it just isn't kept.
  }
}
