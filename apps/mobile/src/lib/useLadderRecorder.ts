import { finishSession, recordAttempt, startSession, type RoundsClient } from '@rounds/shared/api';
import type { Attempt, IllnessScript, LadderState, PersonaId } from '@rounds/shared';
import { useCallback, useRef, useState } from 'react';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; bestRung: number }
  | { status: 'error' };

/**
 * Saves a ladder run in the background so typing is never blocked. Writes are
 * queued in order: the session is created on the first answer, then each
 * attempt, then the finish. A failed save shows a notice; the ladder goes on.
 */
export function useLadderRecorder(
  client: RoundsClient,
  script: Pick<IllnessScript, 'id' | 'version'>,
  persona: PersonaId,
) {
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const session = useRef<Promise<string> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Ignores results from a run the student already restarted.
  const run = useRef(0);

  const enqueue = useCallback(
    (task: (sessionId: string) => Promise<void>) => {
      const thisRun = run.current;
      session.current ??= startSession(client, script, persona);
      const sessionId = session.current;
      queue.current = queue.current
        .then(async () => task(await sessionId))
        .catch((error: unknown) => {
          console.warn('[rounds] save failed', error);
          if (run.current === thisRun) setSave({ status: 'error' });
        });
    },
    [client, script, persona],
  );

  const record = useCallback(
    (attempt: Attempt) => {
      setSave((s) => (s.status === 'error' ? s : { status: 'saving' }));
      enqueue((id) => recordAttempt(client, id, attempt));
    },
    [client, enqueue],
  );

  const finish = useCallback(
    (state: LadderState) => {
      const thisRun = run.current;
      enqueue(async (id) => {
        const bestRung = await finishSession(client, id, state);
        if (run.current === thisRun) {
          setSave((s) => (s.status === 'error' ? s : { status: 'saved', bestRung }));
        }
      });
    },
    [client, enqueue],
  );

  const reset = useCallback(() => {
    run.current += 1;
    session.current = null;
    setSave({ status: 'idle' });
  }, []);

  return { save, record, finish, reset };
}
