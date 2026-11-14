/**
 * One voice session's audio: the attending asks (cached question audio), the
 * mic goes live, speech streams to speech-to-text, our silence check (or a
 * tap) ends the answer, and the final transcript goes back to the session to
 * grade. Everything vendor-specific sits behind the `stt` and `tts`
 * interfaces: the Edge Functions pick the vendor and hold the keys.
 */
import {
  CUES,
  endNow,
  endOfTurnConfig,
  initialTurn,
  keytermsFor,
  onFrame,
  type CueId,
  type PersonaId,
  type Question,
  type TurnState,
  type VoiceSpeed,
} from '@rounds/shared';
import {
  fetchSpeech,
  getSpeechToken,
  type RoundsClient,
  type SpeechRequest,
  type SpeechToken,
} from '@rounds/shared/api';
import { supabaseEndpoint } from '@/lib/supabase';
import { voicePlatform } from './platform';
import { PcmPlayer } from './player';
import { openStt, type SttStream } from './stt';
import type { Mic, MicFrame } from './types';

/** Why a session opens in text mode instead. */
export type VoiceUnavailable = 'unsupported' | 'denied' | 'server';

export interface ListenResult {
  transcript: string;
  /** Tapped: the student ended it. */
  endedBy: 'silence' | 'tap' | 'cancel';
}

export interface Listening {
  result: Promise<ListenResult>;
  /** The mic was tapped: end the answer now (wireframe 04 note 3). */
  endNow(): void;
  /** Leave without an answer ("Type instead", "I don't know", closing). */
  cancel(): void;
}

/** A token is good for opening a connection for 60 s; renew a little early. */
const TOKEN_REUSE_MS = 40_000;

interface Warm {
  questionId: string;
  stt: Promise<SttStream>;
  sink: { onText: (text: string) => void };
}

export class VoiceEngine {
  private readonly player = new PcmPlayer(voicePlatform.audioOut());
  private readonly clips = new Map<string, Promise<Uint8Array | null>>();
  private token: { value: SpeechToken; at: number } | null = null;
  private route: ((frame: MicFrame) => void) | null = null;
  private warm: Warm | null = null;
  private disposed = false;

  private constructor(
    private readonly client: RoundsClient,
    private readonly persona: PersonaId,
    private readonly speed: VoiceSpeed,
    private mic: Mic | null,
  ) {}

  static supported(): boolean {
    return voicePlatform.supported();
  }

  /** Mic permission, audio session, a first token (proves the server has voice), then the mic. */
  static async start(
    client: RoundsClient,
    persona: PersonaId,
    speed: VoiceSpeed,
  ): Promise<VoiceEngine | VoiceUnavailable> {
    const permission = await voicePlatform.prepare();
    if (permission !== 'granted') return permission;
    const engine = new VoiceEngine(client, persona, speed, null);
    try {
      await engine.getToken();
    } catch {
      return 'server';
    }
    try {
      engine.mic = await voicePlatform.startMic((frame) => engine.route?.(frame));
    } catch {
      return 'unsupported';
    }
    return engine;
  }

  private async getToken(): Promise<SpeechToken> {
    if (this.token && Date.now() - this.token.at < TOKEN_REUSE_MS) return this.token.value;
    const value = await getSpeechToken(this.client);
    this.token = { value, at: Date.now() };
    return value;
  }

  // ─── The attending's voice ────────────────────────────────────────────────

  private clip(key: string, request: SpeechRequest): Promise<Uint8Array | null> {
    let clip = this.clips.get(key);
    if (!clip) {
      const { url, key: publishable } = supabaseEndpoint();
      clip = fetchSpeech(
        this.client,
        `${url}/functions/v1`,
        publishable,
        request,
        voicePlatform.fetch,
      )
        .then(async (response) => new Uint8Array(await response.arrayBuffer()))
        .catch(() => {
          this.clips.delete(key);
          return null;
        });
      this.clips.set(key, clip);
    }
    return clip;
  }

