import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS } from '../fixtures/index.ts';
import { gradeLocally } from '../grading/localGrader.ts';
import {
  endNow,
  endOfTurnConfig,
  initialTurn,
  onFrame,
  SILENCE_MS,
  type TurnState,
} from './endOfTurn.ts';
import { keytermsFor, MAX_KEYTERMS } from './keyterms.ts';
import { needsThinkingCue, voiceSpeedLabel, VoiceSpeedSchema } from './voice.ts';

/** Feeds 20 ms frames: each entry is [level, how many frames]. Records the phase after each entry. */
function feed(
  kind: 'single' | 'list',
  pattern: [number, number][],
  start: TurnState = initialTurn,
) {
  const config = endOfTurnConfig(kind);
  let state = start;
  let at = 0;
  const phases: string[] = [];
  for (const [rms, count] of pattern) {
    for (let i = 0; i < count; i++) {
      at += 20;
      state = onFrame(state, config, { rms, at, durationMs: 20 });
    }
    phases.push(state.phase);
  }
  return { state, phases };
}

const LOUD = 0.1;
const QUIET = 0.001;
const frames = (ms: number) => Math.round(ms / 20);

describe('end of turn', () => {
  it('waits for speech, then ends after the silence', () => {
    const { phases, state } = feed('single', [
      [QUIET, frames(2_000)],
      [LOUD, frames(1_000)],
      [QUIET, frames(SILENCE_MS.single - 20)],
      [QUIET, 1],
    ]);
    expect(phases).toEqual(['waiting', 'speaking', 'speaking', 'ended']);
    expect(state.endedBy).toBe('silence');
    expect(state.lastVoiceAt).toBe(3_000);
  });

  it('a pause shorter than the silence does not end it', () => {
    const { state } = feed('single', [
      [LOUD, frames(600)],
      [QUIET, frames(600)],
      [LOUD, frames(600)],
      [QUIET, frames(400)],
    ]);
    expect(state.phase).toBe('speaking');
  });

  it('waits longer on list questions', () => {
    const pause: [number, number][] = [
      [LOUD, frames(500)],
      [QUIET, frames(1_000)],
    ];
    expect(feed('single', pause).state.phase).toBe('ended');
    expect(feed('list', pause).state.phase).toBe('speaking');
    expect(feed('list', [...pause, [QUIET, frames(500)]]).state.phase).toBe('ended');
  });

  it('ignores a click or cough shorter than real speech', () => {
    const { state } = feed('single', [
      [LOUD, 3],
      [QUIET, frames(2_000)],
      [LOUD, 3],
      [QUIET, frames(2_000)],
    ]);
    expect(state.phase).toBe('waiting');
  });

  it('a tap ends it at once, even before speech', () => {
    expect(endNow(initialTurn)).toMatchObject({ phase: 'ended', endedBy: 'tap' });
    const ended = endNow(feed('single', [[LOUD, 20]]).state);
    expect(ended.endedBy).toBe('tap');
    expect(endNow(ended)).toBe(ended);
  });
});

describe('keyterms', () => {
  it('lists accepted answers and synonyms once each', () => {
    const terms = keytermsFor({
      accepted_answers: [
        { answer: 'ALT', synonyms: ['alanine aminotransferase', 'alt'] },
        { answer: 'Lactated Ringer’s', synonyms: ['  LR  '] },
      ],
    });
    expect(terms).toEqual(['ALT', 'alanine aminotransferase', 'Lactated Ringer’s', 'LR']);
  });

  it('caps the count', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ answer: `term ${i}`, synonyms: [] }));
    expect(keytermsFor({ accepted_answers: many })).toHaveLength(MAX_KEYTERMS);
  });

  it('gives every fixture question some', () => {
    for (const q of TEST_QUESTIONS) expect(keytermsFor(q).length).toBeGreaterThan(0);
  });
});

describe('thinking cue', () => {
  it('plays exactly when the matcher misses a non-empty answer', () => {
    for (const q of TEST_QUESTIONS) {
      const right = q.accepted_answers.map((a) => a.answer).join(', ');
      expect(needsThinkingCue(q, right)).toBe(gradeLocally(q, right).grade !== 'correct');
      expect(needsThinkingCue(q, 'something unrelated entirely')).toBe(true);
      expect(needsThinkingCue(q, '   ')).toBe(false);
    }
  });
});

describe('voice speed', () => {
  it('labels and validates', () => {
    expect(voiceSpeedLabel(1)).toBe('1.0×');
    expect(voiceSpeedLabel(1.4)).toBe('1.4×');
    expect(VoiceSpeedSchema.safeParse(1.2).success).toBe(true);
    expect(VoiceSpeedSchema.safeParse(1.1).success).toBe(false);
  });
});
