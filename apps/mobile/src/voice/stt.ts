/**
 * The app's side of the `stt` provider interface: a streaming speech-to-text
 * connection opened with a short-lived token from the `speech-token` Edge
 * Function. Deepgram Nova-3 with the question's expected words (M2.4). Our own
 * silence check decides when the answer ends; then `finish()` asks Deepgram to
 * flush and returns the final transcript.
 */
import { MIC_SAMPLE_RATE } from '@rounds/shared';
import type { SpeechToken } from '@rounds/shared/api';

export interface SttStream {
  send(pcm: ArrayBuffer): void;
  /** Flushes and resolves with the final transcript (or what was heard by the deadline). */
  finish(): Promise<string>;
  close(): void;
}

/** How long to wait for the vendor's last words after our silence check ends the answer. */
const FINISH_TIMEOUT_MS = 1_500;
/** Deepgram closes a quiet socket after 10 s; the question can take that long to say. */
const KEEPALIVE_MS = 4_000;

interface DeepgramResult {
  type: string;
  is_final?: boolean;
  from_finalize?: boolean;
  channel?: { alternatives: { transcript: string }[] };
}

export function openStt(
  token: SpeechToken,
  keyterms: readonly string[],
  onText: (text: string) => void,
): Promise<SttStream> {
  if (token.vendor === 'fake') return Promise.resolve(fakeStt());
  const params = new URLSearchParams({
    model: token.model,
    encoding: 'linear16',
    sample_rate: String(MIC_SAMPLE_RATE),
    channels: '1',
    interim_results: 'true',
    smart_format: 'true',
    endpointing: 'false',
  });
  for (const term of keyterms) params.append('keyterm', term);
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['bearer', token.token]);
  ws.binaryType = 'arraybuffer';

  const finals: string[] = [];
  let lastSent = Date.now();
  let onFinalize: (() => void) | null = null;
  ws.onmessage = (event: MessageEvent) => {
    let msg: DeepgramResult;
    try {
      msg = JSON.parse(String(event.data)) as DeepgramResult;
    } catch {
      return;
    }
    if (msg.type !== 'Results') return;
    const text = msg.channel?.alternatives[0]?.transcript ?? '';
    if (!msg.is_final) {
      onText([...finals, text].filter(Boolean).join(' '));
      return;
    }
    if (text) finals.push(text);
    onText(finals.join(' '));
    if (msg.from_finalize) onFinalize?.();
  };
  const keepAlive = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && Date.now() - lastSent > KEEPALIVE_MS) {
      ws.send(JSON.stringify({ type: 'KeepAlive' }));
      lastSent = Date.now();
    }
  }, 1_000);

  const stream: SttStream = {
    send(pcm) {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(pcm);
      lastSent = Date.now();
    },
    finish() {
      if (ws.readyState !== WebSocket.OPEN) return Promise.resolve(finals.join(' '));
      return new Promise<string>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          onFinalize = null;
          resolve(finals.join(' '));
        };
        const timer = setTimeout(done, FINISH_TIMEOUT_MS);
        onFinalize = done;
        ws.send(JSON.stringify({ type: 'Finalize' }));
      });
    },
    close() {
      clearInterval(keepAlive);
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        setTimeout(() => ws.close(), 300);
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      }
    },
  };

  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(stream);
    ws.onerror = () => {
      clearInterval(keepAlive);
      reject(new Error('Speech-to-text connection failed'));
    };
  });
}

/** For `functions:serve:fake`: hears nothing, spends nothing. */
function fakeStt(): SttStream {
  return { send: () => {}, finish: () => Promise.resolve(''), close: () => {} };
}