  private questionClip(questionId: string) {
    return this.clip(`q:${questionId}`, {
      question_id: questionId,
      persona: this.persona,
      speed: this.speed,
    });
  }

  private cueClip(cue: CueId) {
    return this.clip(`cue:${cue}`, { cue, persona: this.persona, speed: this.speed });
  }

  /** Fetch the run's questions (in order) and the cue, so each is ready before it's needed. */
  prefetch(questionIds: readonly string[]): void {
    for (const id of questionIds) void this.questionClip(id);
    for (const cue of Object.keys(CUES) as CueId[]) void this.cueClip(cue);
  }

  /** Says the question; resolves when it's finished (at once if the audio couldn't be had). */
  async speak(questionId: string): Promise<void> {
    const bytes = await this.questionClip(questionId);
    if (this.disposed || !bytes) return;
    await this.player.play(bytes);
  }

  /** "Mm-hm." while Claude grades (M2.4). Doesn't wait. */
  playCue(cue: CueId = 'thinking'): void {
    void this.cueClip(cue).then((bytes) => {
      if (bytes && !this.disposed) void this.player.play(bytes);
    });
  }

  /** Stops the attending mid-sentence (a miss, Type instead, closing). */
  stopSpeaking(): void {
    this.player.stop();
  }

  // ─── Listening ────────────────────────────────────────────────────────────

  /** Opens the speech-to-text connection while the question is being asked. */
  prepare(question: Question): void {
    if (this.warm?.questionId === question.id) return;
    this.closeWarm();
    const sink = { onText: (_text: string) => {} };
    const stt = this.getToken().then((token) =>
      openStt(token, keytermsFor(question), (text) => sink.onText(text)),
    );
    stt.catch(() => {});
    this.warm = { questionId: question.id, stt, sink };
  }

  private closeWarm(): void {
    void this.warm?.stt.then((s) => s.close()).catch(() => {});
    this.warm = null;
  }

  /**
   * The mic is live: streams the answer and ends it on silence or a tap.
   * Rejects if speech-to-text can't connect (the session falls back to text).
   */
  listen(
    question: Question,
    handlers: { onText: (text: string) => void; onLevel: (rms: number) => void },
  ): Listening {
    this.prepare(question);
    const warm = this.warm!;
    this.warm = null;
    warm.sink.onText = handlers.onText;
    const config = endOfTurnConfig(question.kind);
    let turn: TurnState = initialTurn;
    let stt: SttStream | null = null;
    const queued: ArrayBuffer[] = [];
    let settle!: (result: ListenResult) => void;
    let fail!: (error: Error) => void;
    const result = new Promise<ListenResult>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    let done = false;

    const finishUp = (endedBy: ListenResult['endedBy']) => {
      if (done) return;
      done = true;
      this.route = null;
      if (endedBy === 'cancel') {
        void warm.stt.then((s) => s.close()).catch(() => {});
        settle({ transcript: '', endedBy });
        return;
      }
      warm.stt
        .then(async (s) => {
          const transcript = await s.finish();
          s.close();
          settle({ transcript: transcript.trim(), endedBy });
        })
        .catch(() => fail(new Error('Speech-to-text failed')));
    };

    warm.stt.then(
      (s) => {
        stt = s;
        for (const pcm of queued.splice(0)) s.send(pcm);
      },
      () => {
        if (!done) {
          done = true;
          this.route = null;
          fail(new Error('Speech-to-text failed'));
        }
      },
    );

    this.route = (frame) => {
      handlers.onLevel(frame.rms);
      if (stt) stt.send(frame.pcm);
      else queued.push(frame.pcm);
      turn = onFrame(turn, config, frame);
      if (turn.phase === 'ended') finishUp('silence');
    };

    return {
      result,
      endNow: () => {
        turn = endNow(turn);
        finishUp('tap');
      },
      cancel: () => finishUp('cancel'),
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.route = null;
    this.player.stop();
    this.closeWarm();
    const mic = this.mic;
    this.mic = null;
    await mic?.stop().catch(() => {});
  }
}
