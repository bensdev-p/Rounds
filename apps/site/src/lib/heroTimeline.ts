/**
 * The playing hero on Home: one short session, as a list of timed events.
 * The attending's question appears word by word, then the student's answer as a
 * live transcript, then the rung passes (or, on the last rung shown, is missed).
 * Pure, so the pacing is tested without a browser.
 */

export type HeroEvent =
  | { at: number; kind: 'question'; rung: number; words: number }
  | { at: number; kind: 'answer'; rung: number; words: number }
  | { at: number; kind: 'pass'; rung: number }
  | { at: number; kind: 'miss'; rung: number }
  | { at: number; kind: 'next'; rung: number }
  | { at: number; kind: 'end' };

export const HERO_PACE = {
  questionWordMs: 110,
  afterQuestionMs: 380,
  answerWordMs: 125,
  afterAnswerMs: 450,
  afterPassMs: 420,
  afterMissMs: 300,
} as const;

export const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** Events for climbing `climb` until the rung at `missAt` is missed. */
export function heroTimeline(
  climb: readonly { q: string; a: string | null }[],
  missAt: number,
  pace: Readonly<Record<keyof typeof HERO_PACE, number>> = HERO_PACE,
): HeroEvent[] {
  const events: HeroEvent[] = [];
  let t = 0;
  for (let rung = 0; rung <= missAt; rung++) {
    const step = climb[rung];
    if (!step || step.a === null)
      throw new Error(`Rung ${rung + 1} needs a question and an answer`);
    const q = words(step.q);
    for (let w = 1; w <= q.length; w++) {
      events.push({ at: t, kind: 'question', rung, words: w });
      t += pace.questionWordMs;
    }
    t += pace.afterQuestionMs;
    const a = words(step.a);
    for (let w = 1; w <= a.length; w++) {
      events.push({ at: t, kind: 'answer', rung, words: w });
      t += pace.answerWordMs;
    }
    t += pace.afterAnswerMs;
    if (rung === missAt) {
      events.push({ at: t, kind: 'miss', rung });
      t += pace.afterMissMs;
    } else {
      events.push({ at: t, kind: 'pass', rung });
      t += pace.afterPassMs;
      events.push({ at: t, kind: 'next', rung: rung + 1 });
    }
  }
  events.push({ at: t, kind: 'end' });
  return events;
}
