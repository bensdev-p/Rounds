/**
 * Voice on the iPhone (EAS development build; not Expo Go, which lacks the
 * native audio module). react-native-audio-api gives a Web Audio-style
 * context for playback and a recorder that hands back raw samples.
 * The audio session plays through the speaker while the mic is open.
 */
import { MicResampler, resample } from '@rounds/shared';
import { fetch as expoFetch } from 'expo/fetch';
import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';
import type { AudioOut, Mic, MicFrame, MicPermission, VoicePlatform } from './types';

let ctx: AudioContext | null = null;

function context(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

const out: AudioOut = {
  get currentTime() {
    return context().currentTime;
  },
  latency: 0,
  schedule(samples, sampleRate, when) {
    const c = context();
    // The library plays buffers at the device's rate whatever rate they were
    // made with, so convert first (else the voice is fast and high-pitched).
    const atDeviceRate = resample(samples, sampleRate, c.sampleRate);
    const buffer = c.createBuffer(1, atDeviceRate.length, c.sampleRate);
    buffer.copyToChannel(new Float32Array(atDeviceRate), 0);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(when);
    return {
      duration: atDeviceRate.length / c.sampleRate,
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

export const voicePlatform: VoicePlatform = {
  supported: () => true,
  async prepare(): Promise<MicPermission> {
    try {
      AudioManager.setSystemOptions({
        ios: {
          category: 'playAndRecord',
          mode: 'default',
          // Speaker, not the earpiece; AirPods and car audio still work.
          options: ['defaultToSpeaker', 'allowBluetoothHFP', 'allowBluetoothA2DP'],
        },
      });
      const status = await AudioManager.requestRecordingPermissions();
      if (status !== 'Granted') return 'denied';
      await AudioManager.setAudioSessionActivity(true);
      await context().resume();
      return 'granted';
    } catch {
      return 'unsupported';
    }
  },
  audioOut: () => out,
  async startMic(onFrame: (frame: MicFrame) => void): Promise<Mic> {
    const recorder = new AudioRecorder();
    let resampler: MicResampler | null = null;
    recorder.onAudioReady({ sampleRate: 16_000, bufferLength: 320, channelCount: 1 }, (event) => {
      resampler ??= new MicResampler(event.buffer.sampleRate);
      const now = performance.now();
      for (const frame of resampler.push(event.buffer.getChannelData(0))) {
        onFrame({ ...frame, at: now });
      }
    });
    const started = await recorder.start();
    if (started.status === 'error') throw new Error(started.message);
    return {
      stop: async () => {
        recorder.clearOnAudioReady();
        await recorder.stop();
      },
    };
  },
  fetch: expoFetch as unknown as typeof fetch, // expo/fetch matches fetch, typed as its own.
};
