/**
 * Starts the voice engine for a session and stops it (mic off) when the
 * session ends or switches to text. `off` says why voice isn't available, so
 * the session opens in text mode with one line saying so.
 */
import type { PersonaId, VoiceSpeed } from '@rounds/shared';
import type { RoundsClient } from '@rounds/shared/api';
import { useEffect, useState } from 'react';
import { VoiceEngine, type VoiceUnavailable } from './engine';

export type VoiceStatus =
  | { status: 'starting' }
  | { status: 'on'; engine: VoiceEngine }
  | { status: 'off'; reason: VoiceUnavailable | null };

export function useVoiceEngine(
  client: RoundsClient,
  wanted: boolean,
  persona: PersonaId,
  speed: VoiceSpeed,
): VoiceStatus {
  const key = `${persona}|${speed}`;
  // The outcome of starting, for the settings it was started with.
  const [started, setStarted] = useState<{
    key: string;
    result: VoiceEngine | VoiceUnavailable;
  } | null>(null);
  const supported = VoiceEngine.supported();

  useEffect(() => {
    if (!wanted || !supported) return;
    let cancelled = false;
    let engine: VoiceEngine | null = null;
    void VoiceEngine.start(client, persona, speed).then((result) => {
      if (cancelled) {
        if (typeof result !== 'string') void result.dispose();
        return;
      }
      if (typeof result !== 'string') engine = result;
      setStarted({ key: `${persona}|${speed}`, result });
    });
    return () => {
      cancelled = true;
      void engine?.dispose();
      setStarted(null);
    };
  }, [client, wanted, supported, persona, speed]);

  if (!wanted) return { status: 'off', reason: null };
  if (!supported) return { status: 'off', reason: 'unsupported' };
  if (!started || started.key !== key) return { status: 'starting' };
  return typeof started.result === 'string'
    ? { status: 'off', reason: started.result }
    : { status: 'on', engine: started.result };
}

/** One line above the answer box when a session opens in text mode instead of voice. */
export function voiceOffNotice(reason: VoiceUnavailable | null): string | null {
  switch (reason) {
    case 'denied':
      return 'Microphone is off. Turn it on in Settings to answer out loud.';
    case 'unsupported':
    case 'server':
      return "Voice isn't available here, so type your answers.";
    default:
      return null;
  }
}
