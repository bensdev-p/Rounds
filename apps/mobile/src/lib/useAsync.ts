import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/**
 * Runs `load` on mount and whenever `key` changes. `reload()` runs it again.
 * Results from stale runs are ignored. Screens that change `key` should
 * remount (as Expo Router does per route) rather than rely on a reset here.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  key: string,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let current = true;
    loadRef
      .current()
      .then((data) => current && setState({ status: 'ready', data }))
      .catch(
        (error: unknown) =>
          current &&
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
      );
    return () => {
      current = false;
    };
  }, [key, attempt]);

  // Keeps showing current data while refreshing; only an error goes back to loading.
  const reload = useCallback(() => {
    setState((s) => (s.status === 'error' ? { status: 'loading' } : s));
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}
