/**
 * Test providers for `pnpm functions:serve:fake`. Spend nothing. The fake
 * voice is a short quiet tone whose length grows with the text, so players
 * and caches can be exercised end to end.
 */
import { PCM_SAMPLE_RATE, type SttProvider, type TtsProvider } from './types.ts';

export function createFakeStt(): SttProvider {
  return {
    name: 'fake',
    issueStreamingToken: () =>
      Promise.resolve({ vendor: 'fake', token: 'fake-token', expires_in: 60, model: 'fake' }),
  };
}

/** 16-bit PCM: a 440 Hz tone, 20 ms per character, up to 3 s. */
export function fakeSpeech(text: string): Uint8Array {
  const samples = Math.min(3 * PCM_SAMPLE_RATE, Math.max(1, text.length) * (PCM_SAMPLE_RATE / 50));
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i++) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / PCM_SAMPLE_RATE) * 2_000);
    view.setInt16(i * 2, value, true);
  }
  return bytes;
}

export function createFakeTts(): TtsProvider {
  return {
    name: 'fake',
    voiceFor: (persona) => `fake-${persona}`,
    synthesize({ text }) {
      const bytes = fakeSpeech(text);
      return Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            // Two pieces, like a vendor streaming.
            const half = Math.floor(bytes.length / 4) * 2;
            controller.enqueue(bytes.slice(0, half));
            controller.enqueue(bytes.slice(half));
            controller.close();
          },
        }),
      );
    },
  };
}
