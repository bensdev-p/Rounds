/**
 * One short, dry line from the attending (DESIGN.md → Progression). Teases,
 * never gushes. Lines carry no medical facts, so they never need review.
 */
import type { PersonaId } from '../ladder/personas.ts';

export type LineMoment = 'top' | 'promotion';

const LINES: Record<PersonaId, Record<LineMoment, readonly [string, ...string[]]>> = {
  teacher: {
    top: ['That was the whole ladder. Nicely done.', 'Good. Now teach it to someone else.'],
    promotion: ['Well earned. Keep asking questions.', 'Congratulations. Keep reading every night.'],
  },
  internist: {
    top: ['Fine. Same time tomorrow.', 'Adequate. Read around it anyway.'],
    promotion: [
      "Congratulations. You're still presenting to me at six.",
      "Noted. Don't let it go to your head.",
    ],
  },
  surgeon: {
    top: ['Good. Faster next time.', 'Fine. Next.'],
    promotion: ['Congratulations. Scrub in.', "Good. You still hold the retractor."],
  },
};

/** A line for the moment. `seed` picks among a persona's lines, so a screen stays stable. */
export function personaLine(persona: PersonaId, moment: LineMoment, seed: number): string {
  const lines = LINES[persona][moment];
  return lines[Math.abs(Math.trunc(seed)) % lines.length] ?? lines[0];
}
