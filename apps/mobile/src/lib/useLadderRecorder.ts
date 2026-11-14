import {
  finishDrill,
  finishSession,
  recordAttempt,
  startDrillSession,
  startSession,
  type RoundsClient,
} from '@rounds/shared/api';
import type { Attempt, DrillState, IllnessScript, LadderState, PersonaId } from '@rounds/shared';
import { useCallback, useRef, useState } from 'react';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; bestRung: number }
  | { status: 'error' };

/**
 * Saves a run in the background so typing is never blocked. Writes are queued
 * in order: the session is created on the first answer, then each attempt,
 * then the finish. A failed save shows a notice; the run goes on.
 */
function useRunRecorder<S>(
  start: () => Promise<string>,
  /** Closes the session; returns the best rung to show, or null (drills). */
  close: (sessionId: string, state: S) => Promise<number | null>,
  client: RoundsClient,
) {
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const session = useRef<Promise<string> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Ignores results from a run the student already restarted.
  const run = useRef(0);

  const enqueue = useCallback(
    (task: (sessionId: string) => Promise<void>) => {
      const thisRun = run.current;
      session.current ??= start();
      const sessionId = session.current;
      queue.current = queue.current
        .then(async () => task(await sessionId))
        .catch((error: unknown) => {
          console.warn('[rounds] save failed', error);
          if (run.current === thisRun) setSave({ status: 'error' });
        });
    },
    [start],
  );

  const record = useCallback(
    (attempt: Attempt) => {
      setSave((s) => (s.status === 'error' ? s : { status: 'saving' }));
      enqueue((id) => recordAttempt(client, id, attempt));
    },
    [client, enqueue],
  );

  const finish = useCallback(
    (state: S) => {
      const thisRun = run.current;
      enqueue(async (id) => {
        const bestRung = (await close(id, state)) ?? 0;
        if (run.current === thisRun) {
          setSave((s) => (s.status === 'error' ? s : { status: 'saved', bestRung }));
        }
      });
    },
    [close, enqueue],
  );

  const reset = useCallback(() => {
    run.current += 1;
    session.current = null;
    setSave({ status: 'idle' });
  }, []);

  return { save, record, finish, reset };
}

/** Saves a ladder run (see `useRunRecorder`). */
export function useLadderRecorder(
  client: RoundsClient,
  script: Pick<IllnessScript, 'id' | 'version'>,
  persona: PersonaId,
) {
  const start = useCallback(() => startSession(client, script, persona), [client, script, persona]);
  const close = useCallback(
    (id: string, state: LadderState) => finishSession(client, id, state),
    [client],
  );
  return useRunRecorder(start, close, client);
}

/** Saves a mix-up drill. Drills never change the best rung. */
export function useDrillRecorder(
  client: RoundsClient,
  script: Pick<IllnessScript, 'id' | 'version'>,
  partnerId: string,
  persona: PersonaId,
) {
  const start = useCallback(
    () => startDrillSession(client, script, partnerId, persona),
    [client, script, partnerId, persona],
  );
  const close = useCallback(
    async (id: string, state: DrillState) => {
      await finishDrill(client, id, state);
      return null;
    },
    [client],
  );
  return useRunRecorder(start, close, client);
}
