/**
 * Voice on the web (Chrome on the PC; also any browser with a secure page).
 * Mic: getUserMedia into an AudioWorklet that hands back 16 kHz frames
 * (from the M2.4 spike). Output: a Web Audio AudioContext.
 */
import { MIC_SAMPLE_RATE } from '@rounds/shared';
import type { AudioOut, Mic, MicFrame, MicPermission, VoicePlatform } from './types';

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(320); this.n = 0; this.sum = 0; this.acc = 0; this.cnt = 0; this.t = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.cnt++; this.t += ${MIC_SAMPLE_RATE};
      if (this.t >= sampleRate) {
        this.t -= sampleRate;
        const v = this.acc / this.cnt; this.acc = 0; this.cnt = 0;
        this.sum += v * v;
        this.buf[this.n++] = Math.max(-32768, Math.min(32767, Math.round(v * 32768)));
        if (this.n === 320) {
          this.port.postMessage({ pcm: this.buf.buffer, rms: Math.sqrt(this.sum / 320) }, [this.buf.buffer]);
          this.buf = new Int16Array(320); this.n = 0; this.sum = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('rounds-tap', Tap);
`;

let ctx: AudioContext | null = null;
let workletReady: Promise<void> | null = null;

function context(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

const out: AudioOut = {
  get currentTime() {
    return context().currentTime;
  },
  get latency() {
    const c = context();
    return c.baseLatency + (c.outputLatency || 0);
  },
  schedule(samples, sampleRate, when) {
    const c = context();
    const buffer = c.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(when);
    return {
      duration: buffer.duration,
      stop: () => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      },
    };
  },
  resume: async () => {
    await context().resume();
  },
};

let stream: MediaStream | null = null;

export const voicePlatform: VoicePlatform = {
  supported,
  async prepare(): Promise<MicPermission> {
    if (!supported()) return 'unsupported';
    try {
      stream ??= await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      await context().resume();
      return 'granted';
    } catch {
      return 'denied';
    }
  },
  audioOut: () => out,
  async startMic(onFrame: (frame: MicFrame) => void): Promise<Mic> {
    const c = context();
    if (!stream) throw new Error('Microphone not ready');
    workletReady ??= c.audioWorklet.addModule(
      URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })),
    );
    await workletReady;
    const tap = new AudioWorkletNode(c, 'rounds-tap');
    // The tap must reach the destination to run; muted so the mic isn't heard.
    const mute = c.createGain();
    mute.gain.value = 0;
    tap.connect(mute).connect(c.destination);
    const source = c.createMediaStreamSource(stream);
    source.connect(tap);
    tap.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
      onFrame({ pcm: e.data.pcm, rms: e.data.rms, durationMs: 20, at: performance.now() });
    };
    return {
      stop: () => {
        source.disconnect();
        tap.disconnect();
        tap.port.onmessage = null;
        // Release the mic so the browser stops showing it in use.
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        return Promise.resolve();
      },
    };
  },
  fetch: (...args) => fetch(...args),
};
