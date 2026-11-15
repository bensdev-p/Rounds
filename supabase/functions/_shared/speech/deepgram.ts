/**
 * Deepgram for both speech-to-text (Nova-3, streamed from the app with a
 * short-lived token) and the voice (Aura-2), as chosen in M2.4. Needs an API
 * key with the Member role to grant tokens.
 */
import {
  PCM_SAMPLE_RATE,
  SpeechVendorError,
  type PersonaVoice,
  type StreamingToken,
  type SttProvider,
  type SynthesisRequest,
  type TtsProvider,
} from './types.ts';

/** One voice per persona (developer's pick, 14 Nov 2026). */
const VOICES: Record<PersonaVoice, string> = {
  teacher: 'aura-2-harmonia-en',
  surgeon: 'aura-2-orpheus-en',
  internist: 'aura-2-atlas-en',
};

const TOKEN_TTL_SECONDS = 60;

export function createDeepgramStt(apiKey: string, model = 'nova-3'): SttProvider {
  return {
    name: 'deepgram',
    async issueStreamingToken(): Promise<StreamingToken> {
      const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
      });
      if (!response.ok) {
        throw new SpeechVendorError(`deepgram grant ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!body.access_token) throw new SpeechVendorError('deepgram grant: no token');
      return {
        vendor: 'deepgram',
        token: body.access_token,
        expires_in: body.expires_in ?? TOKEN_TTL_SECONDS,
        model,
      };
    },
  };
}

export function createDeepgramTts(apiKey: string): TtsProvider {
  return {
    name: 'deepgram',
    voiceFor: (persona) => VOICES[persona],
    async synthesize({ text, persona, speed, signal }: SynthesisRequest) {
      const params = new URLSearchParams({
        model: VOICES[persona],
        encoding: 'linear16',
        sample_rate: String(PCM_SAMPLE_RATE),
        container: 'none',
      });
      if (speed !== 1) params.set('speed', String(speed));
      const response = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!response.ok || !response.body) {
        throw new SpeechVendorError(`deepgram speak ${response.status}: ${await response.text()}`);
      }
      return response.body;
    },
  };
}
