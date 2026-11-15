/**
 * Voice session rules that aren't about audio: when to play the "thinking"
 * cue, the attending's voice speed (Settings → Voice, wireframe 12), and the
 * fixed lines the attending may say.
 */
import { z } from 'zod';
import { gradeLocally, type Confusable } from '../grading/localGrader.ts';
import type { Question } from '../schemas/question.ts';

/**
 * M2.4: the Claude fallback adds 1.5–2.6 s, so on a matcher miss the attending
 * says "mm-hm" at once. The server grades with the same matcher first and only
 * calls the model when it isn't correct (grade-answer/grade.ts), so the device
 * knows straight away. An empty answer is graded locally: no cue.
 */
export function needsThinkingCue(
  question: Question,
  transcript: string,
  confusables: readonly Confusable[] = [],
): boolean {
  if (transcript.trim() === '') return false;
  return gradeLocally(question, transcript, confusables).grade !== 'correct';
}

/** Deepgram Aura-2 allows 0.7–1.5 with the pitch kept. Developer's choices, M2.5. */
export const VOICE_SPEEDS = [0.8, 1, 1.2, 1.4] as const;
export type VoiceSpeed = (typeof VOICE_SPEEDS)[number];
export const DEFAULT_VOICE_SPEED: VoiceSpeed = 1;
export function isVoiceSpeed(value: unknown): value is VoiceSpeed {
  return typeof value === 'number' && (VOICE_SPEEDS as readonly number[]).includes(value);
}
export const VoiceSpeedSchema = z.custom<VoiceSpeed>(isVoiceSpeed, {
  message: 'Voice speed must be one of 0.8, 1, 1.2, 1.4',
});

/** "1.0×" as in wireframe 12. */
export function voiceSpeedLabel(speed: VoiceSpeed): string {
  return `${speed.toFixed(1)}×`;
}

/** Fixed lines the attending may say that aren't questions. Copy, not medical facts. */
export const CUES = { thinking: 'Mm-hm.' } as const;
export type CueId = keyof typeof CUES;
export const CueIdSchema = z.enum(Object.keys(CUES) as [CueId, ...CueId[]]);
